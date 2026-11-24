import { defineConfig } from 'vite';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

export default defineConfig({
  base: './', // 相对路径：放到任何子目录（如 GitHub Pages）都能打开
  define: { __APP_VERSION__: JSON.stringify(pkg.version) }, // 应用版本（统计、提示更新用）
  build: {
    // 兼容老一些的手机和微信内置浏览器（iOS 13+ / 安卓 Chrome 80+）
    target: ['es2019', 'safari13', 'chrome80'],
    cssTarget: ['safari13', 'chrome80'],
    assetsInlineLimit: 0,
  },
});
