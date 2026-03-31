'use client';

import { useMemo, useRef, useState } from 'react';
import Link from 'next/link';

export default function ActionCoachEntryPage() {
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([
    {
      role: 'assistant',
      content:
        '我在这里。你不需要被催促，我们只需要把今天发生的事实轻轻放在光下。\n\n你愿意先从一句“今天我做了什么/我感觉如何”开始吗？',
    },
  ]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const canSend = useMemo(() => input.trim().length > 0 && !isSending, [input, isSending]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isSending) return;
    setError(null);
    setIsSending(true);
    setInput('');

    const nextMessages = [...messages, { role: 'user' as const, content: text }];
    setMessages(nextMessages);
    queueMicrotask(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }));

    try {
      const res = await fetch('/api/coach/action/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: nextMessages }),
      });
      if (!res.ok) throw new Error('request_failed');
      const data = (await res.json()) as { reply?: string };
      const reply = typeof data.reply === 'string' && data.reply.trim() ? data.reply.trim() : '我在。你愿意多说一句吗？';
      setMessages((prev) => [...prev, { role: 'assistant', content: reply }]);
      queueMicrotask(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }));
    } catch {
      setError('发送失败，请稍后重试。');
      setMessages((prev) => [...prev, { role: 'assistant', content: '我刚刚没能收到你的消息，但我还在。要不要再发一次？' }]);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <main style={{ minHeight: '100vh', background: 'linear-gradient(135deg,#F3F8FF 0%, #FFFFFF 55%, #F7FBFF 100%)' }}>
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '18px 16px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div
              style={{
                fontSize: 12,
                letterSpacing: 2,
                textTransform: 'uppercase',
                color: 'rgba(15,23,42,0.55)',
                lineHeight: 1.1,
              }}
            >
              Action Coach
            </div>
            <h1 style={{ marginTop: 4, fontSize: 22, fontWeight: 800, color: '#0f172a', lineHeight: 1.15 }}>行动力教练</h1>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'flex-end' }}>
            <Link
              href="/coach/action/vision"
              style={{
                display: 'inline-block',
                padding: '8px 12px',
                borderRadius: 999,
                border: '1px solid rgba(134,184,255,0.35)',
                background: 'rgba(134,184,255,0.14)',
                color: 'rgba(74,104,140,0.95)',
                textDecoration: 'none',
                fontWeight: 700,
                fontSize: 13,
              }}
            >
              身份愿景板
            </Link>
            <Link href="/user" aria-label="用户中心" style={{ display: 'inline-flex', textDecoration: 'none' }}>
              <span
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 999,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '1px solid rgba(134,184,255,0.35)',
                  background: 'rgba(255,255,255,0.50)',
                  boxShadow: '0 8px 24px rgba(15,23,42,0.06)',
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M20 21a8 8 0 0 0-16 0"
                    stroke="rgba(134,184,255,0.95)"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  />
                  <path
                    d="M12 13a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z"
                    stroke="rgba(134,184,255,0.95)"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
            </Link>
          </div>
        </div>

        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', height: 'calc(100vh - 92px)' }}>
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: 14,
              borderRadius: 20,
              border: '1px solid rgba(134,184,255,0.10)',
              background:
                'radial-gradient(920px 560px at 0% 0%, rgba(134,184,255,0.14) 0%, rgba(134,184,255,0.00) 62%), radial-gradient(860px 560px at 100% 100%, rgba(187,217,255,0.08) 0%, rgba(187,217,255,0.00) 60%), rgba(255,255,255,0.64)',
              backdropFilter: 'blur(14px)',
              WebkitBackdropFilter: 'blur(14px)',
              boxShadow:
                '0 18px 55px rgba(15,23,42,0.07), inset 0 1px 0 rgba(255,255,255,0.70), inset 0 -1px 0 rgba(15,23,42,0.03)',
            }}
          >
            {messages.map((m, idx) => (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start',
                  marginBottom: 10,
                }}
              >
                <div
                  style={{
                    maxWidth: '86%',
                    padding: '12px 14px',
                    borderRadius: 16,
                    borderTopRightRadius: m.role === 'user' ? 6 : 16,
                    borderTopLeftRadius: m.role === 'assistant' ? 6 : 16,
                    background:
                      m.role === 'user'
                        ? 'linear-gradient(180deg, rgba(134,184,255,0.20) 0%, rgba(134,184,255,0.10) 100%)'
                        : 'linear-gradient(180deg, rgba(255,255,255,0.92) 0%, rgba(255,255,255,0.78) 100%)',
                    border: '1px solid rgba(134,184,255,0.08)',
                    boxShadow: '0 8px 20px rgba(15,23,42,0.05), inset 0 1px 0 rgba(255,255,255,0.55)',
                    color: 'rgba(62,79,106,0.88)',
                    whiteSpace: 'pre-wrap',
                    lineHeight: 1.7,
                    fontSize: 14,
                  }}
                >
                  {m.content}
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          <div style={{ marginTop: 16, display: 'grid', gap: 10 }}>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="写下今天的一个事实 + 一个感受（可以很短）。"
              rows={2}
              style={{
                width: '100%',
                resize: 'vertical',
                borderRadius: 18,
                border: '1px solid rgba(134,184,255,0.10)',
                padding: 12,
                outline: 'none',
                background:
                  'radial-gradient(900px 240px at 0% 0%, rgba(134,184,255,0.10) 0%, rgba(134,184,255,0.00) 60%), rgba(255,255,255,0.74)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                color: 'rgba(62,79,106,0.88)',
                lineHeight: 1.7,
                fontSize: 14,
                boxShadow:
                  '0 14px 40px rgba(15,23,42,0.07), inset 0 1px 0 rgba(255,255,255,0.70), inset 0 -1px 0 rgba(15,23,42,0.03)',
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  handleSend();
                }
              }}
            />

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
              <button
                type="button"
                onClick={handleSend}
                disabled={!canSend}
                style={{
                  padding: '9px 18px',
                  borderRadius: 999,
                  background: canSend
                    ? 'linear-gradient(180deg, rgba(134,184,255,0.22) 0%, rgba(134,184,255,0.14) 100%)'
                    : 'rgba(134,184,255,0.08)',
                  border: '1px solid rgba(134,184,255,0.22)',
                  color: 'rgba(74,104,140,0.95)',
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: canSend ? 'pointer' : 'not-allowed',
                  boxShadow: canSend ? '0 10px 22px rgba(134,184,255,0.14), inset 0 1px 0 rgba(255,255,255,0.55)' : undefined,
                  minWidth: 104,
                  marginLeft: 'auto',
                }}
              >
                {isSending ? '发送中…' : '发送'}
              </button>
            </div>

            {error && <div style={{ color: 'rgba(220,38,38,0.85)', fontSize: 13 }}>{error}</div>}
          </div>
        </div>
      </div>
    </main>
  );
}
