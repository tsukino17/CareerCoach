'use client';

import { authHeaders } from '@/lib/api-auth';
import { useMemo, useRef, useState, useEffect } from 'react';
import Link from 'next/link';

export default function ActionCoachEntryPage() {
  const [messages, setMessages] = useState<Array<{ 
    role: 'user' | 'assistant'; 
    content: string;
    isVoice?: boolean;
    transcript?: string;
  }>>([
    {
      role: 'assistant',
      content:
        '我在这里。你不需要被催促，我们只需要把今天发生的事实轻轻放在光下。\n\n你愿意先从一句“今天我做了什么/我感觉如何”开始吗？',
    },
  ]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isVoiceEnabled, setIsVoiceEnabled] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  // Web Speech API for Recording
  const recognitionRef = useRef<any>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        recognitionRef.current = new SpeechRecognition();
        recognitionRef.current.continuous = false;
        recognitionRef.current.interimResults = false;
        recognitionRef.current.lang = 'zh-CN';

        recognitionRef.current.onresult = (event: any) => {
          const transcript = event.results[0][0].transcript;
          handleVoiceSend(transcript);
        };

        recognitionRef.current.onerror = (event: any) => {
          console.error('Speech recognition error', event.error);
          setIsRecording(false);
          setError('录音识别失败，请重试。');
        };

        recognitionRef.current.onend = () => {
          setIsRecording(false);
        };
      }
      audioRef.current = new Audio();
    }
  }, [messages]);

  const speak = async (text: string) => {
    if (!isVoiceEnabled) return;
    
    try {
      const res = await fetch('/api/coach/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
        body: JSON.stringify({ text }),
      });
      
      if (!res.ok) throw new Error('TTS failed');
      
      const { audioContent } = await res.json();
      if (audioRef.current && audioContent) {
        audioRef.current.src = `data:audio/mp3;base64,${audioContent}`;
        audioRef.current.play();
      }
    } catch (err) {
      console.error('TTS Error:', err);
      // Fallback to basic web speech
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'zh-CN';
      window.speechSynthesis.speak(utterance);
    }
  };

  const toggleRecording = () => {
    if (isRecording) {
      recognitionRef.current?.stop();
      setIsRecording(false);
    } else {
      setError(null);
      try {
        recognitionRef.current?.start();
        setIsRecording(true);
      } catch (err) {
        console.error('Start recording error:', err);
        setError('无法启动麦克风，请检查权限。');
      }
    }
  };

  const handleVoiceSend = async (transcript: string) => {
    if (!transcript.trim() || isSending) return;
    setIsSending(true);

    const nextMessages = [
      ...messages, 
      { role: 'user' as const, content: transcript, isVoice: true, transcript: transcript }
    ];
    setMessages(nextMessages);
    queueMicrotask(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }));

    await callChatApi(nextMessages);
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isSending) return;
    setIsSending(true);
    setInput('');

    const nextMessages = [...messages, { role: 'user' as const, content: text }];
    setMessages(nextMessages);
    queueMicrotask(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }));

    await callChatApi(nextMessages);
  };

  const callChatApi = async (currentMessages: any[]) => {
    try {
      const res = await fetch('/api/coach/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
        body: JSON.stringify({ messages: currentMessages, modelType: 'gemini' }),
      });
      if (!res.ok) throw new Error('Chat API failed');
      const data = await res.json();
      const reply = data.reply || '我在听，请继续。';
      
      setMessages((prev) => [...prev, { role: 'assistant', content: reply }]);
      speak(reply);
      queueMicrotask(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }));
    } catch (err) {
      setError('连接教练失败，请稍后重试。');
    } finally {
      setIsSending(false);
    }
  };

  const canSend = useMemo(() => input.trim().length > 0 && !isSending, [input, isSending]);

  return (
    <main style={{ minHeight: '100vh', background: 'linear-gradient(135deg,#F3F8FF 0%, #FFFFFF 55%, #F7FBFF 100%)' }}>
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '18px 16px 18px' }}>
        <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: 10, letterSpacing: 2, color: 'rgba(74,104,140,0.5)', textTransform: 'uppercase' }}>Action Coach</span>
            <h1 style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', marginTop: 4 }}>行动力教练</h1>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <button 
              onClick={() => setIsVoiceEnabled(!isVoiceEnabled)}
              style={{
                padding: '8px 12px',
                borderRadius: 999,
                fontSize: 12,
                fontWeight: 600,
                border: '1px solid rgba(134,184,255,0.2)',
                background: isVoiceEnabled ? 'rgba(134,184,255,0.15)' : 'rgba(255,255,255,0.5)',
                color: 'rgba(74,104,140,0.9)',
                cursor: 'pointer'
              }}
            >
              {isVoiceEnabled ? '语音播报已开' : '语音播报已关'}
            </button>
            <Link href="/coach/action/vision" style={{ textDecoration: 'none', fontSize: 13, fontWeight: 700, color: 'rgba(74,104,140,0.95)', padding: '8px 12px', borderRadius: 999, background: 'rgba(134,184,255,0.14)', border: '1px solid rgba(134,184,255,0.35)' }}>身份愿景板</Link>
          </div>
        </header>

        <div style={{ 
          height: 'calc(100vh - 140px)', 
          display: 'flex', 
          flexDirection: 'column',
          background: 'rgba(255,255,255,0.4)',
          borderRadius: 24,
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(134,184,255,0.1)',
          padding: 16,
          boxShadow: '0 20px 50px rgba(0,0,0,0.03)'
        }}>
          <div style={{ flex: 1, overflowY: 'auto', paddingRight: 8 }}>
            {messages.map((m, idx) => (
              <div key={idx} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start', marginBottom: 16 }}>
                <div style={{ 
                  maxWidth: '80%', 
                  padding: '12px 16px', 
                  borderRadius: 20,
                  borderTopRightRadius: m.role === 'user' ? 4 : 20,
                  borderTopLeftRadius: m.role === 'assistant' ? 4 : 20,
                  background: m.role === 'user' ? 'rgba(134,184,255,0.15)' : 'white',
                  border: '1px solid rgba(134,184,255,0.05)',
                  boxShadow: '0 4px 15px rgba(0,0,0,0.02)',
                  color: 'rgba(62,79,106,0.9)',
                  fontSize: 14,
                  lineHeight: 1.7
                }}>
                  {m.isVoice && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, opacity: 0.7 }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
                      <div style={{ height: 2, flex: 1, background: 'linear-gradient(90deg, currentColor 0%, transparent 100%)', borderRadius: 1 }} />
                    </div>
                  )}
                  {m.content}
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          <div style={{ marginTop: 12, display: 'flex', alignItems: 'flex-end', gap: 10 }}>
            <div style={{ flex: 1, position: 'relative' }}>
              <textarea 
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="写下事实和感受..."
                rows={2}
                style={{
                  width: '100%',
                  padding: '12px 40px 12px 12px',
                  borderRadius: 16,
                  border: '1px solid rgba(134,184,255,0.2)',
                  background: 'rgba(255,255,255,0.8)',
                  outline: 'none',
                  fontSize: 14,
                  color: 'rgba(62,79,106,0.9)',
                  resize: 'none'
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
              />
              <button 
                onClick={toggleRecording}
                style={{
                  position: 'absolute',
                  right: 10,
                  bottom: 12,
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: isRecording ? '#ef4444' : 'rgba(74,104,140,0.5)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                {isRecording ? (
                  <div style={{ width: 12, height: 12, borderRadius: 2, background: 'currentColor', animation: 'pulse 1s infinite' }} />
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
                )}
              </button>
            </div>
            <button 
              onClick={handleSend}
              disabled={!canSend}
              style={{
                minWidth: 80,
                height: 44,
                borderRadius: 16,
                background: canSend ? 'rgba(134,184,255,0.2)' : 'rgba(0,0,0,0.05)',
                color: canSend ? 'rgba(74,104,140,0.95)' : 'rgba(0,0,0,0.2)',
                border: 'none',
                fontWeight: 700,
                fontSize: 14,
                cursor: canSend ? 'pointer' : 'default'
              }}
            >
              发送
            </button>
          </div>
          {error && <div style={{ color: '#ef4444', fontSize: 12, marginTop: 8, textAlign: 'center' }}>{error}</div>}
        </div>
      </div>
      <style jsx>{`
        @keyframes pulse {
          0% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.2); opacity: 0.7; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </main>
  );
}
