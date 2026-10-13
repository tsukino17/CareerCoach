import { NextResponse } from 'next/server';
import { getSupabaseAdminClient, requireAdmin } from '@/lib/admin-auth';
import { isAllowedOrigin } from '@/lib/request-security';
import { llmChatCompletion } from '@/lib/tokendance';
import { recordAiUsage, resolveUsageUser } from '@/lib/token-usage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 触发条件：对话消息数 > 10、最后一条消息距今 > 3 小时、尚未生成过该 coach_type 的笔记
// 报告不是必须条件：有报告则把报告归纳进笔记，没报告也生成笔记
const MIN_MESSAGES = 10;
const IDLE_THRESHOLD_MS = 3 * 60 * 60 * 1000; // 3 小时
const DEFAULT_COACH_TYPE = 'talent' as const;

const COACH_NOTE_SYSTEM_PROMPT = `你是一位资深职业教练，正在为同行教练/督导整理这次对话的笔记。请基于下方用户与 AI 教练的完整对话（以及用户的职业报告摘要，如果有），从教练视角生成一份结构化笔记。

返回严格的 JSON，包含以下字段：
{
  "summary": "这次对话的简短总结（1-2 句话，说清楚用户带着什么问题来、聊到了什么程度）",
  "user_state": "用户当前的情绪与状态描述（如'焦虑但愿意探索'、'防御较强'、'已看到一点希望'）",
  "key_topics": ["对话涉及的核心话题，2-5 个短词或短语"],
  "coaching_strategies": ["教练这次用到的 coaching 策略，如'先共情再重构'、'用隐喻降低防御'、'引导具体经历挖掘'"],
  "what_worked": "这次对话中明显有效的做法（具体到哪句话/哪个动作起作用）",
  "what_didnt_work": "这次对话中效果不好的做法或卡住的地方（如果没有可填 null）",
  "follow_ups": ["下次对话可以跟进的方向或问题，2-3 条"],
  "sentiment": "整体情绪走向：positive / neutral / ambivalent / negative",
  "report_integration": "如果输入里包含用户报告摘要，说明对话与报告结论的衔接情况（如'对话已触及报告中的核心天赋'或'对话还没走到报告方向'）；无报告则填 null"
}

注意：
- 站在教练视角，不是用户视角
- what_worked 和 what_didnt_work 要具体，不要泛泛
- follow_ups 是给下次对话用的，不是给用户的任务清单
- report_integration 字段用于后期打通给行动教练，务必填写
- 如果对话过短或信息不足，仍然输出最小可用的笔记，不要拒绝`;

type CoachNote = {
  summary: string;
  user_state: string;
  key_topics: string[];
  coaching_strategies: string[];
  what_worked: string | null;
  what_didnt_work: string | null;
  follow_ups: string[];
  sentiment: 'positive' | 'neutral' | 'ambivalent' | 'negative';
  report_integration: string | null;
};

type MessageRow = { id: string; conversation_id: string; role: string; content: string; created_at: string };
type DraftRow = { draft_token: string; report: unknown; created_at: string };

function isMissingTableError(error: unknown) {
  if (!error || typeof error !== 'object') return false;
  const message = 'message' in error && typeof error.message === 'string' ? error.message : '';
  const code = 'code' in error && typeof error.code === 'string' ? error.code : '';
  return code === '42P01' || /could not find the table|does not exist|schema cache/i.test(message);
}

function buildTranscript(messages: MessageRow[]): string {
  const filtered = messages.filter((m) => {
    if (m.role === 'system') return false;
    if (typeof m.content !== 'string') return false;
    if (m.content.startsWith('[EchoTalent UI Action:')) return false;
    if (m.content === '继续聊聊') return false;
    return true;
  });
  const lines = filtered.map((m) => {
    const speaker = m.role === 'user' ? '用户' : '教练';
    return `[${speaker}] ${m.content}`;
  });
  return lines.join('\n');
}

