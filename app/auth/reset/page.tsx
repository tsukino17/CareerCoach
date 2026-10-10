'use client';

import { FormEvent, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function PasswordResetPage() {
  const [password, setPassword] = useState('');
  const [ready, setReady] = useState(false);
  const [message, setMessage] = useState('正在验证重置链接…');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setReady(Boolean(data.session));
      setMessage(data.session ? '请输入新密码。' : '重置链接已过期或无效，请重新发送重置邮件。');
    });
    return () => { active = false; };
  }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password });
    setMessage(error ? error.message : '密码已更新，请返回登录。');
    setSaving(false);
    if (!error) setReady(false);
  };

  return <main className="min-h-screen bg-slate-50 px-4 py-16"><div className="mx-auto max-w-md rounded-2xl bg-white p-6 shadow-xl"><h1 className="text-xl font-semibold text-slate-900">重置 EchoTalent 密码</h1><p className="mt-2 text-sm text-slate-600">{message}</p>{ready ? <form onSubmit={submit} className="mt-6 space-y-4"><input required minLength={6} type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="请输入新密码" className="w-full rounded-xl border border-slate-200 px-4 py-3" /><button disabled={saving} className="w-full rounded-xl bg-slate-900 px-4 py-3 text-white">{saving ? '更新中…' : '更新密码'}</button></form> : <a href="/" className="mt-6 inline-block text-sm text-sky-700 underline">返回首页</a>}</div></main>;
}
