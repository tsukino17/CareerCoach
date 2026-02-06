import { createOpenAI } from '@ai-sdk/openai';
import { generateObject } from 'ai';
import { z } from 'zod';
import { sanitizeResponseContent } from '@/lib/utils';

export const runtime = 'edge';
export const maxDuration = 60;

const roleAnalysisSchema = z.object({
  responsibilities: z.array(z.string()).describe('List of 3-4 key responsibilities. Be practical and grounded. Use Chinese double quotes for emphasis.'),
  daily_routine: z.string().describe('Description of a typical day. MUST be concise, bulleted points within 3 sections (上午/下午/晚上). Concrete execution of responsibilities. Use Chinese double quotes.'),
  why_fit: z.string().describe('Why this fits the user. Use Chinese double quotes.'),
  salary_range: z.string().describe('Estimated salary range in China (e.g. 15k-25k)'),
  industries_companies: z.array(z.string()).describe('List of suitable industries or representative companies'),
  core_competencies: z.array(z.string()).describe('List of 3-5 specific hard/soft skills (e.g., specific tools, methodologies). Use Chinese double quotes.'),
  selection_advice: z.string().describe('Brief advice to help user decide if this is right for them. Use Chinese double quotes for emphasis.')
});

export async function POST(req: Request) {
  try {
    const { role, archetype, context } = await req.json();

    const openai = createOpenAI({
      baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      apiKey: process.env.DASHSCOPE_API_KEY,
    });

    const systemPrompt = `
    You are an expert career counselor with a "Professional yet Inspiring" tone.
    The user has a career archetype of "${archetype}".
    They are interested in the role of "${role}".
    
    Context about user's superpower: "${context}".

    Please provide a detailed analysis in Simplified Chinese (简体中文).
    Your goal is to provide a neutral, objective, yet encouraging professional analysis.
    
    **CRITICAL CONTENT GUIDELINES**:
    1. **Tone & Style**: 
       - **Professional & Lucid**: Use professional terminology but explain it in a way that is easy to understand.
       - **Inspiring**: Use positive language to evoke aspiration.
       - **Objective & Kind**: Present challenges as "constructive considerations".
    2. **Content**:
       - **Core Competencies**: Be SPECIFIC. Do not just say "Communication skills". Say "Cross-functional collaboration using Jira/Confluence" or "Client negotiation". Mention specific tools/software where applicable.
       - **Typical Day**: 
            - **Structure**: STRICTLY provide exactly 3 lines starting with "上午：", "下午：", "晚上：".
            - **Content Limit**: For each time block, describe MAX 2 concise key tasks. 
            - **Format**: "上午：Task 1, Task 2" (No bullet points inside the line, just text).
            - **Content Focus**: Focus on key actions and outcomes. Minimize tool mentions.
    3. **Formatting & Punctuation**: 
       - **STRICTLY FORBIDDEN**: Single quotes (''). 
       - **REQUIRED**: Chinese double quotes (“”) for any emphasis or terminology.
       - **REQUIRED**: Use proper Chinese punctuation (，。、：) throughout.
    `;

    const { object } = await generateObject({
      model: openai('qwen-plus'),
      schema: roleAnalysisSchema,
      system: systemPrompt,
      messages: [
        { role: 'user', content: `Analyze the role of ${role} for me.` }
      ],
      mode: 'json',
    });

    const sanitizedObject = sanitizeResponseContent(object);

    return new Response(JSON.stringify(sanitizedObject), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Role Analysis Error:', error);
    return new Response(JSON.stringify({ error: 'Failed to analyze role' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
    });
  }
}
