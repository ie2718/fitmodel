import { defineConfig } from 'astro/config';

export default defineConfig({
  // GitHub Pages 项目页部署在子路径下;换自定义域名时把 base 一并去掉
  site: 'https://ie2718.github.io',
  base: '/fitmodel',
  trailingSlash: 'ignore',
});
