import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { isAllowedOrigin } from '@/lib/request-security';
import { llmChatCompletion } from '@/lib/tokendance';
import { recordAiUsage } from '@/lib/token-usage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MESSAGE_THRESHOLD = 10;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

type ConversationRow = { id: string; user_id: string; title: string | null; created_at: string; updated_at: string };
type MessageRow = { id: string; conversation_id: string; role: string; content: string; created_at: string };
type ProfileRow = { user_id: string; profile_json: unknown; generated_at: string };

function isMissingTableError(error: unknown) {
  if (!error || typeof error !== 'object') return false;
  const message = 'message' in error && typeof error.message === 'string' ? error.message : '';
  const code = 'code' in error && typeof error.code === 'string' ? error.code : '';
  return code === '42P01' || /could not find the table|does not exist|schema cache/i.test(message);
}

type UserProfile = {
  age: string | null;
  gender: string | null;
  city: string | null;
  occupation: string | null;
  workDuration: string | null;
  gapDuration: string | null;
  workStatus: string | null;
  bottleneck: string | null;
  expectation: string | null;
  conversationDirection: string | null;
  reliefOrHope: string | null;
  solution: string | null;
  summary: string;
};

type UserEntry = {
  userId: string;
  conversationCount: number;
  totalMessages: number;
  status: 'profiled' | 'possibly_incomplete';
  profile: UserProfile | null;
  conversations: Array<{
    id: string;
    title: string | null;
    created_at: string;
    message_count: number;
  }>;
};

const PROFILE_SYSTEM_PROMPT = `你是一位资深的职业教练和用户研究员。请根据以下用户与 AI 教练的完整对话记录，分析并生成用户画像。

返回严格的 JSON，包含以下字段（对话中未提及的信息填 null，不要编造）：
{
  "age": "年龄或年龄段（如'30岁左右'、'20代后半'，无法确定则null）",
  "gender": "性别（无法确定则null）",
  "city": "城市（无法确定则null）",
  "occupation": "原本职业/工作",
  "workDuration": "工作时长（如'5年'、'10年+'，无法确定则null）",
  "gapDuration": "gap时长（如'3个月'、'1年'，无gap则null）",
  "workStatus": "当前工作状态描述",
  "bottleneck": "工作中遇到的核心瓶颈",
  "expectation": "个人期望和方向",
  "conversationDirection": "对话走向：用户和教练聊了什么、怎么聊的",
  "reliefOrHope": "是否得到缓解或看到希望（'有缓解'/'看到希望'/'仍在探索'）",
  "solution": "解决方案或行动方向",
  "summary": "一句话总结这个用户的故事弧线"
}

注意：
- summary 是必填字段，其他字段如果对话中未提及，填 null
- 从对话内容中自然推断，不要生硬提取
- 保持客观、有洞察力的描述风格`;

function buildTranscript(conversations: Array<{ id: string; title: string | null; created_at: string }>, messagesByConv: Map<string, MessageRow[]>): string {
  const sorted = [...conversations].sort((a, b) => a.created_at.localeCompare(b.created_at));
  const parts: string[] = [];
  for (const conv of sorted) {
    const msgs = (messagesByConv.get(conv.id) || []).sort((a, b) => a.created_at.localeCompare(b.created_at));
    parts.push(`\n=== 对话：${conv.title || '未命名'} (${conv.created_at}) ===`);
    for (const m of msgs) {
      const speaker = m.role === 'user' ? '用户' : m.role === 'assistant' ? '教练' : m.role;
      parts.push(`[${speaker}] ${m.content}`);
    }
  }
  // 限制 transcript 长度，避免超出模型上下文
  const full = parts.join('\n');
  if (full.length > 12000) {
    return full.slice(0, 6000) + '\n...(对话过长，仅截取前半部分)...\n' + full.slice(-6000);
  }
  return full;
}

