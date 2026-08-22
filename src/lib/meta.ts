export const CATEGORIES = [
  { id: 'writing', label: '写作', desc: '文案、长文、论文、翻译' },
  { id: 'coding', label: '编程', desc: '补全、Agent 工程、原型、审查' },
  { id: 'research', label: '研究', desc: '深度研究、搜索、长文档' },
  { id: 'office', label: '办公', desc: 'PPT、表格、会议纪要' },
  { id: 'creative', label: '创意', desc: '图像、多模态创作' },
] as const;

export const CATEGORY_MAP: Record<string, { id: string; label: string; desc: string }> =
  Object.fromEntries(CATEGORIES.map((c) => [c.id, c]));

export const TIERS: Record<
  string,
  { label: string; cls: string; short: string }
> = {
  free: { label: '免费够用', cls: 'tier-free', short: '免费' },
  value: { label: '性价比', cls: 'tier-value', short: '性价比' },
  top: { label: '最强', cls: 'tier-top', short: '最强' },
};

export const AVAIL: Record<
  string,
  { label: string; cls: string }
> = {
  direct: { label: '国内直接可用', cls: 'ok' },
  restricted: { label: '国内访问受限', cls: 'warn' },
  unavailable: { label: '国内不可用', cls: 'bad' },
};

/** 鲜度规则：<30 天绿，30–60 天黄，>60 天红。构建时计算，所以保持重新构建即刷新。 */
export function freshness(date: Date): { label: string; cls: string } {
  const days = Math.floor((Date.now() - date.getTime()) / 86400000);
  if (days <= 30) return { label: `已验证 ${days} 天内`, cls: 'ok' };
  if (days <= 60) return { label: `距上次验证 ${days} 天`, cls: 'warn' };
  return { label: `信息可能过时（${days} 天未验证）`, cls: 'bad' };
}
