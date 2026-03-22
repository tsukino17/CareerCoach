import { createOpenAI } from '@ai-sdk/openai';
import { generateObject } from 'ai';
import { z } from 'zod';
import { sanitizeResponseContent } from '@/lib/utils';

export const runtime = 'edge';
export const maxDuration = 60;

const planSchema = z.object({
  goal: z.string().describe('A clear, inspiring 1-sentence goal for this period'),
  duration: z.string().describe("e.g. '6 Weeks'"),
  phases: z.array(z.object({
    week: z.string().describe('Week range, e.g. "Week 1-2"'),
    theme: z.string().describe('Phase Theme'),
    tasks: z.array(z.object({
      day: z.string().describe('Day identifier, e.g. "Day 1"'),
      action: z.string().describe('Specific task action'),
      type: z.enum(['learning', 'action', 'connection', 'reflection']).describe('Task type')
    }))
  }))
});

type ChatMessage = { role: 'user' | 'assistant' | 'system'; content: string };
type Superpower = string | { name: string; description?: string; potential_roles?: string[] };
type ReportInput = {
  archetype: string;
  summary: string;
  skills?: string[];
  superpowers?: Superpower[];
  target_roles?: string[];
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as unknown;
    const report = (body as { report?: unknown })?.report as ReportInput | undefined;
    const messages = (body as { messages?: unknown })?.messages as unknown;
    if (!report || typeof report.archetype !== 'string' || typeof report.summary !== 'string') {
      return new Response(JSON.stringify({ error: 'Invalid report' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (!Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: 'Invalid messages' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    const chatMessages: ChatMessage[] = messages
      .map((m) => {
        const mm = m as { role?: unknown; content?: unknown };
        const role = mm.role === 'user' || mm.role === 'assistant' || mm.role === 'system' ? mm.role : null;
        const content = typeof mm.content === 'string' ? mm.content : null;
        if (!role || !content) return null;
        return { role, content };
      })
      .filter((m): m is ChatMessage => Boolean(m));

    // Log the incoming data for debugging
    console.log('Generating plan for archetype:', report?.archetype);

    const openai = createOpenAI({
      baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      apiKey: process.env.DASHSCOPE_API_KEY,
    });

    // Injecting more report context into the system prompt to ensure consistency
    const systemPrompt = `
    You are an expert career strategist and execution coach. 
    You have analyzed the user's profile and generated a career report.
    
    REPORT CONTEXT:
    - Archetype: ${report.archetype}
    - Summary: ${report.summary}
    - Top Skills: ${report.skills?.join(', ') || 'N/A'}
    - Superpowers: ${report.superpowers?.map((s) => (typeof s === 'string' ? s : s.name)).join(', ') || 'N/A'}
    
    ${report.target_roles ? `The user has specifically selected these target roles: ${report.target_roles.join(', ')}. Focus the plan on transitioning into one or both of these roles.` : ''}

    Your goal is to create a CONCRETE, ACTIONABLE 4-8 week transition plan to help them achieve their career potential based on their "Superpowers" and "Skills".

    For now, we are focusing on a desktop web experience only. Do NOT include any calendar integration fields.
 
    Generate a JSON response in Simplified Chinese (简体中文).
    
    Task Types: "learning" (input), "action" (output), "connection" (people), "reflection" (thought).
 
    IMPORTANT:
    - The plan must be highly specific to their ${report.archetype} archetype.
    - If they are a "Creator", focus on shipping. If "Analyst", focus on research/data.
    - Include specific "check-in" points where they should chat with you (the AI) for feedback.
    - **Punctuation**: Use proper Chinese punctuation (，。、：).
    - **Quotes**: STRICTLY FORBIDDEN to use single quotes (''). MUST use Chinese double quotes (“”) for any quoted text or emphasis.
    `;

    const { object } = await generateObject({
      model: openai('qwen-plus'),
      schema: planSchema,
      system: systemPrompt,
      messages: [
        ...chatMessages,
        { role: 'user', content: 'Please generate my execution plan now.' }
      ],
      mode: 'json',
    });

    const sanitizedObject = sanitizeResponseContent(object);

    return new Response(JSON.stringify(sanitizedObject), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('Plan Generation Error Full:', error);
    // Return the actual error message if possible to help debugging
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: 'Failed to generate plan', details: errorMessage }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
    });
  }
}
