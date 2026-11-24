// 宗教内容与红线的自动检查：node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { PRAYER_INFO, buildSteps } from '../src/content/prayers.js';
import { R, TASBIH, TASBIH_100, surah, SHORT_SURAHS } from '../src/content/recitations.js';
import { WUDU_STEPS } from '../src/content/wudu.js';

test('各番拜的总拜数（哈乃斐学派）', () => {
  const total = (p) => PRAYER_INFO[p].units.reduce((a, u) => a + u.rakats, 0);
  assert.equal(total('fajr'), 4); // 2 逊奈 + 2 主命
  assert.equal(total('dhuhr'), 10); // 4 + 4 + 2
  assert.equal(total('asr'), 8); // 4 + 4
  assert.equal(total('maghrib'), 5); // 3 + 2
  assert.equal(total('isha'), 13); // 4 + 4 + 2 + 威特尔 3
  const fard = Object.fromEntries(Object.entries(PRAYER_INFO).map(([k, v]) => [k, v.units.find((u) => u.kind === 'fard').rakats]));
  assert.deepEqual(fard, { fajr: 2, dhuhr: 4, asr: 4, maghrib: 3, isha: 4 });
});

const count = (steps, title, rakah) => steps.filter((s) => s.title === title && (rakah == null || s.rakah === rakah)).length;

test('主命拜：第 3、4 拜只念开端章；第 2 拜后坐下念作证词', () => {
  const { steps } = buildSteps('dhuhr', 'fard');
  assert.equal(count(steps, '开端章'), 4);
  assert.equal(count(steps, '再念一段经文'), 2);
  assert.equal(count(steps, '再念一段经文', 3), 0);
  assert.equal(count(steps, '第一次坐', 2), 1);
  assert.equal(count(steps, '鞠躬'), 4);
  assert.equal(count(steps, '第一次叩头') + count(steps, '第二次叩头'), 8);
  assert.equal(steps.at(-1).title, '出拜');
  assert.equal(count(steps, '赞主词'), 1);
});

test('昏礼主命 3 拜：第 3 拜不念经文，最后坐后出拜', () => {
  const { steps } = buildSteps('maghrib', 'fard');
  assert.equal(count(steps, '再念一段经文'), 2);
  assert.equal(count(steps, '第一次坐'), 1);
  assert.equal(count(steps, '最后的坐', 3), 1);
});

test('逊奈 4 拜：每一拜都念开端章 + 经文', () => {
  const { steps } = buildSteps('dhuhr', 'sunnah-before');
  assert.equal(count(steps, '再念一段经文'), 4);
  // 经文按经文顺序，不重复
  const ss = steps.filter((s) => s.title === '再念一段经文').map((s) => s.items[0].surah);
  assert.deepEqual(ss, [...ss].sort((a, b) => a - b));
  assert.equal(new Set(ss).size, ss.length);
});

test('威特尔：第 3 拜念完经文后举手念古努特，再鞠躬', () => {
  const { steps } = buildSteps('isha', 'witr');
  const i = steps.findIndex((s) => s.title === '举手，念古努特');
  assert.equal(steps[i].rakah, 3);
  assert.equal(steps[i - 1].title, '再念一段经文');
  assert.equal(steps[i + 1].title, '鞠躬');
  assert.equal(count(steps, '举手，念古努特'), 1);
});

test('每条念词都有阿拉伯文、译音、中文和出处', () => {
  const arabic = /^[؀-ۿݐ-ݿ\s،]+$/;
  for (const [k, r] of Object.entries(R)) {
    assert.ok(arabic.test(r.ar), `${k} 阿拉伯文含非阿拉伯字符`);
    assert.ok(r.tr && /^[A-Za-z' ,.\-]+$/.test(r.tr), `${k} 译音`);
    assert.ok(r.zh && r.zh.length > 1, `${k} 中文`);
    assert.ok(r.src, `${k} 出处`);
  }
  for (const n of [1, ...SHORT_SURAHS]) {
    const s = surah(n);
    for (const a of s.ayahs) assert.ok(arabic.test(a.ar) && a.tr && a.zh, `第 ${n} 章第 ${a.n} 节`);
  }
  assert.equal(surah(1).ayahs.length, 7);
  assert.equal(surah(112).ayahs.length, 4);
  assert.deepEqual(TASBIH.map((x) => x.count), [33, 33, 33]);
  assert.ok(TASBIH_100.ar && TASBIH_100.src);
});

test('小净：四项主命都在（洗脸、洗臂、抹头、洗脚）', () => {
  const fard = WUDU_STEPS.filter((s) => s.level === 'fard').map((s) => s.zone);
  assert.deepEqual(fard, ['face', 'arms', 'head', 'feet']);
});

test('红线：没有支付、登录、统计、Cookie', () => {
  const files = [];
  const walk = (d) => {
    for (const f of readdirSync(d, { withFileTypes: true })) {
      const p = d + '/' + f.name;
      if (f.isDirectory()) walk(p);
      else if (/\.(js|html|css)$/.test(f.name)) files.push(p);
    }
  };
  walk(new URL('../src', import.meta.url).pathname);
  files.push(new URL('../index.html', import.meta.url).pathname);
  const dist = new URL('../dist/assets', import.meta.url).pathname;
  if (existsSync(dist)) walk(dist);
  const banned = [/document\.cookie/, /type=["']password/, /gtag\(|google-analytics|googletagmanager|hm\.baidu|umami|yandex.*metrika/i, /navigator\.geolocation/, /payment|PaymentRequest|stripe|alipay|wechatpay/i];
  for (const f of files) {
    const src = readFileSync(f, 'utf8');
    for (const re of banned) assert.ok(!re.test(src), `${f} 命中 ${re}`);
  }
});

test('诗歌：波斯文、塔吉克文、中文行数一致，文字不混写', async () => {
  const { POEMS } = await import('../src/content/poems.js');
  assert.ok(POEMS.length >= 5);
  for (const p of POEMS) {
    assert.equal(p.fa.length, p.tg.length, p.src);
    assert.equal(p.fa.length, p.zh.length, p.src);
    for (const l of p.tg) assert.ok(!/[A-Za-z]/.test(l), `塔吉克文含拉丁字母：${l}`);
    for (const l of p.fa) assert.ok(!/[A-Za-zА-Яа-яӮӯҶҷҲҳҒғҚқӢӣ]/.test(l), `波斯文混入其他字母：${l}`);
    assert.ok(p.src.startsWith('Ganjoor'));
  }
});
