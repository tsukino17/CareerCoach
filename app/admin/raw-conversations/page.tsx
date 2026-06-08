'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

type RawMessage = {
  id: string;
  conversation_id: string;
  role: string;
  content: string;
  created_at: string;
};

type RawConversation = {
  id: string;
  user_id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
  message_count: number;
  messages: RawMessage[];
};

export default function AdminRawConversationsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [keyword, setKeyword] = useState('');
  const [userId, setUserId] = useState('');
  const [rows, setRows] = useState<RawConversation[]>([]);
  const [warning, setWarning] = useState<string | null>(null);

  const query = useMemo(() => {
    const params = new URLSearchParams();
    params.set('limit', '40');
    if (keyword.trim()) params.set('keyword', keyword.trim());
    if (userId.trim()) params.set('user_id', userId.trim());
    return params.toString();
  }, [keyword, userId]);

async function load() {
    setLoading(true);
    setError(null);
    setWarning(null);
    try {
      const { data: authData } = await supabase.auth.getSession();
      const token = authData.session?.access_token;
      const res = await fetch(`/api/admin/raw-conversations?${query}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `加载失败（${res.status}）`);
      setRows(Array.isArray(json.conversations) ? json.conversations : []);
      setWarning(typeof json.warning === 'string' ? json.warning : null);
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [query]);

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="mx-auto max-w-6xl space-y-4">
        <header className="rounded-2xl border border-slate-200 bg-white p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">管理员 · 原始对话数据</h1>
              <p className="mt-2 text-sm text-slate-500">仅管理员可见。请勿导出或传播任何可识别用户隐私的信息。</p>
            </div>
            <Link href="/admin" className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 hover:bg-slate-100">
              返回看板
            </Link>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="关键词过滤（标题或内容）"
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-sky-400"
            />
            <input
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              placeholder="按 user_id 过滤"
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-sky-400"
            />
            <button
              type="button"
              onClick={() => void load()}
              className="rounded-xl bg-sky-500 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-600"
            >
              刷新数据
            </button>
          </div>
        </header>

        {loading ? <p className="text-slate-500">加载中...</p> : null}
        {warning ? <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-700">{warning}</p> : null}
        {error ? <p className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-600">{error}</p> : null}

        {!loading && !error && rows.length === 0 ? (
          <p className="rounded-xl border border-slate-200 bg-white p-6 text-slate-500">暂无匹配数据。</p>
        ) : null}

        <section className="space-y-4">
          {rows.map((row) => (
            <article key={row.id} className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg font-semibold text-slate-900">{row.title || '未命名对话'}</h2>
                <span className="text-xs text-slate-500">{new Date(row.created_at).toLocaleString()}</span>
              </div>
              <div className="mt-1 text-xs text-slate-500">
                user_id: {row.user_id} · 消息数: {row.message_count}
              </div>

              <div className="mt-4 space-y-2 rounded-xl border border-slate-100 bg-slate-50 p-3">
                {row.messages.length === 0 ? (
                  <p className="text-sm text-slate-500">无消息（可能因关键词过滤被筛掉）。</p>
                ) : (
                  row.messages.map((m) => (
                    <div key={m.id} className="rounded-lg bg-white p-3">
                      <div className="mb-1 text-xs text-slate-500">
                        {m.role} · {new Date(m.created_at).toLocaleString()}
                      </div>
                      <p className="whitespace-pre-wrap text-sm leading-6 text-slate-800">{m.content}</p>
                    </div>
                  ))
                )}
              </div>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
