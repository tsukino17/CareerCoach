import { createOpenAI } from '@ai-sdk/openai';
import { generateObject } from 'ai';
import { z } from 'zod';
import { sanitizeResponseContent } from '@/lib/utils';
import { GENTLE_BREEZE_V4_REPORT_PROMPT } from '@/lib/prompt-versions';
import { checkRateLimitDistributed, getClientIp, normalizeMessages, rateLimitResponse } from '@/lib/rate-limit';
import { filterCareerProfileMaterialMessages } from '@/lib/career-path';

export const runtime = 'nodejs';
export const maxDuration = 120;

const UI_ACTION_PREFIXES = ['[EchoTalent UI Action:'];
const MAX_REPORT_MESSAGES = 28;
const MAX_REPORT_CONTENT_LENGTH = 1000;

const reportSchema = z.object({
  archetype: z.string().describe('A creative, 2-3 word title for their career personality'),
  skills: z.array(z.string()).describe('An array of 3-5 hard or soft skills'),
  rpg_stats: z.array(z.object({
    name: z.string(),
    value: z.number().min(1).max(100)
  })).describe('An array of 5-6 RPG-style attributes'),
  superpowers: z.array(z.object({
    name: z.string(),
    description: z.string().describe('Description of the strength'),
    potential_roles: z.array(z.string()).min(2).max(4).describe('2-4 concrete job roles or work scenarios that fit this strength')
  })).describe('An array of 3 unique, deep strengths with concrete potential roles'),
  summary: z.string().describe('A 2-3 sentence psychological summary'),
});

export async function POST(req: Request) {
  const startedAt = Date.now();
  try {
    const ip = getClientIp(req);
    const limit = await checkRateLimitDistributed({ key: `report:${ip}`, limit: 6, windowMs: 60 * 60 * 1000 });
    if (!limit.ok) return rateLimitResponse(limit.resetAt);

    const { messages } = await req.json();
    const normalizedMessages = normalizeMessages(messages, {
      maxMessages: MAX_REPORT_MESSAGES,
      maxContentLength: MAX_REPORT_CONTENT_LENGTH,
      allowSystem: false,
    }).filter((message) => !UI_ACTION_PREFIXES.some((prefix) => message.content.startsWith(prefix)));
    const chatMessages = filterCareerProfileMaterialMessages(normalizedMessages)
      .map((message) => ({
        role: message.role as 'user' | 'assistant' | 'system',
        content: message.content as string,
      }));
    if (chatMessages.length < 4) {
      return new Response(JSON.stringify({ error: 'Not enough conversation context' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (!process.env.DASHSCOPE_API_KEY) {
      return new Response(JSON.stringify({ error: 'Missing model API key' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const openai = createOpenAI({
      baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      apiKey: process.env.DASHSCOPE_API_KEY,
    });

    const systemPrompt = GENTLE_BREEZE_V4_REPORT_PROMPT;

    const { object } = await generateObject({
      model: openai('qwen-plus'),
      schema: reportSchema,
      system: systemPrompt,
      messages: chatMessages,
      mode: 'json',
    });
    const modelFinishedAt = Date.now();

    const sanitizedObject = sanitizeResponseContent(object);
    console.info('[report] generated', {
      messages: chatMessages.length,
      modelMs: modelFinishedAt - startedAt,
      totalMs: Date.now() - startedAt,
    });

    return new Response(JSON.stringify(sanitizedObject), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Report Generation Error:', error);
    return new Response(JSON.stringify({ error: 'Failed to generate report' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
    });
  }
}
