import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  // GitHub Pages 项目页部署在子路径下;换自定义域名时把 base 一并去掉
  site: 'https://ie2718.github.io',
  base: '/fitmodel',
  // 统一带尾斜杠,与 canonical 口径一致,避免 /leaderboards 与 /leaderboards/ 双 URL
  trailingSlash: 'always',
  integrations: [sitemap()],
});
