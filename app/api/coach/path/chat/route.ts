import { NextResponse } from 'next/server';
import { buildRealityPathCoachPrompt, type RealityPathCoachPromptInput } from '@/lib/path-coach-prompt';
import { checkRateLimitDistributed, getClientIp, normalizeMessages, type ApiMessage } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type PathChatBody = RealityPathCoachPromptInput & {
  messages?: unknown;
};

async function requestQwen(messages: ApiMessage[], systemPrompt: string) {
  const apiKey = process.env.DASHSCOPE_API_KEY;
  if (!apiKey) throw new Error('Missing DashScope API key');

  const response = await fetch('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'qwen-plus',
      messages: [{ role: 'system', content: systemPrompt }, ...messages],
      temperature: 0.62,
      max_tokens: 700,
    }),
  });

  const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }>; error?: { message?: string } };
  if (!response.ok) throw new Error(data.error?.message || 'Qwen request failed');
  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error('Qwen returned empty content');
  return content;
}

export async function POST(req: Request) {
  let messages: ApiMessage[] = [];
  try {
    const ip = getClientIp(req);
    const limit = await checkRateLimitDistributed({ key: `path-coach:${ip}`, limit: 50, windowMs: 10 * 60 * 1000 });
    if (!limit.ok) {
      return NextResponse.json({ reply: '请求有点密集。我们先停一小会儿，再继续。' }, { status: 429 });
    }

    const body = (await req.json()) as PathChatBody;
    messages = normalizeMessages(body.messages, {
      maxMessages: 30,
      maxContentLength: 1200,
      allowSystem: false,
    });
    const reply = await requestQwen(messages, buildRealityPathCoachPrompt(body));
    return NextResponse.json({ reply, provider: 'qwen' });
  } catch (error) {
    console.error('[path-coach] qwen request failed', error);
    return NextResponse.json(
      {
        reply: '现实路径教练暂时连接不上模型。请稍后再试，刚才的输入不会被当作教练判断处理。',
        provider: 'qwen-unavailable',
      },
      { status: 503 }
    );
  }
}
