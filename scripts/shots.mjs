// 验收截图：手机 / 平板 / 电脑 三种尺寸，逐页截图，并检查
//  1) 有没有横向滚动（排版溢出）  2) 控制台有没有报错
// 用法：npm run build && npm run shots   （截图在 shots/ 目录）
// 可选：SHOTS_ONLY=phone  只截手机；SHOTS_QUERY='?weather=heavy&now=2026-12-20T15:20' 指定演示参数
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const root = fileURLToPath(new URL('../dist/', import.meta.url));
const outDir = fileURLToPath(new URL('../shots/', import.meta.url));
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.woff': 'font/woff', '.webmanifest': 'application/manifest+json' };

const server = createServer(async (req, res) => {
  const p = normalize(decodeURIComponent(req.url.split('?')[0])).replace(/^([/\\])+/, '');
  try {
    const body = await readFile(join(root, p || 'index.html'));
    res.writeHead(200, { 'content-type': TYPES[extname(p)] || 'text/html; charset=utf-8' });
    res.end(body);
  } catch (e) {
    res.writeHead(404);
    res.end();
  }
}).listen(0);
const base = `http://127.0.0.1:${server.address().port}/`;

const VIEWS = {
  phone: { width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
  tablet: { width: 820, height: 1180, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
  desktop: { width: 1366, height: 900, deviceScaleFactor: 1 },
};
const PAGES = [
  ['home', ''],
  ['pray', '#/pray'],
  ['wudu', '#/pray/wudu'],
  ['guide', '#/pray/guide/dhuhr'],
  ['steps', '#/pray/guide/dhuhr/fard', 4],
  ['steps-sujud', '#/pray/guide/dhuhr/fard', 10],
  ['qibla', '#/qibla'],
  ['tasbih', '#/tasbih'],
  ['settings', '#/settings'],
  ['ramadan-before', '#/ramadan'],
  ['ramadan', '#/ramadan', 0, '?weather=clear&now=2027-02-20T17:50'],
  ['ramadan-iftar', '#/ramadan', 0, '?weather=clear&now=2027-02-20T18:30'],
  ['home-ramadan', '', 0, '?weather=clear&now=2027-02-20T05:20'],
  ['tarawih', '#/ramadan/tarawih', 0, '?weather=clear&now=2027-02-20T20:30'],
  ['quran', '#/ramadan/quran', 0, '?weather=clear&now=2027-02-20T12:00'],
  ['masjid', '#/masjid', 0, '?weather=clear&now=2026-12-18T14:10'],
  ['hall', '#/masjid/hall', 0, '?weather=clear&now=2026-12-18T14:10'],
  ['hall-sit', '#/masjid/hall', 0, '?weather=clear&now=2026-12-18T14:10', '[data-mat="34"]'],
  ['courtyard', '#/masjid/courtyard', 0, '?weather=clear&now=2026-12-18T14:10', '[data-tea]'],
  ['poetry', '#/masjid/poetry', 0, '?weather=clear&now=2026-12-18T20:30'],
  ['poetry-closed', '#/masjid/poetry', 0, '?weather=clear&now=2026-12-18T14:10'],
];
const query = process.env.SHOTS_QUERY ?? '?weather=heavy&now=2026-12-18T15:20';
const only = process.env.SHOTS_ONLY;
await mkdir(outDir, { recursive: true });
const browser = await chromium.launch();
let problems = 0;
for (const [vname, vp] of Object.entries(VIEWS)) {
  if (only && only !== vname) continue;
  const { width, height, ...rest } = vp;
  const context = await browser.newContext({ viewport: { width, height }, ...rest, locale: 'zh-CN', timezoneId: 'America/New_York' });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  for (const [name, hash, clicks, q, clickSel] of PAGES) {
    await page.goto(base + 'index.html' + (q || query) + hash);
    await page.waitForLoadState('networkidle');
    for (let i = 0; i < (clicks || 0); i++) await page.click('[data-next]');
    if (clickSel) {
      await page.locator(clickSel).first().scrollIntoViewIfNeeded();
      await page.click(clickSel);
      await page.waitForTimeout(1600);
    }
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(250);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    if (overflow > 0) {
      problems++;
      console.log(`横向溢出 ${vname}/${name}: ${overflow}px`);
    }
    await page.screenshot({ path: join(outDir, `${vname}-${name}.png`), fullPage: true });
  }
  if (errors.length) {
    problems++;
    console.log(`控制台报错 ${vname}:`, errors);
  }
  await context.close();
}
await browser.close();
server.close();
console.log(problems ? `发现 ${problems} 个问题` : '三种尺寸全部页面：无横向溢出、无报错');
process.exit(problems ? 1 : 0);
