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

const count = (steps, id, rakah) => steps.filter((s) => s.id === id && (rakah == null || s.rakah === rakah)).length;

test('主命拜：第 3、4 拜只念开端章；第 2 拜后坐下念作证词', () => {
  const { steps } = buildSteps('dhuhr', 'fard');
  assert.equal(count(steps, 'fatiha'), 4);
  assert.equal(count(steps, 'surah'), 2);
  assert.equal(count(steps, 'surah', 3), 0);
  assert.equal(count(steps, 'qadahFirst', 2), 1);
  assert.equal(count(steps, 'ruku'), 4);
  assert.equal(count(steps, 'sujud1') + count(steps, 'sujud2'), 8);
  assert.equal(steps.at(-1).id, 'salam');
  assert.equal(count(steps, 'thana'), 1);
});

test('昏礼主命 3 拜：第 3 拜不念经文，最后坐后出拜', () => {
  const { steps } = buildSteps('maghrib', 'fard');
  assert.equal(count(steps, 'surah'), 2);
  assert.equal(count(steps, 'qadahFirst'), 1);
  assert.equal(count(steps, 'qadahFinal', 3), 1);
});

test('逊奈 4 拜：每一拜都念开端章 + 经文', () => {
  const { steps } = buildSteps('dhuhr', 'sunnah-before');
  assert.equal(count(steps, 'surah'), 4);
  // 经文按经文顺序，不重复
  const ss = steps.filter((s) => s.id === 'surah').map((s) => s.items[0].surah);
  assert.deepEqual(ss, [...ss].sort((a, b) => a - b));
  assert.equal(new Set(ss).size, ss.length);
});

