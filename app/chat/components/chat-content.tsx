'use client';

import Link from 'next/link';
import { useChat } from 'ai/react';
import { useRef, useEffect, useState, useCallback } from 'react';
import { Send, FileText, Loader2, MessageSquarePlus, Sparkles, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { MessageRenderer } from '@/components/message-renderer';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { AuthDialog } from '@/components/auth-dialog';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { trackEvent } from '@/lib/analytics-client';
import {
  CAREER_DEMO_MODE_KEY,
  CAREER_PROFILE_SUMMARY_KEY,
  CHAT_STORAGE_KEY,
  buildCareerProfileSummary,
  buildFallbackCareerReport,
  filterCareerProfileMaterialMessages,
  getOrCreateCareerDraftToken,
  isCareerProfileMaterialContent,
  isReportRequestLikeContent,
  REPORT_STORAGE_KEY,
  saveGeneratedCareerSample,
} from '@/lib/career-path';
import { getDemoCaseById } from '@/lib/demo-cases';

const STORAGE_KEY = CHAT_STORAGE_KEY;
const ANONYMOUS_VISITOR_KEY = 'career_anonymous_visitor_id';
const ANONYMOUS_CONVERSATION_KEY = 'career_anonymous_conversation_id';
const REPORT_UNLOCKED_KEY = 'career_report_unlocked_v1';
const REPORT_READY_USER_MESSAGE_COUNT = 5;
const REPORT_GENERATION_SLOW_HINT_MS = 60000;
const REPORT_GENERATION_STUCK_FALLBACK_MS = 110000;

type ChatRole = 'user' | 'assistant' | 'system';
type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
};

type CareerReportPayload = {
  archetype: string;
  skills: string[];
  rpg_stats?: Array<{ name: string; value: number }>;
  superpowers: Array<string | { name: string; description: string; potential_roles?: string[] }>;
  summary: string;
  target_roles?: string[];
  generated_by?: 'model' | 'fallback';
};

const DEFAULT_WELCOME_MESSAGE: ChatMessage = {
  id: 'welcome',
  role: 'assistant',
  content: '你好。我是这里的倾听者，也是你的天赋挖掘者。我想通过对话，帮你发现你可能忽略的职业优势。今天你的职业状态感觉如何？',
};

const CONTINUE_CHAT_CONTROL_PREFIX = '[EchoTalent UI Action: continue_current_topic]';
const CONTINUE_CHAT_CONTROL_MESSAGE = `${CONTINUE_CHAT_CONTROL_PREFIX}
用户点击了“继续聊聊”。这是一条界面控制指令，不是用户正式输入，也不是报告素材。
请不要开启新话题，不要解读“还有细节需要补充”这类示意文案。
请回到上一条真实用户表达或刚才正在讨论的主题，用自然、承接的语气邀请用户继续补充一个具体细节。`;

function makeLocalId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function getOrCreateLocalId(key: string, prefix: string) {
  if (typeof window === 'undefined') return `${prefix}_server`;
  let id = window.localStorage.getItem(key);
  if (!id) {
    id = makeLocalId(prefix);
    window.localStorage.setItem(key, id);
  }
  return id;
}

function resetAnonymousConversationId() {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(ANONYMOUS_CONVERSATION_KEY, makeLocalId('anon_conv'));
}

const getLastContinueIndex = (msgs: Array<{ role?: unknown; content?: unknown }>) => {
  for (let i = msgs.length - 1; i >= 0; i--) {
    const m = msgs[i];
    const role = m?.role;
    const content = m?.content;
    if (role === 'user' && isContinueChatControlMessage(content)) {
      return i;
    }
  }
  return -1;
};

function isContinueChatControlMessage(content: unknown) {
  return typeof content === 'string' && content.startsWith(CONTINUE_CHAT_CONTROL_PREFIX);
}

function isReportMaterialMessage(message: { content?: unknown }) {
  return !isContinueChatControlMessage(message.content);
}

function getReportMaterialMessages<T extends { content?: unknown }>(items: T[]) {
  return items.filter(isReportMaterialMessage);
}

function getDisplayContent(content: string) {
  if (isContinueChatControlMessage(content)) return '继续聊聊';
  return content;
}

function hasReportIntent(content: unknown) {
  if (typeof content !== 'string') return false;
  const text = content.trim();
  if (!text || isContinueChatControlMessage(text)) return false;
  return isReportRequestLikeContent(text);
}

