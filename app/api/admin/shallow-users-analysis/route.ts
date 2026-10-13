import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { isAllowedOrigin } from '@/lib/request-security';
import { llmChatCompletion } from '@/lib/tokendance';
import { recordAiUsage } from '@/lib/token-usage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 未深度体验用户：对话消息数 < 10 条的用户
const SHALLOW_MESSAGE_THRESHOLD = 10;
const MAX_SHALLOW_USERS = 80;

type ConversationRow = { id: string; user_id: string; title: string | null; created_at: string };
type MessageRow = { id: string; conversation_id: string; role: string; content: string; created_at: string };
type ShallowUserRow = { user_id: string; message_count: number; first_message_at: string; last_message_at: string };

type Analysis = {
  total_shallow_users: number;
  common_patterns: string[];
  drop_off_reasons: Array<{ reason: string; evidence: string; frequency: string }>;
  common_topics_before_drop: string[];
  entry_channels: Array<{ channel: string; count: number }>;
  coach_suggestion: string;
  summary: string;
};

function isMissingTableError(error: unknown) {
  if (!error || typeof error !== 'object') return false;
  const message = 'message' in error && typeof error.message === 'string' ? error.message : '';
  const code = 'code' in error && typeof error.code === 'string' ? error.code : '';
  return code === '42P01' || /could not find the table|does not exist|schema cache/i.test(message);
}

const ANALYSIS_SYSTEM_PROMPT = `你是一位用户行为研究员 + 职业教练督导。你正在分析一批"未深度体验"的用户——他们与 AI 教练对话少于 10 条消息就离开了。

请基于这些用户的对话片段和元数据，分析他们为什么没有深入，并给出可执行的改进建议。

返回严格的 JSON：
{
  "total_shallow_users": 数字,
  "common_patterns": ["这些用户的共同行为模式，3-5 条，如'前 3 条消息后就离开'、'只在第一次访问时聊了几句'"],
  "drop_off_reasons": [
    {
      "reason": "流失原因的简短标签（如'内容太抽象'、'没感到被理解'、'报告门槛过高'）",
      "evidence": "从对话片段中观察到的依据",
      "frequency": "high / medium / low"
    }
  ],
  "common_topics_before_drop": ["这些用户在离开前聊到的话题，3-6 个"],
  "entry_channels": [{"channel": "入口来源", "count": 数字}],
  "coach_suggestion": "给教练的改进建议：如何在早期对话中留住用户，2-3 句话",
  "summary": "整体总结，1-2 句话"
}

注意：
- 基于数据说话，不要编造
- 如果数据太少，在 summary 中说明，仍然给出最小可用分析
- drop_off_reasons 不超过 5 条，按 frequency 排序`;

