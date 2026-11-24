import { defineConfig } from 'vite';

export default defineConfig({
  base: './', // 相对路径：放到任何子目录（如 GitHub Pages）都能打开
  build: {
    // 兼容老一些的手机和微信内置浏览器（iOS 13+ / 安卓 Chrome 80+）
    target: ['es2019', 'safari13', 'chrome80'],
    cssTarget: ['safari13', 'chrome80'],
    assetsInlineLimit: 0,
  },
});
