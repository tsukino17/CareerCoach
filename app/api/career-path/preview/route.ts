import { NextResponse } from 'next/server';
import { generateObject } from 'ai';
import { z } from 'zod';
import { buildPathMapPreview, filterCareerProfileMaterialMessages, type PathMapPreview } from '@/lib/career-path';
import { createLlmClient } from '@/lib/tokendance';
import { recordAiUsage } from '@/lib/token-usage';

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
  messages: z.array(z.object({
    role: z.string(),
    content: z.string().max(2000),
  })).max(20).optional().default([]),
});

const modelPreviewSchema = z.object({
  headline: z.string().min(8).max(80),
  introduction: z.string().min(20).max(160),
  evidence_summary: z.string().min(20).max(120),
  work_profile: z.object({
    preferred_problems: z.string().min(12).max(72),
    work_style: z.string().min(12).max(72),
    value_for: z.string().min(12).max(72),
  }),
  direction_clusters: z.array(z.object({
    id: z.string(),
    name: z.string().min(6).max(28),
    tagline: z.string().min(12).max(56),
    sample_roles: z.array(z.string().min(2).max(24)).min(2).max(4),
    fit_reason: z.string().min(18).max(72),
    evidence: z.array(z.string().min(8).max(100)).min(1).max(3),
    uncertainty: z.string().min(16).max(120),
    first_action: z.string().min(16).max(120),
  })).min(1).max(3),
});

async function buildEvidenceBasedPreview(
  req: Request,
  report: z.infer<typeof previewSchema>['report'],
  messages: z.infer<typeof previewSchema>['messages'],
  basePreview: PathMapPreview
) {
  const llm = createLlmClient();
  if (!llm) return basePreview;

  const { object, usage } = await generateObject({
    model: llm.openai(llm.chatModel),
    schema: modelPreviewSchema,
    mode: 'json',
    system: `你是 EchoTalent 的职业路径分析师。请基于用户职业报告、真实对话线索和候选方向，生成一份可追溯的现实路径预览。

要求：
- 只输出 JSON。
- 保留 direction_clusters 的 id 和数量，但需要根据用户资料重新生成面向用户的岗位族名称、说明和代表岗位。
- name 必须是具体的“岗位族/职业方向”，例如“用户体验与产品优化方向”“研究洞察与策略方向”，禁止输出“XX型”人格分类。
- sample_roles 必须是市场中可识别的具体岗位，不使用自创、过度细分或诗意化岗位名。
- work_profile 总结用户更喜欢解决什么问题、倾向如何工作、希望为谁创造什么价值；只依据已有线索，不足时使用审慎措辞。
- headline 要直接概括当前最值得验证的现实方向，不要复述人格原型，不用“翻译成职业”句式。
- introduction 说明这份判断来自什么、能帮助用户做什么，不写空泛鼓励。
- evidence_summary 说明使用了哪些资料层级；资料不足时必须坦诚说明。
- 每个方向的 evidence 只能引用报告或用户真实表达中可定位的能力、动机、偏好、经历或岗位兴趣，不得把推测写成事实。
- fit_reason 只用 1-2 句话简要解释推荐原因，控制在 28-55 个中文字符，不重复证据原文。
- uncertainty 明确当前还不知道什么，以及为什么还不能下最终结论。
- first_action 必须是用户进入 /path 后 15-30 分钟可完成的一项低成本现实验证，包含对象和完成标准。
- 所有方向都是优选参考，不得暗示其他职业不适合用户，不使用“最匹配”“避免浪费时间”“排除其他方向”等排他性表述。
- 主方向说明为什么值得先关注；备选方向说明另一种可能的优势发挥方式。
- 禁止套话和隐喻，不使用“独特禀赋”“锚定真实岗位”“天然适合”“完美匹配”等过度结论。
- 不编造简历经历、工作偏好、行业背景或对话内容。
- 语言简洁、具体、有人味。`,
    prompt: JSON.stringify({
      report,
      userMessages: messages.filter((message) => message.role === 'user'),
      basePreview,
    }),
  });
  await recordAiUsage({ req, route: 'career-path/preview', model: llm.chatModel, usage });

  const analysisById = new Map(object.direction_clusters.map((item) => [item.id, item]));
  return {
    ...basePreview,
    headline: object.headline || basePreview.headline,
    introduction: object.introduction || basePreview.introduction,
    evidence_summary: object.evidence_summary || basePreview.evidence_summary,
    work_profile: object.work_profile || basePreview.work_profile,
    direction_clusters: basePreview.direction_clusters.map((cluster) => ({
      ...cluster,
      name: analysisById.get(cluster.id)?.name || cluster.name,
      tagline: analysisById.get(cluster.id)?.tagline || cluster.tagline,
      sample_roles: analysisById.get(cluster.id)?.sample_roles || cluster.sample_roles,
      fit_reason: analysisById.get(cluster.id)?.fit_reason || cluster.fit_reason,
      evidence: analysisById.get(cluster.id)?.evidence || cluster.evidence,
      uncertainty: analysisById.get(cluster.id)?.uncertainty || cluster.uncertainty,
      first_action: analysisById.get(cluster.id)?.first_action || cluster.first_action,
    })),
  };
}

export async function POST(req: Request) {
  try {
    const body = previewSchema.parse(await req.json());
    const messages = filterCareerProfileMaterialMessages(body.messages).slice(-16);
    const basePreview = buildPathMapPreview(body.report, messages);
    const preview = await buildEvidenceBasedPreview(req, body.report, messages, basePreview).catch((error) => {
      console.warn('[career-path-preview] model polish failed, using base preview', error);
      return basePreview;
    });
    return NextResponse.json(preview);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to build preview';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
