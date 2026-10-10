'use client';

import { authHeaders } from '@/lib/api-auth';
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Volume2, VolumeX } from 'lucide-react';

type Msg = {
  role: 'user' | 'assistant';
  content: string;
};

type SpeechRecognitionAlternativeLike = {
  transcript?: string;
};

type SpeechRecognitionResultLike = {
  isFinal?: boolean;
  0?: SpeechRecognitionAlternativeLike;
};

type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
};

type SpeechRecognitionErrorEventLike = {
  error?: string;
};

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEventLike) => void | Promise<void>) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function splitSpeechText(text: string) {
  return text
    .replace(/\s+/g, ' ')
    .split(/(?<=[。！？!?,，；;：:])/)
    .map((chunk) => chunk.trim())
    .filter(Boolean);
}

function pickNaturalChineseVoice(voices: SpeechSynthesisVoice[]) {
  const ranked = [...voices].sort((a, b) => {
    const score = (voice: SpeechSynthesisVoice) => {
      const name = `${voice.name} ${voice.lang}`.toLowerCase();
      let value = 0;
      if (name.includes('zh-cn') || name.includes('cmn-cn')) value += 6;
      if (name.includes('xiaoxiao')) value += 8;
      if (name.includes('xiaoyi')) value += 7;
      if (name.includes('yunxi')) value += 6;
      if (name.includes('female') || name.includes('woman')) value += 2;
      if (name.includes('natural')) value += 3;
      if (name.includes('premium')) value += 3;
      if (name.includes('enhanced')) value += 2;
      if (name.includes('google')) value += 2;
      if (name.includes('microsoft')) value += 2;
      if (name.includes('tingting')) value += 4;
      return value;
    };
    return score(b) - score(a);
  });

  return ranked[0] || null;
}

