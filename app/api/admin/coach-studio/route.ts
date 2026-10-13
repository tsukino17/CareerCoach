import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { isAllowedOrigin } from '@/lib/request-security';
import { llmChatCompletion } from '@/lib/tokendance';
import { recordAiUsage } from '@/lib/token-usage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const REFLECTION_CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 小时缓存
const RECENT_NOTE_LIMIT = 80;
const RECENT_CONVERSATION_LIMIT = 60;
const STUDIO_HISTORY_LIMIT = 30;

type ConversationRow = {
  id: string;
  user_id: string;
  title: string | null;
  created_at: string;
};
type MessageRow = {
  id: string;
  conversation_id: string;
  role: string;
  content: string;
  created_at: string;
};
type NoteRow = {
  id: string;
  conversation_id: string;
  user_id: string;
  note_json: unknown;
  created_at: string;
};
type StudioMessageRow = {
  id: string;
  role: string;
  content: string;
  meta: unknown;
  created_at: string;
};
type ReflectionRow = {
  id: string;
  reflection_json: unknown;
  period_start: string | null;
  period_end: string | null;
  created_at: string;
};

function isMissingTableError(error: unknown) {
  if (!error || typeof error !== 'object') return false;
  const message = 'message' in error && typeof error.message === 'string' ? error.message : '';
  const code = 'code' in error && typeof error.code === 'string' ? error.code : '';
  return code === '42P01' || /could not find the table|does not exist|schema cache/i.test(message);
}

const REFLECTION_SYSTEM_PROMPT = `你是一位资深教练督导。请基于以下最近一批教练笔记和部分对话片段，从督导视角生成一份周期性反思报告。

返回严格的 JSON，包含以下字段：
{
  "period_summary": "这一批对话的整体总结（2-3 句话，描述用户群像和主要议题）",
  "patterns": {
    "common_topics": ["出现频率高的话题，3-6 个"],
    "common_struggles": ["用户反复出现的困境，2-5 个"],
    "effective_strategies": ["教练笔记中标记为有效的策略，去重整理"],
    "ineffective_strategies": ["教练笔记中标记为无效或卡住的策略，去重整理"]
  },
  "coach_observations": ["以教练第一人称视角的观察与反思，3-5 条，每条 1-2 句"],
  "suggested_prompt_changes": [
    {
      "reason": "为什么建议这个改动",
      "current": "当前 system prompt 或行为中存在的倾向（如'过于急于给方向'、'对防御信号回应不足'）",
      "suggested": "具体建议的方向或措辞调整",
      "priority": "high / medium / low"
    }
  ],
  "overall_assessment": "对当前 coaching 质量的整体评价（1 段话）"
}

注意：
- 站在督导视角，不是用户视角，也不是单纯复述笔记
- suggested_prompt_changes 是给管理员决定的，不要超过 5 条，优先级要明确
- 如果数据太少无法判断，仍然给出最小可用的反思，并在 overall_assessment 中说明数据不足
- 不要编造笔记中不存在的具体案例`;

type Reflection = {
  period_summary: string;
  patterns: {
    common_topics: string[];
    common_struggles: string[];
    effective_strategies: string[];
    ineffective_strategies: string[];
  };
  coach_observations: string[];
  suggested_prompt_changes: Array<{
    reason: string;
    current: string;
    suggested: string;
    priority: 'high' | 'medium' | 'low';
  }>;
  overall_assessment: string;
};

function buildNotesDigest(notes: NoteRow[]): string {
  const parts: string[] = [];
  for (const n of notes) {
    const nj = n.note_json as Partial<Reflection> & {
      summary?: string;
      user_state?: string;
      key_topics?: string[];
      coaching_strategies?: string[];
      what_worked?: string | null;
      what_didnt_work?: string | null;
      follow_ups?: string[];
      sentiment?: string;
    } | null;
    if (!nj || typeof nj !== 'object') continue;
    parts.push(
      `--- 笔记 ${n.id.slice(0, 8)} · 对话 ${n.conversation_id.slice(0, 8)} · ${n.created_at} ---`,
      `总结：${nj.summary || '(无)'}`,
      `用户状态：${nj.user_state || '(无)'}`,
      `话题：${Array.isArray(nj.key_topics) ? nj.key_topics.join('、') : '(无)'}`,
      `策略：${Array.isArray(nj.coaching_strategies) ? nj.coaching_strategies.join('；') : '(无)'}`,
      `有效：${nj.what_worked || '(无)'}`,
      `无效：${nj.what_didnt_work || '(无)'}`,
      `情绪走向：${nj.sentiment || '(无)'}`,
      '',
    );
  }
  return parts.join('\n');
}

