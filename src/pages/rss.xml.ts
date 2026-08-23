import rss from '@astrojs/rss';
import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { absoluteUrl } from '../lib/meta';

/** 更新日志 RSS：数据每周同步后自动反映在 feed 里 */
export const GET: APIRoute = async (context) => {
  const site = context.site!;
  const logs = (await getCollection('changelog')).sort(
    (a, b) => b.data.date.getTime() - a.data.date.getTime(),
  );
  return rss({
    title: 'FitModel 更新日志',
    description: 'FitModel 的每次数据与内容变更：新证据采集、校验结果、排名变化。',
    site: absoluteUrl('/', site),
    items: logs.map((l) => ({
      title: l.data.title,
      pubDate: l.data.date,
      description: l.data.entries.map((e) => `· ${e}`).join('\n'),
      link: absoluteUrl(`/changelog/#${l.id}`, site),
    })),
    customData: '<language>zh-CN</language>',
  });
};