function summarizeReport(report: unknown): string | null {
  if (!report || typeof report !== 'object') return null;
  const r = report as {
    archetype?: string;
    skills?: string[];
    superpowers?: Array<string | { name?: string; description?: string }>;
    summary?: string;
    target_roles?: string[];
  };
  const parts: string[] = [];
  if (r.archetype) parts.push(`职业原型：${r.archetype}`);
  if (Array.isArray(r.skills) && r.skills.length > 0) {
    parts.push(`核心技能：${r.skills.filter((s): s is string => typeof s === 'string').join('、')}`);
  }
  if (Array.isArray(r.superpowers) && r.superpowers.length > 0) {
    const names = r.superpowers.map((s) => (typeof s === 'string' ? s : s?.name || '')).filter(Boolean);
    if (names.length > 0) parts.push(`核心优势：${names.join('、')}`);
  }
  if (Array.isArray(r.target_roles) && r.target_roles.length > 0) {
    parts.push(`推荐方向：${r.target_roles.filter((s): s is string => typeof s === 'string').join('、')}`);
  }
  if (r.summary) parts.push(`报告总结：${r.summary}`);
  return parts.length > 0 ? parts.join('\n') : null;
}

async function fetchUserReport(supabaseAdmin: ReturnType<typeof getSupabaseAdminClient>, userId: string): Promise<{ report: unknown } | null> {
  try {
    // anonymous_career_drafts 表通过 draft_token 关联，但可能没有 user_id 字段
    // 尝试按 user_id 查询；如果表结构不支持，静默返回 null
    const { data, error } = await supabaseAdmin
      .from('anonymous_career_drafts')
      .select('draft_token, report, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) {
      // 如果 user_id 字段不存在，尝试不按 user_id 查询（可能拿不到，那就放弃）
      return null;
    }
    return data as DraftRow | null ? { report: (data as DraftRow).report } : null;
  } catch {
    return null;
  }
}