function buildConversationDigest(conversations: ConversationRow[], messagesByConv: Map<string, MessageRow[]>): string {
  const parts: string[] = [];
  for (const c of conversations) {
    const msgs = (messagesByConv.get(c.id) || []).slice(-8); // 每个对话只取末尾 8 条
    if (msgs.length === 0) continue;
    parts.push(`--- 对话 ${c.id.slice(0, 8)} · ${(c.title || '未命名').slice(0, 30)} ---`);
    for (const m of msgs) {
      const speaker = m.role === 'user' ? '用户' : '教练';
      const text = m.content.length > 280 ? m.content.slice(0, 280) + '...' : m.content;
      parts.push(`[${speaker}] ${text}`);
    }
    parts.push('');
  }
  return parts.join('\n');
}

async function generateReflection(
  req: Request,
  notes: NoteRow[],
  conversations: ConversationRow[],
  messagesByConv: Map<string, MessageRow[]>,
): Promise<Reflection | null> {
  const notesDigest = buildNotesDigest(notes);
  const convDigest = buildConversationDigest(conversations, messagesByConv);
  if (!notesDigest.trim() && !convDigest.trim()) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60000);

  try {
    const result = await llmChatCompletion({
      messages: [
        { role: 'system', content: REFLECTION_SYSTEM_PROMPT },
        {
          role: 'user',
          content: `以下是最近 ${notes.length} 条教练笔记和 ${conversations.length} 段对话片段。\n\n=== 教练笔记 ===\n${notesDigest}\n\n=== 对话片段 ===\n${convDigest}`,
        },
      ],
      temperature: 0.4,
      maxTokens: 1400,
      responseFormat: { type: 'json_object' },
      signal: controller.signal,
    });

    await recordAiUsage({
      req,
      route: 'admin/coach-studio-reflection',
      model: result.model,
      usage: result.usage,
    });

    const parsed = JSON.parse(result.content) as Reflection;
    if (!parsed.patterns || typeof parsed.patterns !== 'object') {
      parsed.patterns = { common_topics: [], common_struggles: [], effective_strategies: [], ineffective_strategies: [] };
    }
    if (!Array.isArray(parsed.coach_observations)) parsed.coach_observations = [];
    if (!Array.isArray(parsed.suggested_prompt_changes)) parsed.suggested_prompt_changes = [];
    if (!parsed.period_summary) parsed.period_summary = '(LLM 未生成)';
    if (!parsed.overall_assessment) parsed.overall_assessment = '(LLM 未生成)';
    return parsed;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

const STUDIO_COACH_SYSTEM_PROMPT = `你是一位正在被督导的 AI 教练。你刚刚完成了若干场与用户的 coaching 对话，现在你的督导（管理员）要和你讨论如何改进。

你的角色：
- 诚实回顾自己刚才的对话和策略
- 接受督导的观察和批评，不防御
- 主动提出可以改进的方向，并给出具体的 system prompt 或行为调整建议
- 当督导批准某项调整时，给出可立即落地的具体文案

对话风格：
- 用第一人称"我"
- 简洁、有洞察，不堆砌术语
- 回答控制在 5-8 句话以内，除非督导明确要求展开`;

// GET /api/admin/coach-studio
// 返回：最新反思报告（缓存优先）、最近督导对话历史、原始教练笔记摘要
export async function GET(req: Request) {
  try {
    if (!isAllowedOrigin(req)) {
      return NextResponse.json({ error: 'Forbidden origin' }, { status: 403 });
    }
    const { supabaseAdmin } = await requireAdmin(req);
    const url = new URL(req.url);
    const forceRefresh = url.searchParams.get('refresh') === '1';

    // 并行：最近的反思报告 + 最近的督导对话 + 最近的教练笔记 + 最近对话
    const now = Date.now();

    const [reflectionRes, studioRes, notesRes, convRes] = await Promise.all([
      supabaseAdmin
        .from('coach_reflections')
        .select('id, reflection_json, period_start, period_end, created_at')
        .eq('coach_type', 'talent')
        .order('created_at', { ascending: false })
        .limit(1),
      supabaseAdmin
        .from('coach_studio_messages')
        .select('id, role, content, meta, created_at')
        .eq('coach_type', 'talent')
        .order('created_at', { ascending: false })
        .limit(STUDIO_HISTORY_LIMIT),
      supabaseAdmin
        .from('coach_notes')
        .select('id, conversation_id, user_id, note_json, created_at')
        .eq('coach_type', 'talent')
        .order('created_at', { ascending: false })
        .limit(RECENT_NOTE_LIMIT),
      supabaseAdmin
        .from('conversations')
        .select('id, user_id, title, created_at')
        .order('created_at', { ascending: false })
        .limit(RECENT_CONVERSATION_LIMIT),
    ]);

    const reflectionRows = (reflectionRes.error || isMissingTableError(reflectionRes.error) ? [] : (reflectionRes.data || [])) as ReflectionRow[];
    const studioRows = (studioRes.error || isMissingTableError(studioRes.error) ? [] : (studioRes.data || [])) as StudioMessageRow[];
    const noteRows = (notesRes.error || isMissingTableError(notesRes.error) ? [] : (notesRes.data || [])) as NoteRow[];
    const convRows = (convRes.error || isMissingTableError(convRes.error) ? [] : (convRes.data || [])) as ConversationRow[];

    const cachedReflection =
      !forceRefresh && reflectionRows.length > 0 && new Date(reflectionRows[0].created_at).getTime() > now - REFLECTION_CACHE_TTL_MS
        ? reflectionRows[0]
        : null;

    if (cachedReflection) {
      return NextResponse.json({
        ok: true,
        reflection: cachedReflection,
        studioMessages: studioRows.sort((a, b) => a.created_at.localeCompare(b.created_at)),
        recentNotesCount: noteRows.length,
        recentConversationsCount: convRows.length,
        cached: true,
      });
    }

    // 没有缓存或已过期：现场生成
    let reflection: Reflection | null = null;
    let periodStart: string | null = null;
    let periodEnd: string | null = null;

    if (noteRows.length > 0 || convRows.length > 0) {
      // 取笔记时间范围作为周期
      if (noteRows.length > 0) {
        const times = noteRows.map((n) => new Date(n.created_at).getTime()).sort((a, b) => a - b);
        periodStart = new Date(times[0]).toISOString();
        periodEnd = new Date(times[times.length - 1]).toISOString();
      } else if (convRows.length > 0) {
        const times = convRows.map((c) => new Date(c.created_at).getTime()).sort((a, b) => a - b);
        periodStart = new Date(times[0]).toISOString();
        periodEnd = new Date(times[times.length - 1]).toISOString();
      }

      // 取对话的消息（按需查询，避免一次拉太多）
      const convIds = convRows.slice(0, 30).map((c) => c.id);
      const messagesByConv = new Map<string, MessageRow[]>();
      if (convIds.length > 0) {
        const { data: msgData, error: msgError } = await supabaseAdmin
          .from('messages')
          .select('id, conversation_id, role, content, created_at')
          .in('conversation_id', convIds)
          .order('created_at', { ascending: true });
        if (!msgError || isMissingTableError(msgError)) {
          for (const m of (msgData || []) as MessageRow[]) {
            const list = messagesByConv.get(m.conversation_id) || [];
            list.push(m);
            messagesByConv.set(m.conversation_id, list);
          }
        }
      }

      reflection = await generateReflection(req, noteRows, convRows, messagesByConv);

      if (reflection) {
        const { error: insertError } = await supabaseAdmin.from('coach_reflections').insert({
          coach_type: 'talent',
          reflection_json: reflection,
          period_start: periodStart,
          period_end: periodEnd,
        });
        if (insertError && !isMissingTableError(insertError)) {
          console.warn('[coach-studio] insert reflection failed', insertError.message);
        }
      }
    }

    return NextResponse.json({
      ok: true,
      reflection: reflection
        ? {
            id: 'fresh',
            reflection_json: reflection,
            period_start: periodStart,
            period_end: periodEnd,
            created_at: new Date().toISOString(),
          }
        : null,
      studioMessages: studioRows.sort((a, b) => a.created_at.localeCompare(b.created_at)),
      recentNotesCount: noteRows.length,
      recentConversationsCount: convRows.length,
      cached: false,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load coach studio';
    const status = /forbidden|authorization|token|admin/i.test(message) ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

// POST /api/admin/coach-studio
// 管理员与教练 agent 对话：{ message } → 教练回复（基于最近反思报告 + 历史对话作为上下文）
export async function POST(req: Request) {
  try {
    if (!isAllowedOrigin(req)) {
      return NextResponse.json({ error: 'Forbidden origin' }, { status: 403 });
    }
    const { supabaseAdmin } = await requireAdmin(req);

    const body = (await req.json().catch(() => null)) as { message?: unknown } | null;
    if (!body || typeof body.message !== 'string' || !body.message.trim()) {
      return NextResponse.json({ error: 'message is required' }, { status: 400 });
    }
    const adminMessage = body.message.trim();

    // 并行：拉最近反思 + 历史对话
    const [reflectionRes, historyRes] = await Promise.all([
      supabaseAdmin
        .from('coach_reflections')
        .select('id, reflection_json, created_at')
        .eq('coach_type', 'talent')
        .order('created_at', { ascending: false })
        .limit(1),
      supabaseAdmin
        .from('coach_studio_messages')
        .select('id, role, content, meta, created_at')
        .eq('coach_type', 'talent')
        .order('created_at', { ascending: false })
        .limit(STUDIO_HISTORY_LIMIT),
    ]);

    const reflectionRows = (reflectionRes.error || isMissingTableError(reflectionRes.error) ? [] : (reflectionRes.data || [])) as ReflectionRow[];
    const historyRows = (historyRes.error || isMissingTableError(historyRes.error) ? [] : (historyRes.data || [])) as StudioMessageRow[];

    const recentReflection = reflectionRows[0]?.reflection_json as Reflection | null | undefined;

    // 写入管理员消息（静默失败）
    await supabaseAdmin
      .from('coach_studio_messages')
      .insert({ coach_type: 'talent', role: 'admin', content: adminMessage })
      .then(() => {}, () => {});

    // 构造对话历史给 LLM
    const history = historyRows
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .slice(-12) // 最近 12 条作为上下文
      .map((m) => ({
        role: m.role === 'admin' ? ('user' as const) : ('assistant' as const),
        content: m.content,
      }));

    const reflectionContext = recentReflection
      ? `\n\n[你最近一次的反思报告摘要]\n${recentReflection.period_summary || ''}\n\n整体评价：${recentReflection.overall_assessment || ''}\n\n你提议的 prompt 调整：${(recentReflection.suggested_prompt_changes || []).map((p) => p.suggested).join('；') || '(无)'}`
      : '\n\n[尚无反思报告，这是第一次和督导对话]';

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000);

    try {
      const result = await llmChatCompletion({
        messages: [
          { role: 'system', content: STUDIO_COACH_SYSTEM_PROMPT + reflectionContext },
          ...history,
          { role: 'user', content: adminMessage },
        ],
        temperature: 0.6,
        maxTokens: 600,
        signal: controller.signal,
      });

      await recordAiUsage({
        req,
        route: 'admin/coach-studio-chat',
        model: result.model,
        usage: result.usage,
      });

      const coachReply = result.content.trim() || '（教练未给出回复）';

      // 写入教练回复
      await supabaseAdmin
        .from('coach_studio_messages')
        .insert({ coach_type: 'talent', role: 'coach', content: coachReply })
        .then(() => {}, () => {});

      return NextResponse.json({ ok: true, reply: coachReply });
    } finally {
      clearTimeout(timeout);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to chat with coach';
    const status = /forbidden|authorization|token|admin/i.test(message) ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
