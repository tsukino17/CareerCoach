import { createOpenAI } from '@ai-sdk/openai';
import { streamText, tool } from 'ai';
import { z } from 'zod';
import { GENTLE_BREEZE_V4_CHAT_PROMPT } from '@/lib/prompt-versions';
import { checkRateLimitDistributed, getClientIp, normalizeMessages, rateLimitResponse } from '@/lib/rate-limit';

export const runtime = 'edge';
export const maxDuration = 30;
export const preferredRegion = ['hkg1', 'sin1', 'iad1']; // Prioritize Asia regions if available on plan

const CONTINUE_CHAT_CONTROL_PREFIX = '[EchoTalent UI Action: continue_current_topic]';

export async function POST(req: Request) {
  try {
    const ip = getClientIp(req);
    const limit = await checkRateLimitDistributed({ key: `chat:${ip}`, limit: 30, windowMs: 10 * 60 * 1000 });
    if (!limit.ok) return rateLimitResponse(limit.resetAt);

    const { messages } = (await req.json()) as { messages?: unknown };
    if (!Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: 'Invalid messages' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const chatMessages = normalizeMessages(messages, {
      maxMessages: 40,
      maxContentLength: 1500,
      allowSystem: false,
    });
    if (chatMessages.length === 0) {
      return new Response(JSON.stringify({ error: 'Invalid messages' }), {
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

    const isContinueChatAction = chatMessages.some(
      (message) => message.role === 'user' && message.content.startsWith(CONTINUE_CHAT_CONTROL_PREFIX)
    );

    let systemPrompt = GENTLE_BREEZE_V4_CHAT_PROMPT;
    systemPrompt += `
      **Tools**:
      - You have access to a "getSalaryInsight" tool. If the user asks about salary trends or market rates for a specific role and city, USE THIS TOOL to get data, then incorporate the findings into your empathetic response. Do not make up numbers if you can use the tool.
      - You have access to a "enableReportButton" tool. Call this tool simultaneously when you ask the user if they want to generate the report.
      - Never write the full structured career report in chat. If the user wants a report, guide them to click the product report button.
      
      Start by welcoming them if it's a fresh conversation (though the UI may show a welcome message).
    `;
    if (isContinueChatAction) {
      systemPrompt += `
        **Continue-chat UI action**:
        The latest user message may be an EchoTalent UI action rather than a real user utterance.
        If it starts with "${CONTINUE_CHAT_CONTROL_PREFIX}", treat it only as a request to continue the current conversation.
        Do not interpret that text as user self-disclosure. Do not start a new topic.
        Resume from the most recent real user concern and ask one gentle, concrete follow-up question.
        Do not mention the report button unless the user asks about the report.
      `;
    }

    const result = streamText({
      model: openai('qwen-plus'),
      system: systemPrompt,
      messages: chatMessages,
      tools: {
        enableReportButton: tool({
            description: 'Call this tool when you have gathered enough information about the user (Preferences, Willingness, Capabilities, Talents, Inclinations) and you have just asked the user if they want to see the report.',
            parameters: z.object({
              reason: z.string().describe('The reason why you think the profile is complete.'),
            }),
            execute: async ({ reason }) => {
              return JSON.stringify({ status: 'enabled', reason });
            },
        }),
        getSalaryInsight: tool({
          description: 'Get salary range insights for a specific job role in a city. Returns estimated monthly salary in RMB.',
          parameters: z.object({
            role: z.string().describe('The job role, e.g. "Frontend Developer", "Product Manager"'),
            city: z.string().describe('The city, e.g. "Beijing", "Shanghai", "Shenzhen"'),
          }),
          execute: async ({ role, city }) => {
            // Mock data for demonstration
            // In a real app, this would fetch from an external API
            const baseMap: Record<string, number> = {
              'Beijing': 5000,
              'Shanghai': 5000,
              'Shenzhen': 4000,
              'Guangzhou': 3000,
              'Hangzhou': 2000,
            };
            const cityBonus = baseMap[city] || 0;
            const baseSalary = 15000 + cityBonus; 
            // Simple random variation for demo
            const variation = Math.floor(Math.random() * 5000);
            const min = baseSalary + variation;
            const max = min + 8000;
            
            return JSON.stringify({
              role,
              city,
              salary_range: `${Math.round(min/1000)}k-${Math.round(max/1000)}k RMB/month`,
              market_trend: 'Stable',
              source: 'Market Trend Database (Mock)'
            });
          },
        }),
      },
      maxSteps: 5,
    });
  
    return result.toDataStreamResponse();
  } catch (error) {
    console.error('API Error:', error);
    return new Response(JSON.stringify({ error: 'Failed to process request' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
    });
  }
}
