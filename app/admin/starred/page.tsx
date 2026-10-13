'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Star, Download, Trash2, RefreshCw, Search } from 'lucide-react';
import {
  getStarredUsers,
  removeStarredUser,
  updateStarredUserNote,
  updateStarredUserTag,
  STAR_TAGS,
  TAG_COLORS,
  type StarredUser,
  type StarTag,
} from '@/lib/starred-users';

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

function formatTime(iso: string) {
  try {
    return new Date(iso).toLocaleString('zh-CN', { hour12: false });
  } catch {
    return iso;
  }
}

function exportUserConversations(userId: string, conversations: RawConversation[]) {
  const sorted = [...conversations].sort((a, b) => a.created_at.localeCompare(b.created_at));
  const totalMessages = sorted.reduce((sum, c) => sum + c.message_count, 0);
  const lines: string[] = [
    `用户ID：${userId}`,
    `对话总数：${sorted.length} 场`,
    `消息总数：${totalMessages} 条`,
    `导出时间：${formatTime(new Date().toISOString())}`,
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    '',
  ];

  sorted.forEach((conv, idx) => {
    lines.push(`【对话 ${idx + 1}】标题：${conv.title || '未命名对话'}`);
    lines.push(`创建时间：${formatTime(conv.created_at)}`);
    lines.push(`消息数：${conv.message_count}`);
    lines.push('─────────────────────────────────────────');
    conv.messages.forEach((m) => {
      const speaker = m.role === 'user' ? '用户' : m.role === 'assistant' ? '教练' : m.role;
      lines.push(`[${speaker}] ${formatTime(m.created_at)}`);
      lines.push(m.content);
      lines.push('');
    });
    lines.push('');
  });

  const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `用户对话_${userId.slice(0, 8)}_${new Date().toISOString().slice(0, 10)}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

type UserGroup = {
  userId: string;
  conversations: RawConversation[];
  loading: boolean;
};

export default function AdminStarredPage() {
  const [starredUsers, setStarredUsers] = useState<StarredUser[]>([]);
  const [userGroups, setUserGroups] = useState<Map<string, UserGroup>>(new Map());
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [expandedConv, setExpandedConv] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [filterTag, setFilterTag] = useState<StarTag | '全部'>('全部');
  const [editingNote, setEditingNote] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState('');

  const loadUserConversations = useCallback(async (userId: string) => {
    try {
      const { data: authData } = await supabase.auth.getSession();
      const token = authData.session?.access_token;
      const res = await fetch(`/api/admin/raw-conversations?user_id=${encodeURIComponent(userId)}&limit=100`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const json = await res.json();
      const conversations: RawConversation[] = json.conversations || [];
      setUserGroups((prev) => {
        const next = new Map(prev);
        next.set(userId, { userId, conversations, loading: false });
        return next;
      });
    } catch {
      setUserGroups((prev) => {
        const next = new Map(prev);
        next.set(userId, { userId, conversations: [], loading: false });
        return next;
      });
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const users = getStarredUsers();
    setStarredUsers(users);
    if (users.length === 0) {
      setUserGroups(new Map());
      setLoading(false);
      return;
    }

    setUserGroups(new Map(users.map((u) => [u.id, { userId: u.id, conversations: [], loading: true }])));
    await Promise.all(users.map((u) => loadUserConversations(u.id)));
    setLoading(false);
  }, [loadUserConversations]);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredUsers = useMemo(() => {
    let result = starredUsers;
    if (filterTag !== '全部') {
      result = result.filter((u) => u.tag === filterTag);
    }
    if (searchKeyword.trim()) {
      const kw = searchKeyword.trim().toLowerCase();
      result = result.filter(
        (u) => u.id.toLowerCase().includes(kw) || u.note.toLowerCase().includes(kw),
      );
    }
    return result;
  }, [starredUsers, filterTag, searchKeyword]);

  const tagCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const u of starredUsers) {
      counts[u.tag] = (counts[u.tag] || 0) + 1;
    }
    return counts;
  }, [starredUsers]);

  function clearAll() {
    if (!confirm('确定清空所有收藏吗？')) return;
    localStorage.removeItem('admin_starred_users');
    setStarredUsers([]);
    setUserGroups(new Map());
  }

  function handleRemoveStar(userId: string) {
    removeStarredUser(userId);
    setStarredUsers(getStarredUsers());
    const nextGroups = new Map(userGroups);
    nextGroups.delete(userId);
    setUserGroups(nextGroups);
  }

  function handleTagChange(userId: string, tag: StarTag) {
    updateStarredUserTag(userId, tag);
    setStarredUsers(getStarredUsers());
  }

  function handleNoteSave(userId: string) {
    updateStarredUserNote(userId, noteDraft.trim());
    setStarredUsers(getStarredUsers());
    setEditingNote(null);
    setNoteDraft('');
  }

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900">
              <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
              收藏的用户案例
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              已收藏 {starredUsers.length} 位用户
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void load()}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-600 hover:bg-slate-50"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              刷新
            </button>
            {starredUsers.length > 0 ? (
              <button
                type="button"
                onClick={clearAll}
                className="flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs text-rose-600 hover:bg-rose-100"
              >
                <Trash2 className="h-3.5 w-3.5" />
                清空
              </button>
            ) : null}
          </div>
        </div>

        {/* 筛选栏 */}
        {starredUsers.length > 0 ? (
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
            <div className="flex items-center gap-1.5">
              <Search className="h-3.5 w-3.5 text-slate-400" />
              <input
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                placeholder="搜索用户ID或备注"
                className="w-48 rounded-lg border border-slate-200 px-2.5 py-1 text-xs text-slate-700 outline-none focus:border-indigo-400"
              />
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setFilterTag('全部')}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                  filterTag === '全部'
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                全部 ({starredUsers.length})
              </button>
              {STAR_TAGS.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => setFilterTag(tag)}
                  className={`rounded-md border px-2.5 py-1 text-xs font-medium transition ${
                    filterTag === tag
                      ? TAG_COLORS[tag]
                      : 'border-transparent text-slate-500 hover:bg-slate-100'
                  }`}
                >
                  {tag} ({tagCounts[tag] || 0})
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </section>

      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
          正在加载收藏用户的所有对话...
        </div>
      ) : null}

      {!loading && starredUsers.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
          暂无收藏用户。去「原始对话」页面点击星标收藏有价值的用户，该用户的所有对话都会出现在这里。
        </div>
      ) : null}

      {!loading && starredUsers.length > 0 && filteredUsers.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
          没有匹配筛选条件的用户。
        </div>
      ) : null}

      <div className="space-y-4">
        {filteredUsers.map((starredUser) => {
          const group = userGroups.get(starredUser.id);
          const conversations = group?.conversations || [];
          const isUserExpanded = expandedUser === starredUser.id;
          const totalMessages = conversations.reduce((sum, c) => sum + c.message_count, 0);
          const isEditingNote = editingNote === starredUser.id;
          return (
            <article key={starredUser.id} className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                    <h3 className="text-sm font-semibold text-slate-900">{starredUser.id.slice(0, 12)}...</h3>
                    <select
                      value={starredUser.tag}
                      onChange={(e) => handleTagChange(starredUser.id, e.target.value as StarTag)}
                      className={`rounded-full border px-2 py-0.5 text-xs ${TAG_COLORS[starredUser.tag]}`}
                    >
                      {STAR_TAGS.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {group?.loading ? '加载中...' : `${conversations.length} 场对话 · ${totalMessages} 条消息`}
                    {starredUser.starredAt ? ` · 收藏于 ${new Date(starredUser.starredAt).toLocaleDateString('zh-CN')}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {conversations.length > 0 ? (
                    <button
                      type="button"
                      onClick={() => exportUserConversations(starredUser.id, conversations)}
                      className="flex items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-100"
                    >
                      <Download className="h-3.5 w-3.5" />
                      导出全部对话
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => setExpandedUser(isUserExpanded ? null : starredUser.id)}
                    className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50"
                  >
                    {isUserExpanded ? '收起' : '展开'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRemoveStar(starredUser.id)}
                    className="shrink-0 rounded-lg p-1.5 text-amber-400 hover:bg-rose-50 hover:text-rose-500"
                    title="取消收藏该用户"
                  >
                    <Star className="h-4 w-4 fill-amber-400" />
                  </button>
                </div>
              </div>

              {/* 备注行 */}
              <div className="mt-2">
                {isEditingNote ? (
                  <div className="flex items-center gap-2">
                    <input
                      value={noteDraft}
                      onChange={(e) => setNoteDraft(e.target.value)}
                      placeholder="输入备注..."
                      className="flex-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs text-slate-700 outline-none focus:border-indigo-400"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => handleNoteSave(starredUser.id)}
                      className="rounded-md bg-indigo-600 px-2 py-1 text-xs font-medium text-white hover:bg-indigo-700"
                    >
                      保存
                    </button>
                    <button
                      type="button"
                      onClick={() => { setEditingNote(null); setNoteDraft(''); }}
                      className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-500 hover:bg-slate-50"
                    >
                      取消
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => { setEditingNote(starredUser.id); setNoteDraft(starredUser.note); }}
                    className="text-xs text-slate-500 hover:text-indigo-600"
                  >
                    {starredUser.note ? (
                      <span className="rounded bg-slate-100 px-2 py-0.5">{starredUser.note}</span>
                    ) : (
                      '+ 添加备注'
                    )}
                  </button>
                )}
              </div>

              {isUserExpanded && !group?.loading ? (
                <div className="mt-4 space-y-3">
                  {conversations.length === 0 ? (
                    <p className="text-sm text-slate-500">该用户暂无对话数据。</p>
                  ) : (
                    conversations.map((conv) => {
                      const isConvExpanded = expandedConv === conv.id;
                      return (
                        <div key={conv.id} className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                          <button
                            type="button"
                            onClick={() => setExpandedConv(isConvExpanded ? null : conv.id)}
                            className="flex w-full items-center justify-between gap-2 text-left"
                          >
                            <div className="min-w-0 flex-1">
                              <h4 className="truncate text-sm font-medium text-slate-800">
                                <span className="mr-1 text-slate-400">{isConvExpanded ? '▾' : '▸'}</span>
                                {conv.title || '未命名对话'}
                              </h4>
                              <p className="mt-0.5 text-xs text-slate-500">{conv.message_count} 条消息</p>
                            </div>
                            <span className="text-xs text-slate-500">{new Date(conv.created_at).toLocaleString('zh-CN')}</span>
                          </button>
                          {isConvExpanded ? (
                            <div className="mt-3 space-y-3">
                              {conv.messages.map((m) => {
                                const isUser = m.role === 'user';
                                return (
                                  <div key={m.id} className="flex justify-start">
                                    <div
                                      className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${
                                        isUser
                                          ? 'bg-sky-50 border border-sky-100'
                                          : 'bg-violet-50 border border-violet-100'
                                      }`}
                                    >
                                      <div className="mb-1 flex items-center gap-2">
                                        <span className={`text-xs font-medium ${isUser ? 'text-sky-600' : 'text-violet-600'}`}>
                                          {isUser ? '用户' : '教练'}
                                        </span>
                                        <span className="text-xs text-slate-400">{formatTime(m.created_at)}</span>
                                      </div>
                                      <p className="whitespace-pre-wrap text-sm leading-6 text-slate-800">{m.content}</p>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          ) : null}
                        </div>
                      );
                    })
                  )}
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
    </div>
  );
}
