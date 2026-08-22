import type { FitResult, ScoreEngine } from './scoring';
import { confidenceLabel } from './scoring';

/**
 * 三档推荐计算（确定性规则，首页与场景页共用，保证口径一致）：
 * - TOP   = 场景排名第 1
 * - VALUE = 性价比分最高（且不与 TOP 重复）
 * - FREE  = 有免费额度的产品中，底座模型适配分最高
 */

export interface ModelLike {
  id: string;
  data: { id: string; name: string; availability_cn: string; [k: string]: unknown };
}
export interface ProductLike {
  id: string;
  data: {
    id: string;
    name: string;
    category: string;
    models_used: string[];
    free_tier: string;
    availability_cn: string;
    url?: string;
    [k: string]: unknown;
  };
}

export interface Picks {
  ranked: FitResult[];
  top: FitResult | null;
  valuePick: FitResult | null;
  freePick: { product: ProductLike['data']; best: FitResult } | null;
}

/** 场景品类 → 免费档可选的产品品类（避免写作场景推荐 IDE 这类错配） */
const FREE_PRODUCT_CATS: Record<string, string[]> = {
  writing: ['chat'],
  coding: ['coding'],
  research: ['chat', 'search'],
  office: ['chat', 'office'],
  creative: ['creative', 'chat'],
};

export function computePicks(
  engine: ScoreEngine,
  weights: Record<string, number>,
  models: ModelLike[],
  products: ProductLike[],
  scenarioCategory?: string,
): Picks {
  const ranked = engine.rank(weights);

  const top = ranked[0] ?? null;

  const valuePick =
    ranked
      .filter((r) => r.value !== null)
      .sort((a, b) => (b.value ?? 0) - (a.value ?? 0))[0] ?? null;

  const bestFitOfFamily = (mid: string) =>
    ranked
      .filter((r) => r.entity.subject === mid)
      .sort((a, b) => (b.fit ?? 0) - (a.fit ?? 0))[0] ?? null;

  const isFree = (p: ProductLike) =>
    !!p.data.free_tier && !p.data.free_tier.startsWith('无');

  const allowedCats = scenarioCategory ? FREE_PRODUCT_CATS[scenarioCategory] : undefined;
  const freeCandidates = products
    .filter(isFree)
    .filter((p) => !allowedCats || allowedCats.includes(p.data.category))
    .map((p) => ({
      product: p.data,
      best: p.data.models_used.map(bestFitOfFamily).filter(Boolean)[0] ?? null,
    }))
    .filter((x): x is { product: ProductLike['data']; best: FitResult } => x.best !== null);

  // 免费档优先国内直连产品：存在直连候选时排除访问受限产品
  const direct = freeCandidates.filter((c) => c.product.availability_cn === 'direct');
  const pool = direct.length > 0 ? direct : freeCandidates;
  const freePick = [...pool].sort((a, b) => (b.best.fit ?? 0) - (a.best.fit ?? 0))[0] ?? null;

  return { ranked, top, valuePick, freePick };
}

export { confidenceLabel };
