
import { createOpenAI } from '@ai-sdk/openai';
import { generateText } from 'ai';

export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();

    const openai = createOpenAI({
      baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      apiKey: process.env.DASHSCOPE_API_KEY,
    });

    // Take the first few messages for summary
    const context = messages.slice(0, 4).map((m: any) => `${m.role}: ${m.content}`).join('\n');

    const { text } = await generateText({
      model: openai('qwen-plus'),
      system: `
        你是一个专业的对话总结助手。
        任务：根据用户的对话内容，生成一个简短、精准的标题。
        要求：
        1. 字数限制：4-10个中文字符。
        2. 不要使用“关于”、“对话”等无意义词汇。
        3. 直接输出标题内容，不要有引号或其他修饰。
        4. 能够体现用户的核心职业困惑或话题。
      `,
      prompt: `对话内容：\n${context}\n\n请生成标题：`,
    });

    return new Response(JSON.stringify({ title: text.trim() }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Summarize API Error:', error);
    return new Response(JSON.stringify({ error: 'Failed to generate summary' }), {
      status: 500,
    });
  }
}