async function generateUserProfile(
  req: Request,
  userId: string,
  conversations: Array<{ id: string; title: string | null; created_at: string }>,
  messagesByConv: Map<string, MessageRow[]>,
): Promise<UserProfile | null> {
  const transcript = buildTranscript(conversations, messagesByConv);
  if (!transcript.trim()) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60000);

  try {
    const result = await llmChatCompletion({
      messages: [
        { role: 'system', content: PROFILE_SYSTEM_PROMPT },
        { role: 'user', content: `用户ID: ${userId}\n\n以下是该用户与教练的完整对话记录：\n${transcript}` },
      ],
      temperature: 0.4,
      maxTokens: 800,
      responseFormat: { type: 'json_object' },
      signal: controller.signal,
    });

    await recordAiUsage({
      req,
      route: 'admin/user-profile',
      model: result.model,
      usage: result.usage,
    });

    const parsed = JSON.parse(result.content) as UserProfile;
    if (!parsed.summary || typeof parsed.summary !== 'string') {
      parsed.summary = '（LLM 未生成有效摘要）';
    }
    return parsed;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function GET(req: Request) {
  try {
    if (!isAllowedOrigin(req)) {
      return NextResponse.json({ error: 'Forbidden origin' }, { status: 403 });
    }
    const { supabaseAdmin } = await requireAdmin(req);
    const url = new URL(req.url);
    const forceRefresh = url.searchParams.get('refresh') === '1';

    // 查询所有对话（按创建时间降序，最多 200 条用于画像分析）
    const { data: conversationsData, error: convError } = await supabaseAdmin
      .from('conversations')
      .select('id, user_id, title, created_at, updated_at')
      .order('created_at', { ascending: false })
      .limit(200);

    if (convError && !isMissingTableError(convError)) throw convError;
    const conversations = (convError ? [] : conversationsData || []) as ConversationRow[];

    // 查询这些对话的所有消息
    const convIds = conversations.map((c) => c.id);
    let messagesByConv = new Map<string, MessageRow[]>();
    if (convIds.length > 0) {
      const { data: messagesData, error: msgError } = await supabaseAdmin
        .from('messages')
        .select('id, conversation_id, role, content, created_at')
        .in('conversation_id', convIds)
        .order('created_at', { ascending: true });

      if (msgError && !isMissingTableError(msgError)) throw msgError;
      for (const msg of (messagesData || []) as MessageRow[]) {
        const list = messagesByConv.get(msg.conversation_id) || [];
        list.push(msg);
        messagesByConv.set(msg.conversation_id, list);
      }
    }

    // 按用户聚合
    const userMap = new Map<string, ConversationRow[]>();
    for (const conv of conversations) {
      if (!conv.user_id) continue;
      const list = userMap.get(conv.user_id) || [];
      list.push(conv);
      userMap.set(conv.user_id, list);
    }

    // 查询缓存表（如果存在）
    const userIds = Array.from(userMap.keys());
    let cacheMap = new Map<string, ProfileRow>();
    if (userIds.length > 0 && !forceRefresh) {
      const { data: cacheData, error: cacheError } = await supabaseAdmin
        .from('admin_user_profiles')
        .select('user_id, profile_json, generated_at')
        .in('user_id', userIds);

      if (!cacheError) {
        const now = Date.now();
        for (const row of (cacheData || []) as ProfileRow[]) {
          const genTime = new Date(row.generated_at).getTime();
          if (now - genTime < CACHE_TTL_MS) {
            cacheMap.set(row.user_id, row);
          }
        }
      }
    }

    // 为每个用户生成画像
    const entries: UserEntry[] = [];
    for (const [userId, userConversations] of userMap) {
      const totalMessages = userConversations.reduce(
        (sum, c) => sum + (messagesByConv.get(c.id)?.length || 0),
        0,
      );
      const convSummary = userConversations.map((c) => ({
        id: c.id,
        title: c.title,
        created_at: c.created_at,
        message_count: messagesByConv.get(c.id)?.length || 0,
      }));

      if (totalMessages < MESSAGE_THRESHOLD) {
        entries.push({
          userId,
          conversationCount: userConversations.length,
          totalMessages,
          status: 'possibly_incomplete',
          profile: null,
          conversations: convSummary,
        });
        continue;
      }

      // 检查缓存
      const cached = cacheMap.get(userId);
      if (cached && !forceRefresh) {
        entries.push({
          userId,
          conversationCount: userConversations.length,
          totalMessages,
          status: 'profiled',
          profile: cached.profile_json as UserProfile,
          conversations: convSummary,
        });
        continue;
      }

      // 现场生成
      const profile = await generateUserProfile(req, userId, userConversations, messagesByConv);

      // 写入缓存（静默失败）
      if (profile) {
        await supabaseAdmin
          .from('admin_user_profiles')
          .upsert({
            user_id: userId,
            profile_json: profile,
            generated_at: new Date().toISOString(),
          }, { onConflict: 'user_id' })
          .then(() => {}, () => {});
      }

      entries.push({
        userId,
        conversationCount: userConversations.length,
        totalMessages,
        status: 'profiled',
        profile,
        conversations: convSummary,
      });
    }

    // 按消息数排序（多的在前）
    entries.sort((a, b) => b.totalMessages - a.totalMessages);

    return NextResponse.json({
      ok: true,
      entries,
      threshold: MESSAGE_THRESHOLD,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load user profiles';
    const status = /forbidden|authorization|token/i.test(message) ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
