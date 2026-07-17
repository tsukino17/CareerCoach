import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { isAllowedOrigin } from '@/lib/request-security';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type ConversationRow = {
  id: string;
  user_id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
};

type MessageRow = {
  id: string;
  conversation_id: string;
  role: string;
  content: string;
  created_at: string;
};

type AnalyticsEventRow = {
  session_id: string | null;
  user_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string | null;
};

function isMissingTableError(error: unknown) {
  if (!error || typeof error !== 'object') return false;
  const message = 'message' in error && typeof error.message === 'string' ? error.message : '';
  const code = 'code' in error && typeof error.code === 'string' ? error.code : '';
  return code === '42P01' || /could not find the table|does not exist|schema cache/i.test(message);
}

function asText(value: unknown) {
  return typeof value === 'string' ? value : '';
}

export async function GET(req: Request) {
  try {
    if (!isAllowedOrigin(req)) {
      return NextResponse.json({ error: 'Forbidden origin' }, { status: 403 });
    }
    const { supabaseAdmin } = await requireAdmin(req);
    const url = new URL(req.url);
    const userId = (url.searchParams.get('user_id') || '').trim();
    const keyword = (url.searchParams.get('keyword') || '').trim();
    const limitRaw = Number(url.searchParams.get('limit') || 30);
    const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(100, limitRaw)) : 30;

    let conversationsQuery = supabaseAdmin
      .from('conversations')
      .select('id, user_id, title, created_at, updated_at')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (userId) conversationsQuery = conversationsQuery.eq('user_id', userId);
    if (keyword) conversationsQuery = conversationsQuery.ilike('title', `%${keyword}%`);

    const { data: conversationsData, error: conversationsError } = await conversationsQuery;
    const missingConversations = conversationsError && isMissingTableError(conversationsError);
    if (conversationsError && !missingConversations) throw conversationsError;

    const conversations = (missingConversations ? [] : conversationsData || []) as ConversationRow[];

    const ids = conversations.map((c) => c.id);
    let messagesData: unknown[] = [];
    let messagesWarning: string | null = null;
    if (ids.length > 0) {
      let messagesQuery = supabaseAdmin
        .from('messages')
        .select('id, conversation_id, role, content, created_at')
        .in('conversation_id', ids)
        .order('created_at', { ascending: true });

      if (keyword) {
        messagesQuery = messagesQuery.ilike('content', `%${keyword}%`);
      }

      const { data, error } = await messagesQuery;
      if (error && isMissingTableError(error)) {
        messagesWarning = 'messages 表暂时不可用，已登录消息内容为空。';
      } else if (error) {
        throw error;
      } else {
        messagesData = data || [];
      }
    }

    const messages = (messagesData || []) as MessageRow[];
    const map = new Map<string, MessageRow[]>();
    for (const message of messages) {
      const list = map.get(message.conversation_id) || [];
      list.push(message);
      map.set(message.conversation_id, list);
    }

    const savedConversations = conversations.map((conv) => ({
      ...conv,
      messages: map.get(conv.id) || [],
      message_count: (map.get(conv.id) || []).length,
    }));

    const { data: anonymousData, error: anonymousError } = await supabaseAdmin
      .from('analytics_events')
      .select('session_id, user_id, metadata, created_at')
      .eq('event_name', 'anonymous_chat_message')
      .order('created_at', { ascending: true })
      .limit(2000);
    if (anonymousError && !isMissingTableError(anonymousError)) throw anonymousError;

    const anonymousMap = new Map<string, {
      id: string;
      user_id: string;
      title: string;
      created_at: string;
      updated_at: string;
      messages: MessageRow[];
    }>();
    for (const event of ((anonymousError ? [] : anonymousData || []) as AnalyticsEventRow[])) {
      const content = asText(event.metadata?.content);
      if (keyword && !content.includes(keyword)) continue;
      const batchId = asText(event.metadata?.batchId);
      const anonymousVisitorId = asText(event.metadata?.anonymousVisitorId);
      const anonymousConversationId = asText(event.metadata?.anonymousConversationId);
      const sessionId = event.session_id || 'unknown';
      const id = anonymousConversationId
        ? `anon:${anonymousConversationId}`
        : `anon:${sessionId}:${batchId || 'conversation'}`;
      const createdAt = event.created_at || new Date().toISOString();
      const conversation = anonymousMap.get(id) || {
        id,
        user_id: anonymousVisitorId ? `anonymous:${anonymousVisitorId}` : `anonymous:${sessionId.slice(-8)}`,
        title: '匿名内测对话',
        created_at: createdAt,
        updated_at: createdAt,
        messages: [],
      };
      conversation.updated_at = createdAt;
      conversation.messages.push({
        id: `${id}:${conversation.messages.length}`,
        conversation_id: id,
        role: asText(event.metadata?.role) || 'unknown',
        content,
        created_at: createdAt,
      });
      anonymousMap.set(id, conversation);
    }

    const anonymousConversations = Array.from(anonymousMap.values())
      .map((conv) => ({ ...conv, message_count: conv.messages.length }))
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
      .slice(0, limit);

    return NextResponse.json({
      ok: true,
      conversations: [...anonymousConversations, ...savedConversations].slice(0, limit),
      warning: messagesWarning || (missingConversations ? 'conversations 表暂时不可用，已登录原始对话为空。' : null),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load raw conversations';
    const status = /forbidden|authorization|token/i.test(message) ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