async function generateAnalysis(
  req: Request,
  shallowUsers: ShallowUserRow[],
  sampleMessages: Map<string, MessageRow[]>,
): Promise<Analysis | null> {
  // 构造分析输入
  const userDigests: string[] = [];
  let idx = 0;
  for (const u of shallowUsers.slice(0, 40)) {
    const msgs = sampleMessages.get(u.user_id) || [];
    const msgLines = msgs.slice(0, 6).map((m) => {
      const speaker = m.role === 'user' ? '用户' : '教练';
      const text = m.content.length > 200 ? m.content.slice(0, 200) + '...' : m.content;
      return `[${speaker}] ${text}`;
    });
    userDigests.push(
      `--- 用户 ${u.user_id.slice(0, 8)} · ${u.message_count} 条消息 · ${u.first_message_at} → ${u.last_message_at} ---`,
      ...msgLines,
      '',
    );
    idx++;
  }

  if (userDigests.length === 0) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60000);

  try {
    const result = await llmChatCompletion({
      messages: [
        { role: 'system', content: ANALYSIS_SYSTEM_PROMPT },
        {
          role: 'user',
          content: `共 ${shallowUsers.length} 个未深度体验用户。以下是其中 ${Math.min(40, shallowUsers.length)} 个用户的对话片段：\n\n${userDigests.join('\n')}`,
        },
      ],
      temperature: 0.4,
      maxTokens: 1200,
      responseFormat: { type: 'json_object' },
      signal: controller.signal,
    });

    await recordAiUsage({
      req,
      route: 'admin/shallow-users-analysis',
      model: result.model,
      usage: result.usage,
    });

    const parsed = JSON.parse(result.content) as Analysis;
    if (!Array.isArray(parsed.common_patterns)) parsed.common_patterns = [];
    if (!Array.isArray(parsed.drop_off_reasons)) parsed.drop_off_reasons = [];
    if (!Array.isArray(parsed.common_topics_before_drop)) parsed.common_topics_before_drop = [];
    if (!Array.isArray(parsed.entry_channels)) parsed.entry_channels = [];
    if (!parsed.coach_suggestion) parsed.coach_suggestion = '(LLM 未生成)';
    if (!parsed.summary) parsed.summary = '(LLM 未生成)';
    parsed.total_shallow_users = shallowUsers.length;
    return parsed;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

// GET /api/admin/shallow-users-analysis
// 返回：未深度体验用户的普遍原因分析（缓存优先，可强制刷新）
export async function GET(req: Request) {
  try {
    if (!isAllowedOrigin(req)) {
      return NextResponse.json({ error: 'Forbidden origin' }, { status: 403 });
    }
    const { supabaseAdmin } = await requireAdmin(req);
    const url = new URL(req.url);
    const forceRefresh = url.searchParams.get('refresh') === '1';
    void forceRefresh; // 保留刷新参数，未来接入缓存时使用

    // 查询缓存表（复用 admin_user_profiles 的同样模式，但这里用 analytics_events 存）
    // 为了不新增表，我们把分析结果直接每次现算或用内存缓存
    // 实际上：查询最近对话，找消息数 < 10 的用户
    const { data: convData, error: convError } = await supabaseAdmin
      .from('conversations')
      .select('id, user_id, title, created_at')
      .order('created_at', { ascending: false })
      .limit(400);
    if (convError && !isMissingTableError(convError)) throw convError;
    const conversations = (convData || []) as ConversationRow[];

    // 查这些对话的消息数（按 conversation 分组）
    const convIds = conversations.map((c) => c.id);
    const { data: msgData, error: msgError } = await supabaseAdmin
      .from('messages')
      .select('id, conversation_id, role, content, created_at')
      .in('conversation_id', convIds.length > 0 ? convIds : ['__none__'])
      .order('created_at', { ascending: true });
    if (msgError && !isMissingTableError(msgError)) throw msgError;
    const allMessages = (msgData || []) as MessageRow[];

    // 按 conversation 分组
    const messagesByConv = new Map<string, MessageRow[]>();
    for (const m of allMessages) {
      const list = messagesByConv.get(m.conversation_id) || [];
      list.push(m);
      messagesByConv.set(m.conversation_id, list);
    }

    // 按用户聚合，找对话消息 < 10 的用户
    const userMap = new Map<string, { messages: MessageRow[]; conversations: ConversationRow[] }>();
    for (const c of conversations) {
      if (!c.user_id) continue;
      const msgs = messagesByConv.get(c.id) || [];
      const entry = userMap.get(c.user_id) || { messages: [], conversations: [] };
      entry.messages.push(...msgs);
      entry.conversations.push(c);
      userMap.set(c.user_id, entry);
    }

    const shallowUsers: ShallowUserRow[] = [];
    const sampleMessages = new Map<string, MessageRow[]>();
    for (const [userId, entry] of userMap) {
      if (entry.messages.length >= SHALLOW_MESSAGE_THRESHOLD) continue; // 只看 < 10 的
      if (entry.messages.length === 0) continue;
      const times = entry.messages.map((m) => new Date(m.created_at).getTime()).sort((a, b) => a - b);
      shallowUsers.push({
        user_id: userId,
        message_count: entry.messages.length,
        first_message_at: new Date(times[0]).toISOString(),
        last_message_at: new Date(times[times.length - 1]).toISOString(),
      });
      sampleMessages.set(userId, entry.messages.slice(0, 8));
    }

    shallowUsers.sort((a, b) => a.message_count - b.message_count);
    const limited = shallowUsers.slice(0, MAX_SHALLOW_USERS);

    if (limited.length === 0) {
      return NextResponse.json({
        ok: true,
        analysis: null,
        shallowUsersCount: 0,
        reason: '当前没有未深度体验用户（对话 < 10 条）',
      });
    }

    // 强制刷新或无缓存时生成
    const analysis = await generateAnalysis(req, limited, sampleMessages);

    return NextResponse.json({
      ok: true,
      analysis,
      shallowUsersCount: limited.length,
      totalShallowUsers: shallowUsers.length,
      cached: false,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to analyze shallow users';
    const status = /forbidden|authorization|token|admin/i.test(message) ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