async function generateCoachNote(
  req: Request,
  conversationId: string,
  userId: string,
  messages: MessageRow[],
  reportSummary: string | null,
): Promise<CoachNote | null> {
  const transcript = buildTranscript(messages);
  if (transcript.trim().length < 30) return null;

  const reportSection = reportSummary
    ? `\n\n=== 用户已生成的职业报告摘要 ===\n${reportSummary}\n（请在 report_integration 字段中说明对话与报告结论的衔接情况）`
    : '\n\n（该用户尚未生成职业报告，report_integration 字段填 null）';

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45000);

  try {
    const result = await llmChatCompletion({
      messages: [
        { role: 'system', content: COACH_NOTE_SYSTEM_PROMPT },
        {
          role: 'user',
          content: `对话ID: ${conversationId}\n用户ID: ${userId.slice(0, 8)}...\n\n以下是完整对话记录：\n${transcript}${reportSection}`,
        },
      ],
      temperature: 0.3,
      maxTokens: 800,
      responseFormat: { type: 'json_object' },
      signal: controller.signal,
    });

    await recordAiUsage({
      req,
      route: 'coach/note',
      model: result.model,
      usage: result.usage,
    });

    const parsed = JSON.parse(result.content) as CoachNote;
    if (!parsed.summary || typeof parsed.summary !== 'string') {
      parsed.summary = '（LLM 未生成有效摘要）';
    }
    if (!Array.isArray(parsed.key_topics)) parsed.key_topics = [];
    if (!Array.isArray(parsed.coaching_strategies)) parsed.coaching_strategies = [];
    if (!Array.isArray(parsed.follow_ups)) parsed.follow_ups = [];
    return parsed;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

// POST /api/coach/notes
// 已登录用户重新打开某对话时触发：服务端校验（消息数>10、停止聊天>3h、尚未有该 coach_type 的笔记）
// 报告不是必须条件：有报告则归纳进笔记，无报告也生成
export async function POST(req: Request) {
  try {
    if (!isAllowedOrigin(req)) {
      return NextResponse.json({ error: 'Forbidden origin' }, { status: 403 });
    }

    const userId = await resolveUsageUser(req);
    if (!userId) {
      return NextResponse.json({ error: 'Login required' }, { status: 401 });
    }

    const body = (await req.json().catch(() => null)) as
      | { conversationId?: unknown; coachType?: unknown }
      | null;
    if (!body) return NextResponse.json({ error: 'Invalid body' }, { status: 400 });

    const conversationId =
      typeof body.conversationId === 'string' && body.conversationId.trim()
        ? body.conversationId.trim()
        : null;
    if (!conversationId) {
      return NextResponse.json({ error: 'conversationId is required' }, { status: 400 });
    }

    const coachType = body.coachType === 'action' ? 'action' : DEFAULT_COACH_TYPE;

    const supabaseAdmin = getSupabaseAdminClient();

    // 1. 校验对话属于该用户
    const { data: conv, error: convError } = await supabaseAdmin
      .from('conversations')
      .select('id, user_id')
      .eq('id', conversationId)
      .maybeSingle();
    if (convError && !isMissingTableError(convError)) throw convError;
    if (!conv || conv.user_id !== userId) {
      return NextResponse.json({ ok: true, note: null, reason: 'conversation not found or not owned' });
    }

    // 2. 检查是否已有该 coach_type 的笔记
    const { data: existing, error: noteCheckError } = await supabaseAdmin
      .from('coach_notes')
      .select('id')
      .eq('conversation_id', conversationId)
      .eq('coach_type', coachType)
      .limit(1)
      .maybeSingle();
    if (noteCheckError && !isMissingTableError(noteCheckError)) throw noteCheckError;
    if (existing) {
      return NextResponse.json({ ok: true, note: null, reason: `${coachType} note already exists` });
    }

    // 3. 查询对话消息
    const { data: messagesData, error: msgError } = await supabaseAdmin
      .from('messages')
      .select('id, conversation_id, role, content, created_at')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });
    if (msgError && !isMissingTableError(msgError)) throw msgError;
    const messages = (messagesData || []) as MessageRow[];

    // 4. 校验消息数 > 10
    if (messages.length < MIN_MESSAGES) {
      return NextResponse.json({ ok: true, note: null, reason: `messages < ${MIN_MESSAGES}` });
    }

    // 5. 校验最后一条消息距今 > 3 小时（用户已停止聊天）
    const lastMessage = messages[messages.length - 1];
    if (!lastMessage?.created_at) {
      return NextResponse.json({ ok: true, note: null, reason: 'no last message time' });
    }
    const lastTime = new Date(lastMessage.created_at).getTime();
    if (Date.now() - lastTime < IDLE_THRESHOLD_MS) {
      return NextResponse.json({ ok: true, note: null, reason: 'user still active (within 3h)' });
    }

    // 6. 查询用户报告（如果有），归纳进笔记
    const userReport = await fetchUserReport(supabaseAdmin, userId);
    const reportSummaryText = userReport ? summarizeReport(userReport.report) : null;
    const reportSummaryForDb = userReport?.report || null;

    // 7. 生成笔记
    const note = await generateCoachNote(req, conversationId, userId, messages, reportSummaryText);
    if (!note) {
      return NextResponse.json({ ok: true, note: null, reason: 'generation failed' });
    }

    const { error: insertError } = await supabaseAdmin.from('coach_notes').insert({
      conversation_id: conversationId,
      user_id: userId,
      coach_type: coachType,
      note_json: note,
      report_summary: reportSummaryForDb,
    });
    if (insertError) {
      if (isMissingTableError(insertError)) {
        return NextResponse.json({ ok: true, note, reason: 'coach_notes table missing' });
      }
      console.warn('[coach-notes] insert failed', insertError.message);
      return NextResponse.json({ ok: true, note, reason: insertError.message });
    }

    return NextResponse.json({ ok: true, note, coachType });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to generate coach note';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// GET /api/coach/notes?conversation_id=xxx&coach_type=talent
// 仅管理员：查询某对话的教练笔记（管理员后台查看用）
export async function GET(req: Request) {
  try {
    if (!isAllowedOrigin(req)) {
      return NextResponse.json({ error: 'Forbidden origin' }, { status: 403 });
    }
    const { supabaseAdmin } = await requireAdmin(req);
    const url = new URL(req.url);
    const conversationId = url.searchParams.get('conversation_id');
    const coachType = url.searchParams.get('coach_type') === 'action' ? 'action' : 'talent';
    const limit = Math.min(50, Math.max(1, Number(url.searchParams.get('limit') || '20')));

    let query = supabaseAdmin
      .from('coach_notes')
      .select('id, conversation_id, user_id, coach_type, note_json, report_summary, created_at')
      .eq('coach_type', coachType)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (conversationId) query = query.eq('conversation_id', conversationId);

    const { data, error } = await query;
    if (error) {
      if (isMissingTableError(error)) {
        return NextResponse.json({ ok: true, notes: [] });
      }
      throw error;
    }
    return NextResponse.json({ ok: true, notes: data || [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch coach notes';
    const status = /forbidden|authorization|token|admin/i.test(message) ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