test('威特尔：第 3 拜念完经文后举手念古努特，再鞠躬', () => {
  const { steps } = buildSteps('isha', 'witr');
  const i = steps.findIndex((s) => s.id === 'qunut');
  assert.equal(steps[i].rakah, 3);
  assert.equal(steps[i - 1].id, 'surah');
  assert.equal(steps[i + 1].id, 'ruku');
  assert.equal(count(steps, 'qunut'), 1);
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
  const walkDir = (d, files = []) => {
    for (const f of readdirSync(d, { withFileTypes: true })) {
      const p = d + '/' + f.name;
      if (f.isDirectory()) walkDir(p, files);
      else if (/\.(js|html|css)$/.test(f.name)) files.push(p);
    }
    return files;
  };
  const own = walkDir(new URL('../src', import.meta.url).pathname);
  own.push(new URL('../index.html', import.meta.url).pathname);
  const distDir = new URL('../dist/assets', import.meta.url).pathname;
  const dist = existsSync(distDir) ? walkDir(distDir) : [];
  const banned = [/type=["']password/, /gtag\(|google-analytics|googletagmanager|hm\.baidu|umami|yandex.*metrika|firebase-analytics|appmetrica/i, /payment|PaymentRequest|stripe|alipay|wechatpay/i];
  for (const f of [...own, ...dist]) {
    const src = readFileSync(f, 'utf8');
    for (const re of banned) assert.ok(!re.test(src), `${f} 命中 ${re}`);
  }
  // 位置：只允许 src/core/location.js 读取（用户点"用我的位置"时，粗略位置，不上传）
  for (const f of own) {
    if (f.endsWith('/src/core/location.js')) continue;
    assert.ok(!/navigator\.geolocation/.test(readFileSync(f, 'utf8')), `${f} 读取了位置`);
  }
  const geoChunks = dist.filter((f) => /navigator\.geolocation/.test(readFileSync(f, 'utf8')));
  // 新版和老浏览器兼容版各一份
  assert.ok(geoChunks.filter((f) => !/-legacy-/.test(f)).length <= 1 && geoChunks.filter((f) => /-legacy-/.test(f)).length <= 1, '打包产物里读取位置的地方不止一处');
  for (const f of geoChunks) assert.ok(/enableHighAccuracy:\s*(!1|false)/.test(readFileSync(f, 'utf8')), `${f} 读取位置时没有限定粗略位置`);
  // 我们自己的代码绝不读写 Cookie；打包产物里只允许出现在 Capacitor 库自带的（默认关闭、本应用从不调用的）Cookie 插件里
  for (const f of own) assert.ok(!/document\.cookie/.test(readFileSync(f, 'utf8')), `${f} 读写了 Cookie`);
  for (const f of dist) {
    const src = readFileSync(f, 'utf8');
    if (/document\.cookie/.test(src)) assert.ok(/CapacitorCookies/.test(src), `${f} 读写了 Cookie`);
  }
});

test('古兰经全文：114 章 6236 节，三种译文节数一致、没有空的、没有乱码和网页标记', async () => {
  const { SURAHS, PARTS } = await import('../src/content/quran/meta.js');
  assert.equal(SURAHS.length, 114);
  assert.equal(SURAHS.reduce((s, x) => s + x.ayahs, 0), 6236);
  const bare = (s) => s.replace(/[ؐ-ًؚ-ٰٟۖ-ۭـ]/g, '').replace(/ٱ/g, 'ا');
  const data = {};
  for (const l of ['ar', 'tg', 'ru', 'zh']) {
    data[l] = {};
    for (let p = 0; p < PARTS; p++) Object.assign(data[l], (await import(`../src/content/quran/${l}-${p}.js`)).default);
  }
  for (const s of SURAHS) {
    assert.ok(s.zh && s.ru && s.tg && s.ar, `第 ${s.n} 章缺章名`);
    for (const l of Object.keys(data)) {
      const a = data[l][s.n];
      assert.equal(a.length, s.ayahs, `${l} 第 ${s.n} 章节数`);
      for (const [i, x] of a.entries()) {
        assert.ok(typeof x === 'string' && x.trim(), `${l} ${s.n}:${i + 1} 是空的`);
        assert.ok(!/[<>&]/.test(x), `${l} ${s.n}:${i + 1} 有网页标记`);
        if (l === 'tg' || l === 'ru') assert.ok(!/[А-яӣӯқғҳҷЁё]\d|\d[А-яӣӯқғҳҷЁё]|[\^*\]]/.test(x), `${l} ${s.n}:${i + 1} 有扫描错误：${x.slice(0, 40)}`);
      }
    }
  }
  // 太斯米：第 1 章第 1 节就是它；第 2 章第 1 节是"艾列弗，俩目，米目"（太斯米已拿出来单独显示）；第 9 章没有
  assert.equal(bare(data.ar[1][0]), 'بسم الله الرحمن الرحيم');
  assert.equal(bare(data.ar[2][0]), 'الم');
  assert.ok(bare(data.ar[9][0]).startsWith('براءة'));
  assert.equal(bare(data.ar[112][0]), 'قل هو الله أحد');
  assert.match(data.zh[112][0], /独一/);
  assert.match(data.ru[112][0], /Скажи/);
  assert.match(data.tg[112][0], /Бигӯ/);
  // 第 4 章第 12 节中文数据源不完整：如实注明，没有凭记忆补
  assert.match(data.zh[4][11], /数据源此节不完整/);
});

test('古兰经：章目录搜索（编号、三种语言的章名、阿拉伯文）', async () => {
  const { searchSurahs, arNum } = await import('../src/core/quran.js');
  assert.deepEqual(searchSurahs('112').map((s) => s.n), [112]);
  assert.deepEqual(searchSurahs('黄牛').map((s) => s.n), [2]);
  assert.deepEqual(searchSurahs('корова').map((s) => s.n), [2]);
  assert.ok(searchSurahs('Ёсин').some((s) => s.n === 36));
  assert.ok(searchSurahs('البقرة').some((s) => s.n === 2));
  assert.equal(searchSurahs('').length, 114);
  assert.equal(arNum(255), '٢٥٥');
});

test('古兰经读书记录：每章读到哪、每天读了几节（同一节一天只算一次）、最近读过、书签、坏数据', async () => {
  const mem = new Map();
  globalThis.window = { localStorage: { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) } };
  try {
    const q = await import('../src/core/quran.js');
    // 读第 112 章（4 节）：第 1 节读两次只算一次；读完第 4 节这一章就读完了
    assert.deepEqual(q.markRead(112, 1, '2026-12-18'), { newly: true, surahDone: false });
    assert.deepEqual(q.markRead(112, 1, '2026-12-18'), { newly: false, surahDone: false });
    q.markRead(112, 2, '2026-12-18');
    q.markRead(112, 3, '2026-12-18');
    assert.equal(q.markRead(112, 4, '2026-12-18').surahDone, true);
    assert.equal(q.readOn('2026-12-18'), 4);
    assert.deepEqual(q.surahProgress(112), { max: 4, total: 4, done: true });
    // 第二天再读同一节，算第二天的
    assert.equal(q.markRead(112, 1, '2026-12-19').newly, true);
    assert.equal(q.readOn('2026-12-19'), 1);
    q.markRead(2, 255, '2026-12-19');
    assert.deepEqual(q.allProgress(), { read: 4 + 255, total: 6236, done: 1 });
    const week = q.readDays('2026-12-19', 7);
    assert.equal(week.length, 7);
    assert.deepEqual(week.slice(-2).map((d) => d.n), [4, 2]);
    assert.equal(week[0].day, '2026-12-13');
    // 不存在的章节不记
    assert.equal(q.markRead(115, 1, '2026-12-19').newly, false);
    assert.equal(q.markRead(112, 5, '2026-12-19').newly, false);
    // 读到哪里、最近读过：每章一条，最新的在前
    q.setLastRead(18, 40, 1000);
    q.setLastRead(2, 255, 2000);
    q.setLastRead(18, 60, 3000);
    assert.deepEqual(q.lastRead(), { s: 18, a: 60, t: 3000 });
    assert.deepEqual(q.recentRead().map((h) => `${h.s}:${h.a}`), ['18:60', '2:255']);
    assert.equal(q.lastInSurah(2), 255);
    assert.equal(q.lastInSurah(36), 0);
    // 书签：加、再点去掉
    assert.equal(q.toggleBookmark(2, 255, 10), true);
    assert.equal(q.toggleBookmark(36, 58, 20), true);
    assert.deepEqual(q.bookmarks().map((b) => `${b.s}:${b.a}`), ['36:58', '2:255'], '新加的在前');
    assert.equal(q.isMarked(2, 255), true);
    assert.equal(q.toggleBookmark(2, 255), false);
    assert.equal(q.isMarked(2, 255), false);
    assert.equal(q.toggleBookmark(2, 999), false, '不存在的节不能加');
    // 坏数据：不报错，当作没有
    mem.set('masjid:qprog', '"x"');
    mem.set('masjid:qhist', JSON.stringify([{ s: 999, a: 1 }, { s: 1, a: 3, t: 5 }]));
    mem.set('masjid:qmarks', '{}');
    mem.set('masjid:qdays', JSON.stringify({ bad: 3, '2026-12-19': -1 }));
    assert.deepEqual(q.allProgress(), { read: 0, total: 6236, done: 0 });
    assert.deepEqual(q.recentRead().map((h) => h.s), [1]);
    assert.deepEqual(q.bookmarks(), []);
    assert.equal(q.readOn('2026-12-19'), 0);
    assert.equal(q.daysAgo(0), null);
  } finally {
    delete globalThis.window;
  }
});
