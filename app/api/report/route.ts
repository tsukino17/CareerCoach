import { createOpenAI } from '@ai-sdk/openai';
import { generateObject } from 'ai';
import { z } from 'zod';
import { sanitizeResponseContent } from '@/lib/utils';
import { GEM_POLISHER_V2_REPORT_PROMPT } from '@/lib/prompt-versions';

export const runtime = 'edge';
export const maxDuration = 60;

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
    potential_roles: z.array(z.string()).describe('2-3 concrete job roles or work scenarios')
  })).describe('An array of 3 unique, deep strengths with potential roles'),
  summary: z.string().describe('A 2-3 sentence psychological summary'),
});

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();

    const openai = createOpenAI({
      baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      apiKey: process.env.DASHSCOPE_API_KEY,
    });

    const systemPrompt = GEM_POLISHER_V2_REPORT_PROMPT;

    const { object } = await generateObject({
      model: openai('qwen-plus'),
      schema: reportSchema,
      system: systemPrompt,
      messages: messages,
      mode: 'json',
    });

    const sanitizedObject = sanitizeResponseContent(object);

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
