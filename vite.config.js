import { defineConfig, loadEnv } from 'vite';
import legacy, { cspHashes } from '@vitejs/plugin-legacy';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

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
    transformIndexHtml: { order: 'post', handler: cspHandler },
  };
  function cspHandler(html) {
    const app = env.APP_BUILD === '1';
    // 头部判断语言的小脚本、启动画面的脚本：按内容摘要放行（内容一改，摘要跟着变）
    const own = [...html.matchAll(/<script id="(?:splash|lang)-js">([\s\S]*?)<\/script>/g)].map((m) => createHash('sha256').update(m[1], 'utf8').digest('base64'));
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
      // 老浏览器兼容层的几段固定小脚本，按内容摘要放行（不是放开所有行内脚本）
      // 注意：手机应用里 Capacitor 把桥接脚本插在 <head> 最前面、这条策略之前，所以不受影响（已用模拟测过）
      `script-src 'self' ${[...cspHashes, ...own].map((h) => `'sha256-${h}'`).join(' ')}${app ? " 'unsafe-inline'" : ''}`,
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
  }
}

/** 启动画面里的默认语言跟 src/i18n/index.js 的 DEFAULT_LANG 保持一致（上线前改成 tg 时这里自动跟着变） */
function splashLang() {
  const m = readFileSync(new URL('./src/i18n/index.js', import.meta.url), 'utf8').match(/export const DEFAULT_LANG = '(\w+)'/);
  const lang = m ? m[1] : 'tg';
  return {
    name: 'splash-lang',
    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        // 词典按需下载：启动脚本一判断出语言，就和主程序同时预先下载那一种的词典（不等主程序下完再去下）
        const dicts = {};
        for (const c of Object.values((ctx && ctx.bundle) || {}))
          if (c.type === 'chunk' && c.facadeModuleId && /src\/i18n\/(zh|tg|ru|uz|ky)\.js$/.test(c.facadeModuleId) && !/-legacy/.test(c.fileName))
            dicts[c.facadeModuleId.match(/(\w+)\.js$/)[1]] = c.fileName;
        return html.replaceAll("'__DEFAULT_LANG__'", `'${lang}'`).replaceAll("'__DICT_FILES__'", JSON.stringify(dicts));
      },
    },
  };
}

/**
 * 离线缓存清单：构建完后把这一版的文件写进 sw.js，第一次打开就整个存好（断网也能打开每一页、自动定位）。
 * 不预存：古兰经各章经文（大，读到哪章存哪章）、老手机兼容版（新手机用不到）、地图大底图以外的都存。
 */
function swPrecache() {
  let outDir = 'dist';
  const all = new Set();
  return {
    name: 'sw-precache',
    apply: 'build',
    configResolved(c) {
      outDir = c.build.outDir;
    },
    // 新版和老手机兼容版各打包一次：两次的文件都记下，全部写完后再写进 sw.js
    writeBundle(_, bundle) {
      for (const f of Object.keys(bundle)) all.add(f);
    },
    closeBundle() {
      const files = [...all]
        .filter((f) => /^assets\//.test(f) && /\.(js|css|woff2)$/.test(f))
        .filter((f) => !/-legacy|polyfills/.test(f))
        .filter((f) => !/^assets\/(ar|zh|tg|ru|uz|ky)-\d-/.test(f))
        .map((f) => './' + f)
        .sort();
      const p = join(outDir, 'sw.js');
      if (!files.length || !existsSync(p)) return;
      const id = createHash('sha256').update(files.join('\n')).digest('hex').slice(0, 12);
      const src = readFileSync(p, 'utf8').replace("'__BUILD__'", JSON.stringify(id)).replace('[]; /* __PRECACHE__ */', JSON.stringify(files) + ';');
      writeFileSync(p, src);
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, process.cwd(), ''), ...process.env };
  return {
    base: './', // 相对路径：放到任何子目录（如 GitHub Pages）都能打开
    define: { __APP_VERSION__: JSON.stringify(pkg.version) }, // 应用版本（统计、提示更新用）
    plugins: [
      // 老手机：不支持新版脚本的浏览器（约 2017 年以前的安卓浏览器、iOS 10）自动改用兼容版；新手机不受影响
      legacy({ targets: ['chrome >= 49', 'safari >= 10', 'ios >= 10', 'android >= 5'], modernPolyfills: false }),
      splashLang(),
      contentSecurityPolicy(env),
      swPrecache(),
    ],
    build: {
      // 新版脚本的目标由兼容层决定（支持模块的浏览器）；样式按老一些的手机处理
      cssTarget: ['safari10', 'chrome49'],
      assetsInlineLimit: 0,
    },
  };
});
