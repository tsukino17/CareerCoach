import { createOpenAI } from '@ai-sdk/openai';

// TokenDance 是统一的多模型网关（OpenAI 兼容协议）。
// 已配置 TOKENDANCE_API_KEY 时优先走 TokenDance；未配置时回退 DashScope 兼容模式，保持既有部署可用。
const TOKENDANCE_BASE_URL = 'https://tokendance.space/gateway/v1';
const DASHSCOPE_BASE_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1';

export const TOKENDANCE_DEFAULT_CHAT_MODEL = 'qwen3.7-plus';
const DASHSCOPE_DEFAULT_CHAT_MODEL = 'qwen-plus';

export type LlmGateway = {
  provider: 'tokendance' | 'dashscope';
  baseURL: string;
  apiKey: string;
  chatModel: string;
};

export function resolveLlmGateway(): LlmGateway | null {
  const tokendanceKey = process.env.TOKENDANCE_API_KEY;
  if (tokendanceKey) {
    return {
      provider: 'tokendance',
      baseURL: process.env.TOKENDANCE_BASE_URL || TOKENDANCE_BASE_URL,
      apiKey: tokendanceKey,
      chatModel: process.env.CHAT_MODEL || TOKENDANCE_DEFAULT_CHAT_MODEL,
    };
  }
  const dashscopeKey = process.env.DASHSCOPE_API_KEY;
  if (dashscopeKey) {
    return {
      provider: 'dashscope',
      baseURL: DASHSCOPE_BASE_URL,
      apiKey: dashscopeKey,
      chatModel: process.env.CHAT_MODEL || DASHSCOPE_DEFAULT_CHAT_MODEL,
    };
  }
  return null;
}

export type LlmClient = {
  openai: ReturnType<typeof createOpenAI>;
  chatModel: string;
  provider: LlmGateway['provider'];
};

export function createLlmClient(): LlmClient | null {
  const gateway = resolveLlmGateway();
  if (!gateway) return null;
  return {
    openai: createOpenAI({ baseURL: gateway.baseURL, apiKey: gateway.apiKey }),
    chatModel: gateway.chatModel,
    provider: gateway.provider,
  };
}

export type ChatCompletionMessage = { role: 'system' | 'user' | 'assistant'; content: string };

export type ChatCompletionResult = {
  content: string;
  model: string;
  usage: { promptTokens: number; completionTokens: number; totalTokens: number };
};

export async function llmChatCompletion(options: {
  messages: ChatCompletionMessage[];
  temperature?: number;
  maxTokens?: number;
  presencePenalty?: number;
  responseFormat?: { type: 'json_object' };
  signal?: AbortSignal;
}): Promise<ChatCompletionResult> {
  const gateway = resolveLlmGateway();
  if (!gateway) throw new Error('Missing LLM gateway API key');

  const body: Record<string, unknown> = {
    model: gateway.chatModel,
    messages: options.messages,
  };
  if (options.temperature !== undefined) body.temperature = options.temperature;
  if (options.maxTokens !== undefined) body.max_tokens = options.maxTokens;
  if (options.presencePenalty !== undefined) body.presence_penalty = options.presencePenalty;
  if (options.responseFormat) body.response_format = options.responseFormat;

  const response = await fetch(`${gateway.baseURL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${gateway.apiKey}`,
    },
    signal: options.signal,
    body: JSON.stringify(body),
  });

  const data = (await response.json().catch(() => null)) as {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
    error?: { message?: string };
  } | null;
  if (!response.ok) throw new Error(data?.error?.message || 'LLM gateway request failed');
  return {
    content: data?.choices?.[0]?.message?.content || '',
    model: gateway.chatModel,
    usage: {
      promptTokens: data?.usage?.prompt_tokens || 0,
      completionTokens: data?.usage?.completion_tokens || 0,
      totalTokens: data?.usage?.total_tokens || 0,
    },
  };
}
