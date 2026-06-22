import { NextResponse } from 'next/server';
import { createOpenAI } from '@ai-sdk/openai';
import { generateObject } from 'ai';
import { z } from 'zod';
import { buildPathMapPreview, type PathMapPreview } from '@/lib/career-path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const previewSchema = z.object({
  report: z.object({
    archetype: z.string(),
    skills: z.array(z.string()).default([]),
    rpg_stats: z.array(z.object({ name: z.string(), value: z.number() })).optional(),
    superpowers: z.array(
      z.union([
        z.string(),
        z.object({
          name: z.string(),
          description: z.string(),
          potential_roles: z.array(z.string()).optional(),
        }),
      ])
    ),
    summary: z.string(),
    target_roles: z.array(z.string()).optional(),
  }),
});

const modelPreviewSchema = z.object({
  headline: z.string().min(8).max(80),
  introduction: z.string().min(20).max(160),
  direction_clusters: z.array(z.object({
    id: z.string(),
    fit_reason: z.string().min(24).max(140),
  })).min(1).max(3),
});

async function polishPathPreviewWithModel(report: z.infer<typeof previewSchema>['report'], basePreview: PathMapPreview) {
  if (!process.env.DASHSCOPE_API_KEY) return basePreview;

  const openai = createOpenAI({
    baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    apiKey: process.env.DASHSCOPE_API_KEY,
  });

  const { object } = await generateObject({
    model: openai('qwen-plus'),
    schema: modelPreviewSchema,
    mode: 'json',
    system: `你是 EchoTalent 的职业路径分析师。请基于用户职业报告和方向候选库，改写现实路径预览文案。

要求：
- 只输出 JSON。
- 保留 direction_clusters 的 id，不新增、不删除方向。
- 文案要像给用户的具体判断，不要像后台匹配逻辑。
- 主选方向要说明“为什么先验证它”，备选方向要说明“它和主方向的差异，以及适合如何做对照”。
- 每段 fit_reason 控制在 45-90 个中文字符。
- 禁止套话：不要使用“这是相邻备选假设”“适合用来做对照”“判断自己更适合靠近哪类工作节奏”“报告里比较突出的线索”等模板句。
- 可以引用用户报告中的能力、动机、工作偏好、具体岗位线索，但不要编造简历经历。
- 语言简洁、具体、有人味。`,
    prompt: JSON.stringify({
      report,
      basePreview,
    }),
  });

  const reasonById = new Map(object.direction_clusters.map((item) => [item.id, item.fit_reason]));
  return {
    ...basePreview,
    headline: object.headline || basePreview.headline,
    introduction: object.introduction || basePreview.introduction,
    direction_clusters: basePreview.direction_clusters.map((cluster) => ({
      ...cluster,
      fit_reason: reasonById.get(cluster.id) || cluster.fit_reason,
    })),
  };
}

export async function POST(req: Request) {
  try {
    const body = previewSchema.parse(await req.json());
    const basePreview = buildPathMapPreview(body.report);
    const preview = await polishPathPreviewWithModel(body.report, basePreview).catch((error) => {
      console.warn('[career-path-preview] model polish failed, using base preview', error);
      return basePreview;
    });
    return NextResponse.json(preview);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to build preview';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