function GenerationLoading({ currentStep }: { currentStep: string }) {
  const [progress, setProgress] = useState(0);
  const [isSlow, setIsSlow] = useState(false);

  useEffect(() => {
    const duration = 22000;
    const interval = 100;
    const steps = duration / interval;
    const increment = 99 / steps;

    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 99) return prev;
        return prev + increment;
      });
    }, interval);

    const slowTimer = setTimeout(() => {
      setIsSlow(true);
    }, REPORT_GENERATION_SLOW_HINT_MS);

    const slowProgressTimer = setTimeout(() => {
      setProgress((prev) => Math.max(prev, 99));
    }, 18000);

    return () => {
      clearInterval(timer);
      clearTimeout(slowTimer);
      clearTimeout(slowProgressTimer);
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-white/90 backdrop-blur-md animate-in fade-in duration-500">
      <div className="relative w-24 h-24 mb-8">
        <div className="absolute inset-0 rounded-full border-[6px] border-slate-100"></div>
        <div className="absolute inset-0 rounded-full border-[6px] border-primary border-t-transparent animate-spin duration-[2s]"></div>
        <Sparkles className="absolute inset-0 m-auto w-10 h-10 text-primary animate-pulse" />
      </div>

      <div className="w-full max-w-sm space-y-4 px-8 text-center">
        <h3 className="text-xl font-bold text-foreground/80 tracking-tight animate-pulse">
          {currentStep || '正在生成报告...'}
        </h3>

        <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden shadow-inner border border-slate-200/50">
          <div
            className="h-full bg-gradient-to-r from-blue-400 to-primary transition-all duration-200 ease-out rounded-full shadow-[0_0_10px_rgba(59,130,246,0.5)]"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex justify-between items-center text-xs text-muted-foreground font-medium px-1">
          <span>{isSlow ? '仍在整理画像' : 'AI 分析中'}</span>
          <span className="tabular-nums">{Math.round(progress)}%</span>
        </div>
        {isSlow && (
          <p className="text-xs leading-relaxed text-muted-foreground">
            正在继续生成完整版报告，请再稍等片刻。
          </p>
        )}
      </div>
    </div>
  );
}

interface ChatContentProps {
  urlId: string | null;
  isNewChatRequested: boolean;
  demoCaseId: string | null;
}

