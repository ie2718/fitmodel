import { defineConfig } from 'astro/config';

export default defineConfig({
  // 部署前替换为真实域名
  site: 'https://fitmodel.example.com',
  trailingSlash: 'ignore',
});
