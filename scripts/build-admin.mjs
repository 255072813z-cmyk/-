// 把管理后台的页面文件打包成 server/admin-assets.js（后台服务直接返回这些文字）。
// 改了 server/admin/、shared/remote-config.js 或城市名之后运行：npm run admin
import { readFileSync, writeFileSync } from 'node:fs';

const read = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const zh = (await import('../src/i18n/zh.js')).default;
const { CITY_DATA } = await import('../src/content/cities-data.js');
const cityNames = `export const CITY_NAMES = ${JSON.stringify(CITY_DATA.map((c) => ({ id: c.id, name: zh['city.' + c.id] || c.id })))};\n`;

const JS = 'text/javascript; charset=utf-8';
export const ASSETS = {
  '/admin/': { type: 'text/html; charset=utf-8', body: read('server/admin/index.html') },
  '/admin/app.css': { type: 'text/css; charset=utf-8', body: read('server/admin/app.css') },
  '/admin/app.js': { type: JS, body: read('server/admin/app.js') },
  '/admin/remote-config.js': { type: JS, body: read('shared/remote-config.js') },
  '/admin/city-names.js': { type: JS, body: cityNames },
};
const out = `// 自动生成：npm run admin（scripts/build-admin.mjs）。请勿手改。\nexport const ASSETS = ${JSON.stringify(ASSETS, null, 1)};\n`;
if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  writeFileSync(new URL('../server/admin-assets.js', import.meta.url), out);
  console.log(`admin-assets.js: ${(out.length / 1024).toFixed(1)} KB`);
}
export const OUTPUT = out;
