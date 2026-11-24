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
const zh = (await import('../src/i18n/zh.js')).default;
// 页面上露出的"词条名"（说明语言文件里缺了这一条）
const KEY_PREFIXES = [...new Set(Object.keys(zh).map((k) => k.split('.')[0]))];
const RAW_KEY = new RegExp('\\b(' + KEY_PREFIXES.join('|') + ')\\.[A-Za-z0-9]+(\\.[A-Za-z0-9]+)*\\b');
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
  ['city', '#/city'],
  ['times', '#/times'],
  ['qada', '#/pray/qada'],
  ['streak', '#/streak', 0, '?weather=clear&now=2026-12-18T15:20', null, { streak: { cur: 9, best: 12, last: '2026-12-17', grace: ['2026-12-10'], titles: [3, 7], prev: 0 }, badges: { got: { firstPrayer: '2026-12-01', fiveDay: '2026-12-03', wudu: '2026-12-02', guide1: '2026-12-02', tasbih: '2026-12-05' }, days: { five: ['2026-12-03', '2026-12-09'], fajr: ['2026-12-03', '2026-12-09', '2026-12-15', '2026-12-16'] }, n: { guide: 11 } } }],
  ['circle', '#/circle'],
  ['me', '#/me'],
  ['quran-home', '#/quran'],
  ['quran-read', '#/quran/112'],
  ['quran-plan', '#/quran/plan'],
  // 俄罗斯城市（第 6 项：预先写入的设置）
  ['home-moscow', '', 0, '?weather=clear&now=2027-06-21T12:00', null, { city: 'moscow' }],
  ['home-spb-summer', '', 0, '?weather=clear&now=2027-06-21T12:00', null, { city: 'spb' }],
  ['qibla-vladivostok', '#/qibla', 0, '?weather=clear', null, { city: 'vladivostok' }],
  ['qibla-here', '#/qibla', 0, '?weather=clear', null, { city: 'here', loc: { lat: 48.48, lon: 135.08, utcOffset: 10 } }],
];
const query = process.env.SHOTS_QUERY ?? '?weather=heavy&now=2026-12-18T15:20';
// SHOTS_LANG=tg|ru：用塔吉克语或俄语截图，并检查页面上还有没有中文
const LANG = process.env.SHOTS_LANG || '';
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
  for (const [name, hash, clicks, q, clickSel, preset] of PAGES) {
    await page.goto(base + 'index.html?preset=1&weather=clear');
    const { streak, badges, ...rest } = preset || {};
    const settings = preset || LANG ? { ...rest, ...(LANG ? { lang: LANG } : {}) } : null;
    await page.evaluate(([p, st, bd]) => {
      localStorage.clear();
      if (p) localStorage.setItem('masjid:settings', JSON.stringify(p));
      if (st) localStorage.setItem('masjid:streak', JSON.stringify(st));
      if (bd) localStorage.setItem('masjid:badges', JSON.stringify(bd));
    }, [settings, streak || null, badges || null]);
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
    const text = await page.evaluate(() => document.body.innerText);
    const raw = text.match(RAW_KEY);
    if (raw) {
      problems++;
      console.log(`页面露出词条名 ${vname}/${name}: ${raw[0]}`);
    }
    if (LANG && LANG !== 'zh') {
      // 语言选择按钮上的"中文"是语言自己的名字，不算
      const shown = await page.evaluate(() => {
        const c = document.body.cloneNode(true);
        c.querySelectorAll('[data-lang], script, style').forEach((x) => x.remove()); // 脚本、样式不是页面上的字
        return c.innerText;
      });
      const cjk = shown.match(/[^\n]{0,20}[\u4e00-\u9fff]+[^\n]{0,20}/);
      if (cjk) {
        problems++;
        console.log(`页面上还有中文 ${vname}/${name}: ${cjk[0]}`);
      }
    }
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    if (overflow > 0) {
      problems++;
      console.log(`横向溢出 ${vname}/${name}: ${overflow}px`);
    }
    await page.screenshot({ path: join(outDir, `${LANG ? LANG + '-' : ''}${vname}-${name}.png`), fullPage: true });
  }
  if (errors.length) {
    problems++;
    console.log(`控制台报错 ${vname}:`, errors);
  }
  await context.close();
}
await browser.close();
server.close();
console.log(problems ? `发现 ${problems} 个问题` : '三种尺寸全部页面：无横向溢出、无报错、无露出的词条名');
process.exit(problems ? 1 : 0);
