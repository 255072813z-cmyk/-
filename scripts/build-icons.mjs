// 生成安卓、苹果的图标和启动画面（从 assets/*.svg）。用法：npm run icons
import { createRequire } from 'node:module';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { execSync } from 'node:child_process';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const root = fileURLToPath(new URL('../', import.meta.url));
const svg = (f) => readFileSync(join(root, 'assets', f), 'utf8');

const browser = await chromium.launch();
async function render(svgText, size, out, { round = false, bg = null } = {}) {
  const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
  const style = `margin:0;width:${size}px;height:${size}px;overflow:hidden;background:${bg || 'transparent'}`;
  const clip = round ? `clip-path:circle(50%);` : '';
  await page.setContent(`<body style="${style}"><div style="width:${size}px;height:${size}px;${clip}">${svgText.replace('<svg ', `<svg width="${size}" height="${size}" `)}</div></body>`);
  await page.screenshot({ path: out, omitBackground: !bg });
  await page.close();
}

const res = join(root, 'android/app/src/main/res');
if (existsSync(res)) {
  const dens = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
  for (const [d, k] of Object.entries(dens)) {
    await render(svg('icon-full.svg'), 48 * k, join(res, `mipmap-${d}/ic_launcher.png`));
    await render(svg('icon-full.svg'), 48 * k, join(res, `mipmap-${d}/ic_launcher_round.png`), { round: true });
    await render(svg('icon-foreground.svg'), 108 * k, join(res, `mipmap-${d}/ic_launcher_foreground.png`));
  }
  // 启动画面：按原有文件的尺寸重画
  for (const f of execSync(`find ${res} -name splash.png`).toString().trim().split('\n')) {
    const [w, h] = execSync(`python3 -c "import struct;f=open('${f}','rb');f.read(16);print(*struct.unpack('>II',f.read(8)))"`).toString().trim().split(' ').map(Number);
    const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
    const s = Math.min(w, h) * 0.42;
    await page.setContent(`<body style="margin:0;width:${w}px;height:${h}px;background:#f7f2e6;display:grid;place-items:center">${svg('icon-full.svg').replace('<svg ', `<svg width="${s}" height="${s}" style="border-radius:${s * 0.22}px" `)}</body>`);
    await page.screenshot({ path: f });
    await page.close();
  }
}
const ios = join(root, 'ios/App/App/Assets.xcassets');
if (existsSync(ios)) {
  await render(svg('icon-full.svg'), 1024, join(ios, 'AppIcon.appiconset/AppIcon-512@2x.png'), { bg: '#0f5940' });
  for (const n of ['splash-2732x2732.png', 'splash-2732x2732-1.png', 'splash-2732x2732-2.png']) await render(svg('splash.svg'), 2732, join(ios, 'Splash.imageset', n), { bg: '#f7f2e6' });
}
await browser.close();
console.log('图标和启动画面已生成');