function ChatContentInner({ urlId, isNewChatRequested, demoCaseId }: ChatContentProps) {
  const router = useRouter();
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [showReportButton, setShowReportButton] = useState(false);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [loadingStep, setLoadingStep] = useState<string>('');
  const [reportError, setReportError] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [pendingAction, setPendingAction] = useState<'new_chat' | 'report' | null>(null);
  const [reportNudgeOpen, setReportNudgeOpen] = useState(false);
  const [reportNudgeNonce, setReportNudgeNonce] = useState(0);
  const reportNudgeTimeoutsRef = useRef<number[]>([]);
  const [reportHintQueue, setReportHintQueue] = useState(0);
  const [hasEnteredImmersiveContinue, setHasEnteredImmersiveContinue] = useState(false);
  const [uiInserts, setUiInserts] = useState<Array<{ id: string; afterMessageId: string; content: string }>>([]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const reportAbortControllerRef = useRef<AbortController | null>(null);
  const isComposingRef = useRef(false);
  const [draftInput, setDraftInput] = useState('');

  const demoCase = getDemoCaseById(demoCaseId);
  const initialChatMessages: ChatMessage[] = demoCase?.messages?.length ? demoCase.messages : [DEFAULT_WELCOME_MESSAGE];

  const safeGetUser = async (): Promise<SupabaseUser | null> => {
    try {
      const timeout = new Promise<{ data: { user: SupabaseUser | null } }>((resolve) =>
        window.setTimeout(() => resolve({ data: { user: null } }), 400)
      );
      const res = await Promise.race([supabase.auth.getUser(), timeout]);
      return res.data.user;
    } catch {
      return null;
    }
  };

  const trackAnonymousChatMessages = async (
    userMessage: { id?: string; role?: unknown; content?: unknown } | undefined,
    assistantContent: string
  ) => {
    const batchId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const anonymousVisitorId = getOrCreateLocalId(ANONYMOUS_VISITOR_KEY, 'anon_visitor');
    const anonymousConversationId = getOrCreateLocalId(ANONYMOUS_CONVERSATION_KEY, 'anon_conv');
    const events: Array<{ role: 'user' | 'assistant'; content: string }> = [];
    if (userMessage?.role === 'user' && typeof userMessage.content === 'string' && userMessage.content.trim()) {
      events.push({ role: 'user', content: userMessage.content });
    }
    if (assistantContent.trim()) {
      events.push({ role: 'assistant', content: assistantContent });
    }

    for (const item of events) {
      void trackEvent({
        eventName: 'anonymous_chat_message',
        page: '/chat',
        metadata: {
          role: item.role,
          content: item.content,
          chars: item.content.length,
          batchId,
          anonymousVisitorId,
          anonymousConversationId,
        },
      });
    }
  };

  const handleFinish = async (message: { content?: string }) => {
    try {
      const user = await safeGetUser();
      const assistantContent = typeof message?.content === 'string' ? message.content : '';
      if (!user) {
        const lastMaterialUserMessage = [...messages]
          .reverse()
          .find((m) => m.role === 'user' && isReportMaterialMessage(m));
        await trackAnonymousChatMessages(lastMaterialUserMessage, assistantContent);
        return;
      }

      let conversationId = currentConversationId;

      if (!conversationId) {
        const title = '新对话';
        const { data: conv, error: convError } = await supabase
          .from('conversations')
          .insert({ user_id: user.id, title })
          .select()
          .single();

        if (convError) throw convError;
        conversationId = conv.id;
        setCurrentConversationId(conv.id);

        const messagesToSync: Array<{ id?: string; role?: unknown; content?: unknown }> = getReportMaterialMessages([
          ...messages,
          { id: `assistant-${Date.now()}`, role: 'assistant', content: assistantContent },
        ]);

        for (const msg of messagesToSync) {
          if (msg.id === 'welcome') continue;
          await supabase.from('messages').insert({
            conversation_id: conv.id,
            user_id: user.id,
            role: msg.role,
            content: msg.content,
          });
        }

        fetch('/api/summarize', {
          method: 'POST',
          body: JSON.stringify({ messages: messagesToSync }),
        })
          .then((res) => res.json())
          .then((data) => {
            if (data.title) {
              supabase
                .from('conversations')
                .update({ title: data.title })
                .eq('id', conv.id)
                .then(({ error }) => {
                  if (error) console.error('Failed to update title', error);
                });
            }
          })
          .catch((err) => console.error('Failed to generate summary', err));

        return;
      }

      const lastUserMsg = messages[messages.length - 1];
      if (lastUserMsg && lastUserMsg.role === 'user' && isReportMaterialMessage(lastUserMsg)) {
        await supabase.from('messages').insert({
          conversation_id: conversationId,
          user_id: user.id,
          role: 'user',
          content: lastUserMsg.content,
        });
      }

      await supabase.from('messages').insert({
        conversation_id: conversationId,
        user_id: user.id,
        role: 'assistant',
        content: assistantContent,
      });
    } catch (err) {
      console.error('Failed to sync to cloud:', err);
    }
  };

  const { messages, append, isLoading, error, setMessages } = useChat({
    api: '/api/chat',
    initialMessages: initialChatMessages,
    onResponse: async () => {
      try {
        const user = await safeGetUser();
        if (!user) return;

        let conversationId = currentConversationId;

        if (!conversationId) {
          const { data: conv, error: convError } = await supabase
            .from('conversations')
            .insert({ user_id: user.id, title: '新对话' })
            .select()
            .single();

          if (!convError && conv) {
            conversationId = conv.id;
            setCurrentConversationId(conv.id);

            const allMsgs = getReportMaterialMessages([...messages]);
            for (const m of allMsgs) {
              if (m.id === 'welcome') continue;
              await supabase.from('messages').insert({
                conversation_id: conv.id,
                user_id: user.id,
                role: m.role,
                content: m.content,
              });
            }
          }
        }

        if (conversationId) {
          const lastUserMsg = messages[messages.length - 1];
          if (lastUserMsg && lastUserMsg.role === 'user' && isReportMaterialMessage(lastUserMsg)) {
            await supabase.from('messages').insert({
              conversation_id: conversationId,
              user_id: user.id,
              role: 'user',
              content: lastUserMsg.content,
            });
          }
        }
      } catch (err) {
        console.error('Chat sync error:', err);
      }
    },
    onFinish: handleFinish,
    onError: (err) => {
      console.error('Chat error:', err);
    },
  });

  const materialMessages = getReportMaterialMessages(messages);
  const profileMaterialMessages = filterCareerProfileMaterialMessages(materialMessages);
  const materialUserMessageCount = materialMessages.filter(
    (message) => message.role === 'user' && isCareerProfileMaterialContent(message.content)
  ).length;
  const isReportReady = showReportButton || materialUserMessageCount >= REPORT_READY_USER_MESSAGE_COUNT;

  const triggerReportNudge = () => {
    setReportNudgeNonce((n) => n + 1);
    setReportNudgeOpen(true);
    if (typeof window === 'undefined') return;
    for (const t of reportNudgeTimeoutsRef.current) window.clearTimeout(t);
    reportNudgeTimeoutsRef.current = [];
    reportNudgeTimeoutsRef.current.push(
      window.setTimeout(() => setReportNudgeOpen(false), 550),
      window.setTimeout(() => {
        setReportNudgeNonce((n) => n + 1);
        setReportNudgeOpen(true);
      }, 900),
      window.setTimeout(() => setReportNudgeOpen(false), 1550)
    );
  };

  const unlockReportButton = useCallback(() => {
    setShowReportButton(true);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(REPORT_UNLOCKED_KEY, '1');
    }
  }, []);

  useEffect(() => {
    return () => {
      if (typeof window === 'undefined') return;
      for (const t of reportNudgeTimeoutsRef.current) window.clearTimeout(t);
      reportNudgeTimeoutsRef.current = [];
    };
  }, []);

  const handleSelectConversation = useCallback(async (id: string) => {
    setCurrentConversationId(id);

    try {
      const savedHistory = localStorage.getItem('career_conversations_meta');
      if (savedHistory) {
        const parsed = JSON.parse(savedHistory) as unknown;
        const conversations = Array.isArray(parsed) ? parsed : [];
        const localConv = conversations.find((c) => (c as { id?: unknown })?.id === id) as
          | { messages?: unknown }
          | undefined;
        const localMessages = localConv?.messages;
        if (Array.isArray(localMessages)) {
          const mapped = localMessages
            .map((m) => {
              const mm = m as { id?: unknown; role?: unknown; content?: unknown };
              const role = mm.role === 'user' || mm.role === 'assistant' || mm.role === 'system' ? mm.role : null;
              const content = typeof mm.content === 'string' ? mm.content : null;
              if (!role || !content) return null;
              const mid =
                typeof mm.id === 'string' && mm.id.trim()
                  ? mm.id
                  : Math.random().toString(36).substring(7);
              return { id: mid, role, content };
            })
            .filter((m): m is ChatMessage => Boolean(m));
          if (mapped.length > 0) setMessages(mapped);
          return;
        }
      }
    } catch (e) {
      console.error('Error loading local conversation:', e);
    }

    try {
      const { data, error: queryError } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', id)
        .order('created_at', { ascending: true });

      if (queryError) throw queryError;
      if (data && data.length > 0) {
        setMessages(
          data
            .map((m) => {
              const mm = m as { id?: unknown; role?: unknown; content?: unknown };
              const role = mm.role === 'user' || mm.role === 'assistant' || mm.role === 'system' ? mm.role : null;
              const content = typeof mm.content === 'string' ? mm.content : null;
              const mid = typeof mm.id === 'string' ? mm.id : null;
              if (!role || !content || !mid) return null;
              return { id: mid, role, content };
            })
            .filter((m): m is ChatMessage => Boolean(m))
        );
      }
    } catch (err) {
      console.error('Failed to load conversation', err);
    }
  }, [setMessages]);

  useEffect(() => {
    if (urlId && urlId !== currentConversationId) {
      void handleSelectConversation(urlId);
    }
  }, [currentConversationId, handleSelectConversation, urlId]);

  useEffect(() => {
    if (reportHintQueue <= 0) return;
    const last = messages[messages.length - 1] as { id?: unknown; role?: unknown; content?: unknown } | undefined;
    const id = typeof last?.id === 'string' ? last.id : null;
    const role = last?.role;
    const content = last?.content;
    if (!id || role !== 'user' || !isContinueChatControlMessage(content)) return;

    setUiInserts((prev) => {
      if (prev.some((x) => x.afterMessageId === id && x.id.startsWith('report-hint-'))) return prev;
      return [
        ...prev,
        {
          id: `report-hint-${Date.now()}`,
          afterMessageId: id,
          content: '好的，那我们继续沿着刚才的话题往下走，当你觉得聊差不多的时候，可以点击界面右上角的报告图标查看报告。',
        },
      ];
    });
    setReportHintQueue((n) => Math.max(0, n - 1));
  }, [messages, reportHintQueue]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [draftInput]);

  const submitCurrentInput = useCallback(async () => {
    if (isLoading) return;
    setReportError(null);
    const liveValue = textareaRef.current?.value ?? '';
    const nextValue = (liveValue || draftInput).trim();
    if (!nextValue) return;

    setDraftInput('');
    if (textareaRef.current) {
      textareaRef.current.value = '';
      textareaRef.current.style.height = 'auto';
    }

    try {
      await append({
        role: 'user',
        content: nextValue,
      });
    } catch (error) {
      setDraftInput(nextValue);
      if (textareaRef.current) {
        textareaRef.current.value = nextValue;
      }
      throw error;
    }
  }, [append, draftInput, isLoading]);

  const handleNewChat = async () => {
    const materialMessages = getReportMaterialMessages(messages);
    if (messages.length > 2) {
      if (currentConversationId) {
        fetch('/api/summarize', {
          method: 'POST',
          body: JSON.stringify({ messages: materialMessages }),
        })
          .then((res) => res.json())
          .then((data) => {
            if (data.title) {
              supabase
                .from('conversations')
                .update({ title: data.title })
                .eq('id', currentConversationId)
                .then(({ error }) => {
                  if (error) console.error('Failed to update final title', error);
                });
            }
          })
          .catch((err) => console.error('Failed to generate final summary', err));
      } else {
        const savedHistory = localStorage.getItem('career_conversations_meta');
        const conversations = savedHistory ? JSON.parse(savedHistory) : [];

        const title = materialMessages.find((m) => m.role === 'user')?.content.substring(0, 20) || '新对话';

        const newConv = {
          id: Date.now().toString(),
          title: title + '...',
          created_at: new Date().toISOString(),
          messages: materialMessages,
        };

        conversations.unshift(newConv);
        localStorage.setItem('career_conversations_meta', JSON.stringify(conversations));
      }
    }

    setCurrentConversationId(null);
    resetAnonymousConversationId();
    setShowReportButton(false);
    localStorage.removeItem(REPORT_UNLOCKED_KEY);
    setUiInserts([]);
    setReportHintQueue(0);
    setHasEnteredImmersiveContinue(false);
    setMessages([DEFAULT_WELCOME_MESSAGE]);
    localStorage.removeItem(STORAGE_KEY);
    router.push('/chat');
  };

  useEffect(() => {
    const loadLastConversation = async () => {
      const demoMode = localStorage.getItem(CAREER_DEMO_MODE_KEY) === '1';
      const { data: { user } } = await supabase.auth.getUser();

      const handleLoaded = () => {
        setIsLoaded(true);
      };

      if (isNewChatRequested) {
        if (!user) {
          const currentSession = localStorage.getItem(STORAGE_KEY);
          if (currentSession) {
            try {
              const parsedMsgs = JSON.parse(currentSession);
              if (parsedMsgs.length > 2) {
                const savedHistory = localStorage.getItem('career_conversations_meta');
                const conversations = savedHistory ? JSON.parse(savedHistory) : [];

                const titleCandidate = (parsedMsgs as Array<{ role?: unknown; content?: unknown }>)
                  .find((m) => m?.role === 'user' && typeof m?.content === 'string');
                const titleText = typeof titleCandidate?.content === 'string' ? titleCandidate.content : '';
                const title = titleText ? titleText.substring(0, 20) : '新对话';

                const newConv = {
                  id: Date.now().toString(),
                  title: title + '...',
                  created_at: new Date().toISOString(),
                  messages: parsedMsgs,
                };

                conversations.unshift(newConv);
                localStorage.setItem('career_conversations_meta', JSON.stringify(conversations));
              }
            } catch (e) {
              console.error('Failed to save previous session on new chat', e);
            }
          }
          localStorage.removeItem(STORAGE_KEY);
          localStorage.removeItem(CAREER_DEMO_MODE_KEY);
          resetAnonymousConversationId();
        }

        router.replace('/chat');
        setCurrentConversationId(null);
        resetAnonymousConversationId();
        setShowReportButton(false);
        localStorage.removeItem(REPORT_UNLOCKED_KEY);
        setUiInserts([]);
        setReportHintQueue(0);
        setHasEnteredImmersiveContinue(false);
        setMessages([DEFAULT_WELCOME_MESSAGE]);
        handleLoaded();
        return;
      }

      if (demoCase) {
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(demoCase.messages));
          resetAnonymousConversationId();
          setMessages(demoCase.messages);
          setCurrentConversationId(null);
          setShowReportButton(true);
          localStorage.setItem(REPORT_UNLOCKED_KEY, '1');
          setUiInserts([]);
          setReportHintQueue(0);
          setHasEnteredImmersiveContinue(false);
        } catch (e) {
          console.error('Failed to hydrate demo case', e);
        }
        handleLoaded();
        return;
      }

      if (user && !demoMode) {
        if (urlId) {
          await handleSelectConversation(urlId);
          handleLoaded();
          return;
        }

        const { data: conversations, error: queryError } = await supabase
          .from('conversations')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(1);
        if (queryError) throw queryError;

        if (conversations && conversations.length > 0) {
          await handleSelectConversation(conversations[0].id);
          handleLoaded();
          return;
        }
      }

      const saved = localStorage.getItem(STORAGE_KEY);
      if (localStorage.getItem(REPORT_UNLOCKED_KEY) === '1') {
        setShowReportButton(true);
      }
      if (saved && !currentConversationId) {
        try {
          const parsed = JSON.parse(saved);
          if (parsed.length > 0) {
            setMessages(parsed);
          }
        } catch (e) {
          console.error('Failed to parse chat history', e);
        }
      }
      handleLoaded();
    };

    void loadLastConversation();
  }, [currentConversationId, demoCase, handleSelectConversation, isNewChatRequested, router, setMessages, urlId]);

  useEffect(() => {
    if (isLoaded && messages.length > 1 && !currentConversationId) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    }
  }, [messages, isLoaded, currentConversationId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth' });
    }

    const lastMessage = messages[messages.length - 1];
    const tools = (lastMessage as { toolInvocations?: unknown })?.toolInvocations;
    const hasReportToolCall =
      Array.isArray(tools) &&
      tools.some((tool) => (tool as { toolName?: unknown })?.toolName === 'enableReportButton');

    if ((hasReportToolCall || materialUserMessageCount >= REPORT_READY_USER_MESSAGE_COUNT) && !showReportButton) {
      unlockReportButton();
    }
  }, [materialUserMessageCount, messages, showReportButton, unlockReportButton]);

  useEffect(() => {
    void trackEvent({
      eventName: 'flow_step',
      page: '/chat',
      step: 'chat_loaded',
      status: 'start',
    });
  }, []);

  const persistReportAndOpen = useCallback((reportData: CareerReportPayload, source: 'model' | 'fallback') => {
    try {
      window.localStorage.setItem(REPORT_STORAGE_KEY, JSON.stringify(reportData));
      window.localStorage.setItem(CAREER_PROFILE_SUMMARY_KEY, JSON.stringify(buildCareerProfileSummary(
        profileMaterialMessages as Array<{ id?: string; role: string; content: string }>
      )));
      saveGeneratedCareerSample(reportData, profileMaterialMessages as Array<{ id?: string; role: string; content: string }>);
      const draftToken = getOrCreateCareerDraftToken();
      if (draftToken) {
        void fetch('/api/career-path/draft', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            draftToken,
            report: reportData,
            messages: profileMaterialMessages,
          }),
        }).catch((error) => console.error('Failed to save career draft', error));
      }
    } catch (e) {
      console.error(`Failed to persist ${source} report`, e);
    }
    router.push('/report');
  }, [profileMaterialMessages, router]);

  const handleGenerateReport = async () => {
    if (isGeneratingReport) return;
    setReportError(null);
    if (profileMaterialMessages.length < 4) {
      setReportError('当前对话信息还不够生成报告，可以再补充一两段真实经历。');
      triggerReportNudge();
      return;
    }
    setIsGeneratingReport(true);
    try {
      window.localStorage.setItem(CAREER_PROFILE_SUMMARY_KEY, JSON.stringify(buildCareerProfileSummary(
        profileMaterialMessages as Array<{ id?: string; role: string; content: string }>
      )));
    } catch (error) {
      console.error('Failed to persist career profile summary', error);
    }
    void trackEvent({
      eventName: 'flow_step',
      page: '/chat',
      step: 'report_generation',
      status: 'start',
    });

    const steps = [
      '正在回顾我们的深度对话...',
      '正在分析你的职业原型...',
      '正在挖掘你的隐藏天赋...',
      '正在绘制你的职业画像...',
      '正在生成最终报告...',
    ];
    let stepIndex = 0;
    setLoadingStep(steps[0]);

    const intervalId = setInterval(() => {
      stepIndex++;
      if (stepIndex < steps.length) {
        setLoadingStep(steps[stepIndex]);
      }
    }, 2500);
    let fallbackTimer: number | undefined;
    let slowHint1: number | undefined;
    let slowHint2: number | undefined;
    let settled = false;
    let hasOpenedFallback = false;
    const materialForReport = profileMaterialMessages as Array<{ id?: string; role: string; content: string }>;

    try {
      const controller = new AbortController();
      reportAbortControllerRef.current = controller;
      slowHint1 = window.setTimeout(() => setLoadingStep('仍在整理画像...'), 9000);
      slowHint2 = window.setTimeout(() => setLoadingStep('正在生成完整版报告...'), 30000);
      fallbackTimer = window.setTimeout(() => {
        if (settled) return;
        hasOpenedFallback = true;
        setLoadingStep('');
        setIsGeneratingReport(false);
        void trackEvent({
          eventName: 'flow_step',
          page: '/chat',
          step: 'report_generation',
          status: 'fallback',
        });
        persistReportAndOpen(buildFallbackCareerReport(materialForReport), 'fallback');
      }, REPORT_GENERATION_STUCK_FALLBACK_MS);

      const response = await fetch('/api/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: materialForReport }),
        signal: controller.signal,
      });

      settled = true;
      if (fallbackTimer) window.clearTimeout(fallbackTimer);
      window.clearTimeout(slowHint1);
      window.clearTimeout(slowHint2);
      clearInterval(intervalId);
      setLoadingStep('准备就绪！');
      reportAbortControllerRef.current = null;

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => null) as { error?: string } | null;
        throw new Error(errorPayload?.error || 'Report generation failed');
      }
      const data = await response.json() as CareerReportPayload;
      void trackEvent({
        eventName: 'flow_step',
        page: '/chat',
        step: 'report_generation',
        status: 'success',
      });
      persistReportAndOpen({ ...data, generated_by: 'model' }, 'model');
    } catch (error) {
      settled = true;
      clearInterval(intervalId);
      if (fallbackTimer) window.clearTimeout(fallbackTimer);
      if (slowHint1) window.clearTimeout(slowHint1);
      if (slowHint2) window.clearTimeout(slowHint2);
      setLoadingStep('');
      reportAbortControllerRef.current = null;
      console.error('Failed to generate report:', error);
      void trackEvent({
        eventName: 'flow_step',
        page: '/chat',
        step: 'report_generation',
        status: 'fallback',
      });
      if (!hasOpenedFallback) {
        persistReportAndOpen(buildFallbackCareerReport(materialForReport), 'fallback');
      }
      setIsGeneratingReport(false);
    }
  };

  const lastMaterialUserMessage = [...materialMessages].reverse().find((message) => message.role === 'user');
  const hasImmersiveContinue = hasEnteredImmersiveContinue || getLastContinueIndex(messages) >= 0;
  const isCurrentChatReportEligible = materialUserMessageCount >= REPORT_READY_USER_MESSAGE_COUNT;
  const showBottomButtons =
    isCurrentChatReportEligible && (!hasImmersiveContinue || hasReportIntent(lastMaterialUserMessage?.content));

  return (
    <div className="flex h-[100dvh] w-full bg-background overflow-hidden safe-area-padding">
      <main className={cn('flex-1 flex flex-col h-full relative transition-all duration-300')}>
        <div className="flex flex-col h-full max-w-md md:max-w-3xl lg:max-w-4xl mx-auto w-full shadow-2xl overflow-hidden relative glass-card transition-all duration-500 ease-in-out md:my-4 md:rounded-2xl border-white/20">
          <div className="absolute top-[-10%] left-[-10%] w-64 h-64 bg-primary/20 rounded-full blur-3xl animate-float opacity-60 pointer-events-none" />
          <div className="absolute bottom-[20%] right-[-5%] w-48 h-48 bg-secondary/30 rounded-full blur-3xl animate-breathe opacity-60 pointer-events-none" style={{ animationDelay: '2s' }} />

          {isGeneratingReport && <GenerationLoading currentStep={loadingStep} />}

          <header className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-white/20 bg-white/40 backdrop-blur-md z-10 sticky top-0 shrink-0">
            <div className="flex items-center gap-3">
              <div className="flex flex-col">
                <h1 className="text-lg font-medium tracking-tight text-foreground/80">EchoTalent</h1>
                <span className="text-[10px] text-muted-foreground tracking-widest uppercase opacity-70">v4.5.1 share</span>
              </div>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2">
              {isReportReady && (
                <div className="relative">
                  {reportNudgeOpen && (
                    <div
                      key={`report-nudge-glow-${reportNudgeNonce}`}
                      className="pointer-events-none absolute -inset-2 rounded-full bg-primary/25 blur-xl animate-pulse"
                    />
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    className={cn(
                      'relative z-10 gap-1.5 sm:gap-2 animate-in fade-in zoom-in duration-500 rounded-full bg-white/50 backdrop-blur-sm border-primary/20 text-primary shadow-sm hover:bg-white/80 px-2.5 sm:px-3 text-xs sm:text-sm transition-all',
                      reportNudgeOpen && 'bg-white/80 border-primary/40 ring-2 ring-primary/35 shadow-lg shadow-primary/20'
                    )}
                    onClick={() => void handleGenerateReport()}
                    disabled={isGeneratingReport}
                  >
                    {isGeneratingReport ? (
                      <Loader2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-spin" />
                    ) : (
                      <FileText className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    )}
                    <span className="hidden xs:inline">{isGeneratingReport ? (loadingStep || '分析中...') : '职业报告'}</span>
                  </Button>
                </div>
              )}

              <button
                type="button"
                onClick={() => void handleNewChat()}
                className="group inline-flex items-center justify-center rounded-full w-8 h-8 sm:w-9 sm:h-9 bg-white/35 hover:bg-primary/15 hover:shadow-md hover:shadow-primary/15 hover:scale-105 active:bg-primary/25 active:scale-95 transition-all duration-150 border border-white/35 hover:border-primary/25"
                title="新对话"
                aria-label="新对话"
              >
                <MessageSquarePlus className="w-4 h-4 sm:w-5 sm:h-5 text-foreground/70 group-hover:text-foreground/90 group-active:text-foreground/90" />
              </button>

              <Link
                href="/user"
                className="group inline-flex items-center justify-center rounded-full w-8 h-8 sm:w-9 sm:h-9 bg-white/35 hover:bg-primary/15 hover:shadow-md hover:shadow-primary/15 hover:scale-105 active:bg-primary/25 active:scale-95 transition-all duration-150 ml-0.5 sm:ml-1 border border-white/35 hover:border-primary/25"
                title="用户中心"
              >
                <User className="w-4 h-4 sm:w-5 sm:h-5 text-foreground/70 group-hover:text-foreground/90 group-active:text-foreground/90" />
              </Link>
            </div>
          </header>

          <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 scroll-smooth pb-24 md:pb-8">
            {error && (
              <div className="w-full p-4 mb-4 text-sm text-red-500 bg-red-50/80 backdrop-blur rounded-2xl border border-red-100 shadow-sm" role="alert">
                <span className="font-medium">出错啦：</span> {error.message}
              </div>
            )}
            {messages.map((m) => {
              const inserts = uiInserts.filter((x) => x.afterMessageId === m.id);
              return (
                <div key={m.id} className="space-y-3">
                  <div
                    className={cn(
                      'flex w-full animate-in fade-in slide-in-from-bottom-2 duration-300',
                      m.role === 'user' ? 'justify-end' : 'justify-start'
                    )}
                  >
                    <div
                      className={cn(
                        'flex max-w-[85%] flex-col gap-2 px-5 py-4 text-sm shadow-sm transition-all hover:shadow-md',
                        m.role === 'user'
                          ? 'bg-gradient-to-br from-primary to-[#ffbca0] text-white rounded-2xl rounded-br-sm'
                          : 'glass text-foreground/90 rounded-2xl rounded-bl-sm border-white/40'
                      )}
                    >
                      <div className="leading-relaxed">
                        <MessageRenderer content={getDisplayContent(m.content)} role={m.role} />
                      </div>
                    </div>
                  </div>
                  {inserts.map((x) => {
                    const isReportHint = x.id.startsWith('report-hint-');
                    return (
                    <div key={x.id} className="flex w-full justify-center animate-in fade-in slide-in-from-bottom-2 duration-300">
                      <div
                        className={cn(
                          isReportHint
                            ? 'max-w-[78%] px-2 py-0.5 text-[11px] leading-5 text-muted-foreground/55'
                            : 'max-w-[88%] rounded-full border border-primary/15 bg-white/55 px-3.5 py-2 text-xs text-muted-foreground shadow-sm backdrop-blur-md'
                        )}
                      >
                        <div className={cn('text-center', isReportHint ? 'leading-5' : 'leading-relaxed')}>
                          <MessageRenderer content={x.content} role="assistant" />
                        </div>
                      </div>
                    </div>
                    );
                  })}
                </div>
              );
            })}
            {isLoading && (
              <div className="flex justify-start w-full animate-pulse">
                <div className="glass text-foreground/80 rounded-2xl rounded-bl-sm px-5 py-4 text-sm shadow-sm flex items-center gap-2 border-white/40">
                  <span className="w-2 h-2 bg-primary/40 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                  <span className="w-2 h-2 bg-primary/40 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                  <span className="w-2 h-2 bg-primary/40 rounded-full animate-bounce"></span>
                </div>
              </div>
            )}

            {showBottomButtons && !isLoading && (
              <div className="flex justify-center w-full animate-in fade-in slide-in-from-bottom-4 duration-700 py-4">
                <div className="flex gap-2 sm:gap-4 items-center bg-white/60 backdrop-blur-xl p-1.5 sm:p-2 rounded-2xl border border-white/40 shadow-xl shadow-primary/5">
                  <Button
                    variant="ghost"
                    className="rounded-xl hover:bg-white/80 text-foreground/80 border border-transparent hover:border-white/40 transition-all text-sm px-3"
                    onClick={() => {
                      triggerReportNudge();
                      setReportHintQueue((n) => n + 1);
                      setHasEnteredImmersiveContinue(true);
                      append({
                        role: 'user',
                        content: CONTINUE_CHAT_CONTROL_MESSAGE,
                      });
                    }}
                  >
                    <MessageSquarePlus className="w-4 h-4 mr-2 text-primary/70" />
                    继续聊聊
                  </Button>
                  <div className="w-px h-6 bg-border/50"></div>
                  <Button
                    className="rounded-xl bg-gradient-to-r from-primary to-orange-400 text-white shadow-md hover:shadow-lg hover:scale-105 transition-all text-sm px-4"
                    onClick={() => void handleGenerateReport()}
                    disabled={isGeneratingReport}
                  >
                    {isGeneratingReport ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Sparkles className="w-4 h-4 mr-2" />
                    )}
                    生成报告
                  </Button>
                </div>
              </div>
            )}

            <div ref={scrollRef} />
          </div>

          <div className="p-2 sm:p-4 md:px-8 md:pb-8 bg-transparent absolute bottom-0 left-0 right-0 z-20 md:relative md:bg-transparent">
            {reportError && (
              <div className="mb-2 rounded-2xl border border-red-100 bg-red-50/90 px-4 py-3 text-sm text-red-600 shadow-sm backdrop-blur">
                {reportError}
              </div>
            )}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void submitCurrentInput();
              }}
              className="flex gap-1.5 sm:gap-2 items-end relative glass rounded-[26px] p-1.5 sm:p-2 shadow-lg border-white/60"
            >
              <textarea
                ref={textareaRef}
                className="flex-1 min-w-0 bg-transparent text-foreground rounded-2xl px-3 sm:px-4 py-3 text-base sm:text-sm focus:outline-none placeholder:text-muted-foreground/60 resize-none max-h-[200px] overflow-y-auto min-h-[44px]"
                value={draftInput}
                onChange={(e) => setDraftInput(e.target.value)}
                onInput={(e) => setDraftInput((e.target as HTMLTextAreaElement).value)}
                onCompositionStart={() => {
                  isComposingRef.current = true;
                }}
                onCompositionEnd={(e) => {
                  isComposingRef.current = false;
                  setDraftInput((e.target as HTMLTextAreaElement).value);
                }}
                onKeyDown={(e) => {
                  const nativeEvent = e.nativeEvent as KeyboardEvent & { isComposing?: boolean };
                  if (nativeEvent.isComposing || isComposingRef.current || e.keyCode === 229) return;
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    if ((textareaRef.current?.value || draftInput).trim() && !isLoading) {
                      void submitCurrentInput();
                    }
                  }
                }}
                placeholder="与内心对话..."
                autoFocus
                rows={1}
              />
              <Button
                type="submit"
                size="icon"
                className="rounded-full w-9 h-9 sm:w-10 sm:h-10 shrink-0 bg-primary hover:bg-primary/90 text-white shadow-md transition-transform hover:scale-105 mb-0.5"
                disabled={isLoading}
              >
                <Send className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                <span className="sr-only">Send</span>
              </Button>
            </form>
          </div>
        </div>
      </main>

      <AuthDialog
        isOpen={showAuth}
        onClose={() => {
          setShowAuth(false);
          setPendingAction(null);
        }}
        onAuthSuccess={() => {
          setShowAuth(false);
          if (pendingAction === 'new_chat') {
            void handleNewChat();
          } else if (pendingAction === 'report') {
            void handleGenerateReport();
          }
          setPendingAction(null);
        }}
      />
    </div>
  );
}

export default function ChatContent({ urlId, isNewChatRequested, demoCaseId }: ChatContentProps) {
  return <ChatContentInner urlId={urlId} isNewChatRequested={isNewChatRequested} demoCaseId={demoCaseId} />;
}
