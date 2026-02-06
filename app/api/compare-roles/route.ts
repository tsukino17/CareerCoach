import { createOpenAI } from '@ai-sdk/openai';
import { generateObject } from 'ai';
import { z } from 'zod';
import { sanitizeResponseContent } from '@/lib/utils';
import { GEM_POLISHER_V2_REPORT_PROMPT } from '@/lib/prompt-versions';

export const maxDuration = 60;

const roleComparisonSchema = z.object({
  role1_analysis: z.object({
    role_name: z.string(),
    salary_range: z.string().describe('Estimated salary range in China'),
    match_score: z.number().min(1).max(100).describe('Compatibility score based on user profile'),
    pros: z.array(z.string()).describe('Top 3 advantages for the user'),
    cons: z.array(z.string()).describe('Top 3 challenges for the user'),
  }),
  role2_analysis: z.object({
    role_name: z.string(),
    salary_range: z.string().describe('Estimated salary range in China'),
    match_score: z.number().min(1).max(100).describe('Compatibility score based on user profile'),
    pros: z.array(z.string()).describe('Top 3 advantages for the user'),
    cons: z.array(z.string()).describe('Top 3 challenges for the user'),
  }),
  comparison_summary: z.string().describe('A balanced comparison highlighting key differences'),
  recommendation: z.string().describe('A clear recommendation on which might be a better starting point and why'),
});

export async function POST(req: Request) {
  try {
    const { roles, archetype, context } = await req.json();

    if (!roles || roles.length !== 2) {
      return new Response(JSON.stringify({ error: 'Exactly two roles are required for comparison' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const openai = createOpenAI({
      baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      apiKey: process.env.DASHSCOPE_API_KEY,
    });

    const systemPrompt = `You are an expert career counselor.
    Your task is to compare two potential career paths for a user with the archetype "${archetype}".
    User Context: ${JSON.stringify(context)}
    
    Analyze both roles deeply and provide a side-by-side comparison.
    Focus on practical aspects: salary, fit, growth potential, and daily reality.
    
    **GUIDELINES**:
    1. **Language**: Simplified Chinese (简体中文).
    2. **Tone**: 
       - **Professional & Objective**: Maintain a neutral, professional stance. Avoid slang or overly casual expressions.
       - **Encouraging**: Highlight the positive aspects of both roles to inspire the user.
       - **Kind**: Present challenges as "constructive considerations" rather than negatives.
    3. **Formatting & Punctuation**: 
       - **STRICTLY FORBIDDEN**: Single quotes ('').
       - **REQUIRED**: Use Chinese double quotes (“”) for any emphasis.
       - **REQUIRED**: Use proper Chinese punctuation (，。、：) throughout.
    
    Output structured JSON.`;

    const { object } = await generateObject({
      model: openai('qwen-plus'),
      schema: roleComparisonSchema,
      system: systemPrompt,
      messages: [
        { role: 'user', content: `Compare the roles of "${roles[0]}" and "${roles[1]}" for me.` }
      ],
      mode: 'json',
    });

    const sanitizedObject = sanitizeResponseContent(object);

    return new Response(JSON.stringify(sanitizedObject), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Role Comparison Error:', error);
    return new Response(JSON.stringify({ error: 'Failed to compare roles', details: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
    });
  }
}
