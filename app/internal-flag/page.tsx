'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { INTERNAL_DEVICE_STORAGE_KEY } from '@/lib/analytics-internal';

type Status = 'idle' | 'applying' | 'enabled' | 'clearing' | 'disabled' | 'invalid';

function InternalFlagPanel() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';
  const [status, setStatus] = useState<Status>('idle');
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    if (!token) {
      setStatus('invalid');
      return;
    }

    let cancelled = false;
    setStatus('applying');
    fetch('/api/analytics/internal-flag', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, enabled: true }),
    })
      .then(async (response) => {
        if (!response.ok) throw new Error('invalid');
        if (cancelled) return;
        window.localStorage.setItem(INTERNAL_DEVICE_STORAGE_KEY, '1');
        window.history.replaceState({}, '', '/internal-flag');
        setStatus('enabled');
      })
      .catch(() => {
        if (!cancelled) setStatus('invalid');
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  const clearFlag = useCallback(async () => {
    if (!token) return;
    setStatus('clearing');
    try {
      const response = await fetch('/api/analytics/internal-flag', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, enabled: false }),
      });
      if (!response.ok) throw new Error('invalid');
      window.localStorage.removeItem(INTERNAL_DEVICE_STORAGE_KEY);
      setStatus('disabled');
    } catch {
      setStatus('invalid');
    }
  }, [token]);

  const message = {
    idle: '正在校验内部设备链接…',
    applying: '正在校验内部设备链接…',
    enabled: '当前浏览器已被标记为内部设备。之后产生的访问事件会正常写入，但不会进入周报和后台统计。',
    clearing: '正在取消内部设备标记…',
    disabled: '已取消当前浏览器的内部设备标记。',
    invalid: '链接无效或令牌缺失。当前浏览器不会被标记，也不会设置任何内部标记。',
  }[status];

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6 py-12">
      <section className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">EchoTalent Analytics</p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900">内部设备标记</h1>
        <p className="mt-4 text-sm leading-7 text-slate-600">{message}</p>

        {status === 'enabled' ? (
          <button
            type="button"
            onClick={clearFlag}
            className="mt-6 rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
          >
            取消内部设备标记
          </button>
        ) : null}

        <p className="mt-6 text-xs leading-6 text-slate-400">
          内部设备标记只影响统计口径，不会删除或改写任何已写入的分析事件。令牌由环境变量
          ANALYTICS_INTERNAL_TOKEN 控制，轮换令牌即可作废旧链接。
        </p>
      </section>
    </main>
  );
}

export default function InternalFlagPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-slate-50" />}>
      <InternalFlagPanel />
    </Suspense>
  );
}
