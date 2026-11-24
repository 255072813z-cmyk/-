import { defineConfig, loadEnv } from 'vite';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

/**
 * 内容安全策略（防火墙的网页部分）：页面只能运行自己的脚本，只能连接自己、天气服务和我们的后台。
 * 即使哪里混进了恶意文字，也没法加载外部脚本、把数据发到别处。
 * 手机应用（APP_BUILD=1）里 Capacitor 要往页面里插一段自己的脚本，所以允许行内脚本，其余限制相同。
 */
function contentSecurityPolicy(env) {
  return {
    name: 'csp',
    apply: 'build',
    transformIndexHtml(html) {
      const app = env.APP_BUILD === '1';
      const origins = new Set(['https://api.open-meteo.com']);
      for (const v of [env.VITE_API_URL, env.VITE_PRESENCE_URL]) {
        try {
          const u = new URL(v);
          origins.add(u.origin.replace(/^ws/, 'http'));
          origins.add(u.origin.replace(/^http/, 'ws'));
        } catch (e) {
          /* 没设置 */
        }
      }
      // 本机测试（?api= ?presence= 只在本机生效）
      const local = 'http://127.0.0.1:* ws://127.0.0.1:* http://localhost:* ws://localhost:*';
      const policy = [
        "default-src 'self'",
        `script-src 'self'${app ? " 'unsafe-inline'" : ''}`,
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: blob:",
        "font-src 'self'",
        `connect-src 'self' ${[...origins].join(' ')} ${local}`,
        "manifest-src 'self'",
        "worker-src 'self'",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'none'",
      ].join('; ');
      return html.replace(
        '<meta charset="UTF-8" />',
        `<meta charset="UTF-8" />\n    <meta http-equiv="Content-Security-Policy" content="${policy}" />\n    <meta name="referrer" content="no-referrer" />`,
      );
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, process.cwd(), ''), ...process.env };
  return {
    base: './', // 相对路径：放到任何子目录（如 GitHub Pages）都能打开
    define: { __APP_VERSION__: JSON.stringify(pkg.version) }, // 应用版本（统计、提示更新用）
    plugins: [contentSecurityPolicy(env)],
    build: {
      // 兼容老一些的手机和微信内置浏览器（iOS 13+ / 安卓 Chrome 80+）
      target: ['es2019', 'safari13', 'chrome80'],
      cssTarget: ['safari13', 'chrome80'],
      assetsInlineLimit: 0,
    },
  };
});