export default function InspirationModePage() {
  const ORB_SIZE = 258;
  const [isListening, setIsListening] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [interimText, setInterimText] = useState('');
  const [hintText, setHintText] = useState('');
  const [showHint, setShowHint] = useState(false);
  const [welcomeText, setWelcomeText] = useState('');
  const [welcomeStage, setWelcomeStage] = useState<'typing' | 'fade' | 'hidden'>('typing');
  const [lastReply, setLastReply] = useState('');
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const synthVoiceRef = useRef<SpeechSynthesisVoice | null>(null);
  const speechQueueRef = useRef<SpeechSynthesisUtterance[]>([]);
  const speechReadyRef = useRef(false);
  const historyRef = useRef<Msg[]>([
    {
      role: 'assistant',
      content: '欢迎来到灵感模式。先不用急着整理思绪。让肩膀慢慢放松，吸气四拍，再轻轻呼出去。准备好了，我们就开始这段语音旅程。',
    },
  ]);
  const hintTimerRef = useRef<number | null>(null);
  const welcomeTimerRef = useRef<number | null>(null);
  const welcomeTypingRef = useRef<number | null>(null);
  const WELCOME_FULL_TEXT =
    '你来到这里，不是为了把答案立刻想明白，而是给自己留一点慢下来的空间。在灵感模式里，我们会先听见身体，再靠近情绪，然后从那些细小的感觉里，接住属于你的灵感。';

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const recognitionHost = window as Window & {
      SpeechRecognition?: SpeechRecognitionCtor;
      webkitSpeechRecognition?: SpeechRecognitionCtor;
    };
    const SpeechRecognition = recognitionHost.SpeechRecognition || recognitionHost.webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = 'zh-CN';

      recognitionRef.current.onresult = async (event: SpeechRecognitionEventLike) => {
        let interim = '';
        let finalText = '';
        for (let i = event.resultIndex; i < event.results.length; i += 1) {
          const text = String(event.results[i]?.[0]?.transcript || '');
          if (event.results[i].isFinal) finalText += text;
          else interim += text;
        }
        setInterimText(interim.trim());
        if (finalText.trim()) {
          setIsListening(false);
          setInterimText('');
          await handleVoiceTurn(finalText.trim());
        }
      };

      recognitionRef.current.onerror = (event: SpeechRecognitionErrorEventLike) => {
        setIsListening(false);
        if (event.error === 'network') {
          setError('语音识别网络异常，请稍后重试或切换网络。');
          return;
        }
        if (event.error === 'not-allowed') {
          setError('麦克风权限未开启，请先允许浏览器访问麦克风。');
          return;
        }
        setError('语音识别失败，请重试。');
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
    } else {
      setError('当前浏览器不支持语音识别，请使用 Chrome 或 Edge。');
    }

    audioRef.current = new Audio();

    const loadVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      if (!voices.length) return;
      synthVoiceRef.current = pickNaturalChineseVoice(voices);
      speechReadyRef.current = true;
    };

    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;

    return () => {
      window.speechSynthesis.onvoiceschanged = null;
      window.speechSynthesis.cancel();
      audioRef.current?.pause();
    };
  }, []);

  useEffect(() => {
    return () => {
      if (hintTimerRef.current) {
        window.clearTimeout(hintTimerRef.current);
      }
      if (welcomeTimerRef.current) {
        window.clearTimeout(welcomeTimerRef.current);
      }
      if (welcomeTypingRef.current) {
        window.clearInterval(welcomeTypingRef.current);
      }
    };
  }, []);

  useEffect(() => {
    let index = 0;
    welcomeTypingRef.current = window.setInterval(() => {
      index += 1;
      setWelcomeText(WELCOME_FULL_TEXT.slice(0, index));
      if (index >= WELCOME_FULL_TEXT.length) {
        if (welcomeTypingRef.current) {
          window.clearInterval(welcomeTypingRef.current);
          welcomeTypingRef.current = null;
        }
        welcomeTimerRef.current = window.setTimeout(() => {
          setWelcomeStage('fade');
          welcomeTimerRef.current = window.setTimeout(() => {
            setWelcomeStage('hidden');
          }, 1200);
        }, 2000);
      }
    }, 85);

    return () => {
      if (welcomeTimerRef.current) {
        window.clearTimeout(welcomeTimerRef.current);
      }
      if (welcomeTypingRef.current) {
        window.clearInterval(welcomeTypingRef.current);
      }
    };
  }, []);

  const orbStyle = useMemo(() => {
    if (isListening) return 'listening';
    if (isThinking || isSpeaking) return 'thinking';
    return 'idle';
  }, [isListening, isThinking, isSpeaking]);

  const speakWithBrowserVoice = async (text: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

    window.speechSynthesis.cancel();
    const voice = synthVoiceRef.current;
    const chunks = splitSpeechText(text);

    if (!chunks.length) return;

    setIsSpeaking(true);
    await new Promise<void>((resolve) => {
      let index = 0;

      const speakNext = () => {
        if (index >= chunks.length) {
          speechQueueRef.current = [];
          setIsSpeaking(false);
          resolve();
          return;
        }

        const utterance = new SpeechSynthesisUtterance(chunks[index]);
        utterance.lang = voice?.lang || 'zh-CN';
        utterance.voice = voice;
        utterance.rate = 0.92;
        utterance.pitch = 1.02;
        utterance.volume = 1;
        utterance.onend = () => {
          index += 1;
          window.setTimeout(speakNext, 120);
        };
        utterance.onerror = () => {
          index += 1;
          window.setTimeout(speakNext, 80);
        };

        speechQueueRef.current.push(utterance);
        window.speechSynthesis.speak(utterance);
      };

      speakNext();
    });
  };

  const speak = async (text: string) => {
    if (!voiceEnabled) return;
    try {
      if (!speechReadyRef.current) {
        const voices = window.speechSynthesis.getVoices();
        if (voices.length) {
          synthVoiceRef.current = pickNaturalChineseVoice(voices);
          speechReadyRef.current = true;
        }
      }

      const res = await fetch('/api/coach/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
        body: JSON.stringify({
          text,
          voiceStyle: 'inspiration',
          tuning: {
            speed: 0.92,
            emotion: 'gentle',
          },
        }),
      });
      const raw = await res.text();
      const parsed = JSON.parse(raw);
      if (!res.ok) throw new Error(parsed?.error || 'TTS failed');
      if (audioRef.current && parsed?.audioContent) {
        setIsSpeaking(true);
        audioRef.current.pause();
        audioRef.current.src = `data:audio/${parsed.audioType || 'wav'};base64,${parsed.audioContent}`;
        audioRef.current.load();
        audioRef.current.onended = () => setIsSpeaking(false);
        audioRef.current.onerror = () => setIsSpeaking(false);
        await audioRef.current.play();
        return;
      }
      throw new Error('Missing audio content');
    } catch {
      await speakWithBrowserVoice(text);
    } finally {
      if (!audioRef.current || audioRef.current.paused) {
        setIsSpeaking(false);
      }
    }
  };

  const handleVoiceTurn = async (transcript: string) => {
    setError(null);
    const nextHistory = [...historyRef.current, { role: 'user' as const, content: transcript }];
    historyRef.current = nextHistory;
    setIsThinking(true);

    try {
      const res = await fetch('/api/coach/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
        body: JSON.stringify({ messages: nextHistory, modelType: 'qwen', mode: 'inspiration' }),
      });
      const raw = await res.text();
      const data = JSON.parse(raw);
      if (!res.ok) throw new Error(data?.error || 'chat failed');

      const reply = String(data?.reply || '我在，你可以继续。');
      historyRef.current = [...historyRef.current, { role: 'assistant', content: reply }];
      setLastReply(reply);
      showTransientHint(reply, 6400);
      await speak(reply);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '连接失败，请稍后重试。');
    } finally {
      setIsThinking(false);
    }
  };

  const startListening = () => {
    if (!recognitionRef.current) {
      setError('当前设备不支持语音识别。');
      return;
    }
    setError(null);
    setInterimText('');
    window.speechSynthesis.cancel();
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setIsListening(true);
    try {
      recognitionRef.current.start();
    } catch {
      setIsListening(false);
      setError('麦克风还没准备好，请稍等一下再试。');
    }
  };

  const stopPlayback = () => {
    window.speechSynthesis.cancel();
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setIsSpeaking(false);
  };

  const toggleVoice = () => {
    if (voiceEnabled) stopPlayback();
    setVoiceEnabled((enabled) => !enabled);
  };

  const showTransientHint = (text: string, duration = 5600) => {
    setHintText(text);
    setShowHint(true);
    if (hintTimerRef.current) {
      window.clearTimeout(hintTimerRef.current);
    }
    hintTimerRef.current = window.setTimeout(() => {
      setShowHint(false);
      setHintText('');
    }, duration);
  };

  return (
    <main className="inspiration-shell">
      <div className="ambient-field" aria-hidden="true">
        <div className="depth depth-a" />
        <div className="depth depth-b" />
        <div className="depth depth-c" />
      </div>
      <div className="page-inner">
        <header className="topbar">
          <div>
            <div className="eyebrow">Inspiration Mode</div>
            <h1>灵感模式</h1>
          </div>
          <Link href="/coach/action" className="back-link">
            <ArrowLeft className="back-icon" size={13} strokeWidth={1.7} />
            <span>返回文字模式</span>
          </Link>
        </header>

        <section className="room">
          <div className="orb-zone">
            <div className="sound-halo" aria-hidden="true" />
            <div className={`orb ${orbStyle}`} />
          </div>

          <div className="reflection-area">
            {welcomeStage !== 'hidden' && (
              <div className={`welcome-hint ${welcomeStage === 'fade' ? 'fade-out' : ''}`}>
                {welcomeText}
              </div>
            )}
            {isListening && interimText && (
              <div className="interim-text">
                {interimText}
              </div>
            )}
            {showHint && hintText && (
              <div className="final-hint">{hintText}</div>
            )}
            {!showHint && lastReply && welcomeStage === 'hidden' && (
              <div className="last-reply">
                {lastReply}
              </div>
            )}
          </div>

          <div className="controls">
            <button
              type="button"
              className="voice-toggle"
              onClick={toggleVoice}
              aria-label={voiceEnabled ? '关闭语音' : '开启语音'}
              title={voiceEnabled ? '关闭语音' : '开启语音'}
            >
              {voiceEnabled ? <Volume2 size={17} strokeWidth={1.8} /> : <VolumeX size={17} strokeWidth={1.8} />}
            </button>
            <button
              type="button"
              onClick={startListening}
              disabled={isListening || isThinking || isSpeaking}
              className="listen-button"
            >
              {isListening ? '正在听你说...' : isThinking ? '正在慢慢整理...' : isSpeaking ? '先听完这一句...' : '开启灵感模式'}
            </button>
          </div>

          {error && (
            <div className="error-text">
              {error}
            </div>
          )}
        </section>
      </div>

      <style jsx>{`
        .inspiration-shell {
          position: relative;
          overflow: hidden;
          min-height: 100vh;
          background:
            radial-gradient(900px 380px at 50% 7%, rgba(242, 222, 237, 0.3), rgba(242, 222, 237, 0) 68%),
            radial-gradient(820px 420px at 18% 26%, rgba(151, 209, 234, 0.24), rgba(151, 209, 234, 0) 72%),
            radial-gradient(920px 460px at 82% 34%, rgba(185, 177, 236, 0.22), rgba(185, 177, 236, 0) 74%),
            linear-gradient(180deg, #6a80be 0%, #536ea8 31%, #3c5c91 64%, #2d4774 100%);
          color: rgba(239, 246, 255, 0.88);
        }
        .inspiration-shell::after {
          content: '';
          position: absolute;
          inset: 0;
          pointer-events: none;
          background-image:
            linear-gradient(rgba(255, 255, 255, 0.024) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255, 255, 255, 0.018) 1px, transparent 1px);
          background-size: 120px 120px;
          mask-image: radial-gradient(circle at 50% 38%, transparent 0%, rgba(0, 0, 0, 0.2) 58%, rgba(0, 0, 0, 0.64) 100%);
          opacity: 0.22;
        }
        .ambient-field {
          position: absolute;
          inset: 0;
          overflow: hidden;
          pointer-events: none;
        }
        .depth {
          position: absolute;
          left: 50%;
          top: 43%;
          border-radius: 999px;
          transform: translate(-50%, -50%);
          filter: blur(52px);
          opacity: 0.5;
          mix-blend-mode: screen;
        }
        .depth-a {
          width: min(74vw, 760px);
          height: min(74vw, 760px);
          background: radial-gradient(circle, rgba(224, 231, 255, 0.23) 0%, rgba(224, 231, 255, 0.1) 36%, rgba(224, 231, 255, 0) 70%);
          animation: field-drift 18s ease-in-out infinite alternate;
        }
        .depth-b {
          width: min(58vw, 560px);
          height: min(58vw, 560px);
          left: 36%;
          top: 52%;
          background: radial-gradient(circle, rgba(132, 204, 222, 0.14) 0%, rgba(132, 204, 222, 0.06) 42%, rgba(132, 204, 222, 0) 72%);
          animation: field-drift-b 22s ease-in-out infinite alternate;
        }
        .depth-c {
          width: min(64vw, 620px);
          height: min(64vw, 620px);
          left: 68%;
          top: 48%;
          background: radial-gradient(circle, rgba(246, 185, 219, 0.12) 0%, rgba(246, 185, 219, 0.05) 38%, rgba(246, 185, 219, 0) 72%);
          animation: field-drift-c 24s ease-in-out infinite alternate;
        }
        .page-inner {
          position: relative;
          z-index: 1;
          max-width: 980px;
          min-height: 100vh;
          min-height: 100svh;
          margin: 0 auto;
          padding: 18px 16px max(20px, env(safe-area-inset-bottom));
          box-sizing: border-box;
          display: flex;
          flex-direction: column;
        }
        .topbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
        }
        .eyebrow {
          font-size: 10px;
          letter-spacing: 2px;
          text-transform: uppercase;
          color: rgba(231, 239, 255, 0.34);
        }
        h1 {
          margin-top: 4px;
          font-size: 19px;
          font-weight: 700;
          color: rgba(244, 249, 255, 0.78);
        }
        :global(.back-link) {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          border: 1px solid rgba(235, 244, 255, 0.2);
          border-radius: 999px;
          background: rgba(235, 244, 255, 0.045);
          color: rgba(235, 243, 255, 0.54);
          text-decoration: none;
          font-size: 10px;
          font-weight: 500;
          letter-spacing: 0.1px;
          line-height: 1;
          padding: 6px 9px 6px 8px;
          transition: color 180ms ease, border-color 180ms ease, background 180ms ease;
        }
        :global(.back-icon) {
          flex: 0 0 auto;
        }
        :global(.back-link:hover) {
          color: rgba(248, 251, 255, 0.82);
          border-color: rgba(245, 249, 255, 0.32);
          background: rgba(245, 249, 255, 0.08);
        }
        .room {
          flex: 1;
          min-height: 0;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          padding: 8px 0 0;
        }
        .orb-zone {
          position: relative;
          display: grid;
          place-items: center;
          min-height: clamp(220px, 48vh, 340px);
          flex: 1;
        }
        .sound-halo {
          position: absolute;
          width: min(62vw, 520px);
          height: min(62vw, 520px);
          border-radius: 999px;
          background:
            radial-gradient(circle, rgba(255, 255, 255, 0) 44%, rgba(232, 240, 255, 0.08) 45%, rgba(232, 240, 255, 0) 46%),
            radial-gradient(circle, rgba(255, 255, 255, 0) 58%, rgba(217, 230, 255, 0.055) 59%, rgba(217, 230, 255, 0) 60%);
          filter: blur(1px);
          opacity: 0.6;
          animation: halo-breathe 9s ease-in-out infinite;
        }
        .orb {
          position: relative;
          width: ${ORB_SIZE}px;
          height: ${ORB_SIZE}px;
          border-radius: 999px;
          background:
            radial-gradient(circle at 41% 33%, rgba(255, 255, 255, 0.68) 0%, rgba(250, 248, 255, 0.5) 18%, rgba(232, 228, 255, 0.28) 38%, rgba(214, 204, 255, 0.13) 58%, rgba(214, 204, 255, 0.04) 75%, rgba(214, 204, 255, 0) 88%),
            radial-gradient(circle at 58% 66%, rgba(250, 180, 218, 0.23) 0%, rgba(250, 180, 218, 0.11) 30%, rgba(250, 180, 218, 0) 62%),
            radial-gradient(circle at 29% 66%, rgba(163, 216, 238, 0.22) 0%, rgba(163, 216, 238, 0.09) 34%, rgba(163, 216, 238, 0) 62%),
            radial-gradient(circle at 72% 32%, rgba(221, 237, 255, 0.18) 0%, rgba(221, 237, 255, 0.07) 24%, rgba(221, 237, 255, 0) 52%);
          filter: blur(5.5px);
          box-shadow: 
            0 0 120px rgba(232, 205, 255, 0.34), 
            0 0 290px rgba(154, 206, 241, 0.3);
          animation: breathe 7.2s cubic-bezier(0.36, 0, 0.2, 1) infinite;
        }
        .orb::before {
          content: '';
          position: absolute;
          inset: -122px;
          border-radius: inherit;
          background: radial-gradient(
            circle at 50% 50%, 
            rgba(255, 196, 234, 0.26) 0%, 
            rgba(196, 217, 255, 0.16) 36%, 
            rgba(150, 190, 255, 0.07) 58%, 
            transparent 76%
          );
          filter: blur(58px);
          z-index: -1;
          animation: breathe-outer 9s ease-in-out infinite alternate;
        }
        .orb::after {
          content: '';
          position: absolute;
          inset: 1.6%;
          border-radius: 999px;
          border: 1px solid rgba(255, 200, 232, 0.52);
          box-shadow:
            inset 0 0 42px rgba(255, 224, 243, 0.18),
            inset 0 -22px 44px rgba(162, 211, 235, 0.13),
            0 0 28px rgba(255, 190, 226, 0.24);
          filter: blur(0.8px);
          opacity: 0.78;
        }
        .orb.listening {
          animation: breathe-listening 1.7s ease-in-out infinite;
          background:
            radial-gradient(circle at 42% 30%, rgba(255, 255, 255, 0.76) 0%, rgba(252, 250, 255, 0.58) 30%, rgba(240, 245, 255, 0.3) 54%, rgba(228, 237, 255, 0.14) 68%, rgba(228, 237, 255, 0) 84%),
            radial-gradient(circle at 58% 68%, rgba(255, 205, 232, 0.2) 0%, rgba(255, 205, 232, 0.1) 30%, rgba(255, 205, 232, 0) 64%);
          filter: blur(7px);
          box-shadow: 
            0 0 145px rgba(232, 240, 255, 0.5), 
            0 0 300px rgba(198, 222, 255, 0.36);
        }
        .orb.thinking {
          animation: breathe-reply 1.9s cubic-bezier(0.36, 0, 0.2, 1) infinite;
          background:
            radial-gradient(circle at 40% 30%, rgba(255, 250, 255, 0.66) 0%, rgba(235, 233, 255, 0.46) 28%, rgba(204, 219, 255, 0.26) 50%, rgba(176, 201, 255, 0.12) 66%, rgba(176, 201, 255, 0) 84%),
            radial-gradient(circle at 58% 68%, rgba(255, 191, 230, 0.32) 0%, rgba(255, 191, 230, 0.16) 36%, rgba(255, 191, 230, 0) 64%);
          filter: blur(5.8px);
          box-shadow: 
            0 0 185px rgba(234, 222, 255, 0.6), 
            0 0 390px rgba(186, 218, 255, 0.48);
        }
        .reflection-area {
          min-height: 120px;
          margin: 8px auto 12px;
          width: min(680px, 100%);
          text-align: center;
          display: grid;
          align-content: center;
          gap: 10px;
        }
        .final-hint {
          display: inline-block;
          width: fit-content;
          max-width: min(84vw, 520px);
          margin: 0 auto;
          text-align: center;
          color: rgba(239, 246, 255, 0.76);
          font-size: 13px;
          line-height: 1.85;
          padding: 0 10px;
          border-radius: 0;
          background: transparent;
          border: 0;
          text-shadow: 0 10px 30px rgba(20, 35, 70, 0.26);
          animation: hintFade 6.2s ease forwards;
        }
        .welcome-hint {
          display: inline-block;
          width: auto;
          margin: 0 auto;
          max-width: min(88vw, 560px);
          text-align: left;
          color: rgba(235, 244, 255, 0.76);
          font-size: 12.5px;
          line-height: 1.9;
          letter-spacing: 0.2px;
          padding: 0 6px;
          border-radius: 14px;
          background: transparent;
          border: none;
          animation: welcomeAppear 280ms ease;
        }
        .welcome-hint.fade-out {
          animation: welcomeFadeOut 1.15s ease forwards;
        }
        .interim-text,
        .last-reply {
          color: rgba(239, 246, 255, 0.72);
          font-size: 13px;
          line-height: 1.85;
          max-width: min(84vw, 520px);
          margin: 0 auto;
          text-align: center;
        }
        .last-reply {
          padding: 0 10px;
          border-radius: 0;
          background: transparent;
          border: 0;
          box-shadow: none;
          text-shadow: 0 10px 30px rgba(20, 35, 70, 0.24);
        }
        .controls {
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 12px;
          padding-bottom: max(18px, env(safe-area-inset-bottom));
        }
        .voice-toggle {
          width: 38px;
          height: 38px;
          display: inline-grid;
          place-items: center;
          border-radius: 999px;
          border: 1px solid rgba(245, 249, 255, 0.2);
          background: rgba(242, 247, 255, 0.08);
          color: rgba(248, 251, 255, 0.68);
          backdrop-filter: blur(12px);
          cursor: pointer;
          transition: background 180ms ease, border-color 180ms ease, color 180ms ease;
        }
        .voice-toggle:hover {
          border-color: rgba(245, 249, 255, 0.34);
          background: rgba(249, 252, 255, 0.16);
          color: rgba(248, 251, 255, 0.9);
        }
        .listen-button {
          min-width: 184px;
          padding: 12px 22px;
          border-radius: 999px;
          border: 1px solid rgba(245, 249, 255, 0.3);
          background:
            linear-gradient(180deg, rgba(255, 255, 255, 0.18), rgba(235, 243, 255, 0.09)),
            rgba(242, 247, 255, 0.08);
          color: rgba(248, 251, 255, 0.9);
          font-weight: 600;
          font-size: 14px;
          cursor: pointer;
          letter-spacing: 0.2px;
          backdrop-filter: blur(14px);
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.12),
            0 18px 54px rgba(24, 42, 82, 0.18);
          transition: transform 180ms ease, opacity 180ms ease, background 180ms ease, border-color 180ms ease;
        }
        .listen-button:hover:not(:disabled) {
          transform: translateY(-1px);
          border-color: rgba(245, 249, 255, 0.42);
          background:
            linear-gradient(180deg, rgba(255, 255, 255, 0.23), rgba(235, 243, 255, 0.12)),
            rgba(249, 252, 255, 0.1);
        }
        .listen-button:disabled {
          cursor: not-allowed;
          opacity: 0.62;
        }
        .error-text {
          margin: 6px auto 0;
          text-align: center;
          color: rgba(255, 201, 201, 0.82);
          font-size: 12px;
          line-height: 1.6;
        }
        @keyframes breathe {
          0%, 100% { transform: translateY(0px) scale(0.985, 1.01); opacity: 0.72; }
          30% { transform: translateY(-2px) scale(1.012, 0.997); opacity: 0.84; }
          55% { transform: translateY(-6px) scale(1.045, 0.98); opacity: 0.94; }
          78% { transform: translateY(-3px) scale(1.012, 0.995); opacity: 0.82; }
        }
        @keyframes breathe-outer {
          0%, 100% { transform: scale(0.92); opacity: 0.42; }
          50% { transform: scale(1.12); opacity: 0.82; }
        }
        @keyframes breathe-fast {
          0%, 100% { transform: translateY(0px) scale(1.0, 1.01); opacity: 0.84; }
          50% { transform: translateY(-4px) scale(1.06, 0.96); opacity: 1; }
        }
        @keyframes breathe-listening {
          0%, 100% { transform: translateY(0px) scale(0.99, 1.01); opacity: 0.72; }
          50% { transform: translateY(-3px) scale(1.03, 0.985); opacity: 0.9; }
        }
        @keyframes breathe-reply {
          0%, 100% { transform: translateY(0px) scale(0.99, 1.01); opacity: 0.86; }
          40% { transform: translateY(-5px) scale(1.055, 0.965); opacity: 1; }
          70% { transform: translateY(-2px) scale(1.02, 0.99); opacity: 0.94; }
        }
        @keyframes hintFade {
          0% { opacity: 0; transform: translateY(4px); }
          10% { opacity: 1; transform: translateY(0); }
          84% { opacity: 1; }
          100% { opacity: 0; }
        }
        @keyframes halo-breathe {
          0%, 100% { transform: scale(0.92); opacity: 0.26; }
          50% { transform: scale(1.08); opacity: 0.58; }
        }
        @keyframes field-drift {
          0% { transform: translate(-52%, -50%) scale(0.96); }
          100% { transform: translate(-48%, -52%) scale(1.04); }
        }
        @keyframes field-drift-b {
          0% { transform: translate(-50%, -48%) scale(1); }
          100% { transform: translate(-46%, -52%) scale(1.08); }
        }
        @keyframes field-drift-c {
          0% { transform: translate(-50%, -52%) scale(1.04); }
          100% { transform: translate(-54%, -48%) scale(0.96); }
        }
        @keyframes welcomeAppear {
          0% { opacity: 0; transform: translateY(10px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes welcomeFadeOut {
          0% { opacity: 1; transform: translateY(0); }
          100% { opacity: 0; transform: translateY(-2px); }
        }
        @media (max-width: 768px) {
          .topbar {
            align-items: flex-start;
          }
          :global(.back-link) {
            width: 32px;
            height: 32px;
            justify-content: center;
            padding: 0;
            border-color: rgba(235, 244, 255, 0.2);
          }
          :global(.back-link span) {
            display: none;
          }
          :global(.back-icon) {
            width: 15px;
            height: 15px;
          }
          .room {
            min-height: 0;
          }
          .orb-zone {
            min-height: clamp(210px, 44vh, 300px);
          }
          .orb {
            width: 224px;
            height: 224px;
          }
          .welcome-hint {
            max-width: 92vw;
            font-size: 11.5px;
            line-height: 1.7;
          }
          .controls {
            gap: 8px;
          }
          .listen-button {
            min-width: 156px;
            padding-inline: 14px;
          }
        }
      `}</style>
    </main>
  );
}
