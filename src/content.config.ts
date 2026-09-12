import { defineCollection, z } from 'astro:content';
import { glob, file } from 'astro/loaders';

/**
 * 场景集合：评分的「人为输入」只有维度权重（weights 公示于页面）。
 * 推荐结论不再手写，由 evidence.yaml + scoring.ts 在构建时计算生成。
 */
const scenarios = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/scenarios' }),
  schema: z
    .object({
      title: z.string(),
      category: z.enum(['writing', 'coding', 'research', 'office', 'creative']),
      summary: z.string(),
      status: z.enum(['draft', 'verified']).default('draft'),
      last_verified: z.coerce.date(),
      scoring_disabled: z.boolean().default(false),
      scoring_note: z.string().optional(),
      dimensions: z
        .array(
          z.object({
            id: z.enum(['general', 'coding', 'writing', 'long_context']),
            weight: z.number().min(0).max(1),
          }),
        )
        .default([]),
      pitfalls: z.array(z.string()).default([]),
      sources: z.array(z.object({ label: z.string(), url: z.string() })).default([]),
    })
    .refine(
      (d) => d.scoring_disabled || Math.abs(d.dimensions.reduce((a, x) => a + x.weight, 0) - 1) < 0.001,
      { message: '维度权重之和必须为 1（或显式 scoring_disabled）' },
    ),
});

/** 模型库：厂商与可用性等背景信息 */
const models = defineCollection({
  loader: file('src/data/models.yaml'),
  schema: z.object({
    id: z.string(),
    name: z.string(),
    vendor: z.string(),
    origin: z.enum(['global', 'cn']),
    context: z.string(),
    api_pricing: z.string(),
    subscription: z.string().optional(),
    availability_cn: z.enum(['direct', 'restricted', 'unavailable']),
    strengths: z.array(z.string()),
    current_version: z.string(),
    needs_verification: z.boolean().default(true),
  }),
});

/** 产品与工具库 */
const products = defineCollection({
  loader: file('src/data/products.yaml'),
  schema: z.object({
    id: z.string(),
    name: z.string(),
    vendor: z.string(),
    category: z.enum(['chat', 'coding', 'research', 'creative', 'office', 'search']),
    models_used: z.array(z.string()).default([]),
    pricing: z.string(),
    free_tier: z.string().default(''),
    availability_cn: z.enum(['direct', 'restricted', 'unavailable']),
    url: z.string().optional(),
    notes: z.string().default(''),
    /** Harness 类产品（AI 编程工具 / Agent 框架 / IDE）——不进场景免费档，规划中的 Harness 榜单承载 */
    harness: z.boolean().default(false),
  }),
});

/** 指标注册表：见 metrics.yaml 头注 */
const metrics = defineCollection({
  loader: file('src/data/metrics.yaml'),
  schema: z.object({
    id: z.string(),
    label: z.string(),
    dimension: z.string(),
    unit: z.string(),
    direction: z.enum(['higher', 'lower']),
    source_tier: z.number(),
    freshness_days: z.number(),
    plausible: z.tuple([z.number(), z.number()]),
    aggregator: z.string(),
    /** 指标在维度内的相对权重（缺省 1.0）；调整需人工确认并留痕（见 metrics.yaml 头注） */
    weight: z.number().min(0).default(1),
    /** 缺席先验：现役精选榜缺席 ⇒ 非现役收缩（pct/se 公示，见 scoring.ts 4.5） */
    absence_prior: z.object({ pct: z.number(), se: z.number() }).optional(),
    /** 区间型指标的测量噪声（同单位）：σ_eff = √(组内σ²+noise²)，防拥挤前沿 z-score 放大噪声 */
    noise_sd: z.number().min(0).optional(),
    source: z.string(),
    description: z.string().optional(),
    cohort_size: z.number().optional(),
  }),
});

/** 证据库：见 evidence.yaml 头注 */
const evidence = defineCollection({
  loader: file('src/data/evidence.yaml'),
  schema: z.object({
    id: z.string(),
    metric: z.string(),
    subject: z.string(),
    variant: z.string(),
    value: z.number(),
    source: z.string(),
    source_url: z.string().url(),
    retrieved_at: z.coerce.date(),
    verified: z.boolean().default(false),
    notes: z.string().optional(),
  }),
});

/** 更新日志 */
const changelog = defineCollection({
  loader: file('src/data/changelog.yaml'),
  schema: z.object({
    id: z.string(),
    date: z.coerce.date(),
    title: z.string(),
    entries: z.array(z.string()),
  }),
});

export const collections = { scenarios, models, products, metrics, evidence, changelog };
