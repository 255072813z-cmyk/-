// 多语言检查：代码里不写死文字；用到的词条在语言文件里都有
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { findHardcoded } from '../scripts/check-i18n.mjs';
import zh from '../src/i18n/zh.js';
import { PRAYER_INFO, EXTRA_PRAYERS, buildSteps } from '../src/content/prayers.js';
import { WUDU_STEPS, WUDU_WINTER_COUNT, WUDU_BREAKER_COUNT } from '../src/content/wudu.js';
import { R } from '../src/content/recitations.js';
import { POEMS } from '../src/content/poems.js';

const root = new URL('../src/', import.meta.url).pathname;
const walk = (d, out = []) => {
  for (const f of readdirSync(d)) {
    const p = join(d, f);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (p.endsWith('.js')) out.push(p);
  }
  return out;
};

test('代码里没有写死的文字', () => {
  const p = findHardcoded();
  assert.equal(p.length, 0, p.slice(0, 10).join('\n'));
});

test("代码里 t('…') 用到的词条都存在", () => {
  const missing = [];
  for (const f of walk(root)) {
    const src = readFileSync(f, 'utf8');
    // 只查完整写出的词条；'prayer.' + p 这类拼出来的，由下一项测试逐个展开检查
    for (const m of src.matchAll(/\bt\(\s*'([a-zA-Z0-9_.]*[a-zA-Z0-9_])'\s*[,)]/g)) if (zh[m[1]] == null) missing.push(`${m[1]}  (${f.replace(root, '')})`);
  }
  assert.deepEqual(missing, []);
});

test('拼出来的词条也都存在（步骤、小净、方位、日期等）', () => {
  const need = [];
  const prayers = { ...PRAYER_INFO, ...EXTRA_PRAYERS };
  for (const [k, info] of Object.entries(prayers)) {
    need.push('prayer.' + k);
    for (const u of info.units) {
      need.push('kind.' + u.kind);
      for (const st of buildSteps(k, u.id).steps) {
        need.push(`step.${st.id}.title`, st.howKey || `step.${st.id}.how`, 'posture.' + st.posture);
        if (st.women) need.push(`step.${st.id}.women`);
        if (st.note) need.push(`step.${st.id}.note`);
        for (const it of st.items) if (it.side) need.push('side.' + it.side);
      }
    }
  }
  for (const s of WUDU_STEPS) {
    need.push(`wudu.${s.id}.title`, `wudu.${s.id}.how`, 'wudu.level.' + s.level);
    if (s.fard) need.push(`wudu.${s.id}.fard`);
    if (s.note) need.push(`wudu.${s.id}.note`);
  }
  for (let i = 1; i <= WUDU_WINTER_COUNT; i++) need.push('wudu.winter.' + i);
  for (let i = 1; i <= WUDU_BREAKER_COUNT; i++) need.push('wudu.breaker.' + i);
  for (let i = 0; i < 16; i++) need.push('compass.' + i);
  for (let i = 0; i < 7; i++) need.push('week.' + i, 'weekShort.' + i);
  for (let i = 1; i <= 12; i++) need.push('month.' + i, 'hijri.month.' + i);
  for (let i = 0; i < 5; i++) need.push('court.line.' + i);
  for (let i = 1; i <= 6; i++) need.push('tarawih.how.' + i);
  for (const p of ['before', 'fasting', 'after', 'preview']) need.push('fast.head.' + p);
  for (const p of ['before', 'fasting', 'after']) need.push('fast.count.' + p);
  for (const s of ['mine', 'taken', 'free']) need.push('hall.mat.' + s);
  for (const k of ['heavy', 'snow', 'storm', 'rain', 'wind', 'cold', 'heat', 'uv', 'fog', 'clear']) need.push('wx.' + k, 'wx.' + k + 'Why');
  need.push('wx.rainHeavy');
  for (const c of ['dushanbe', 'khujand']) need.push('city.' + c);
  const missing = [...new Set(need)].filter((k) => zh[k] == null);
  assert.deepEqual(missing, []);
});

test('宗教内容的每条意思、出处都有中文（以后加 tg、ru 字段）', () => {
  for (const [k, r] of Object.entries(R)) {
    assert.ok(r.zh, k);
    assert.ok(r.src && r.src.zh, k);
  }
  for (const p of POEMS) assert.ok(p.zh && p.note.zh && p.src.zh && p.poet.zh);
});

test('词条的占位符写法正确（{名字} 成对出现）', () => {
  for (const [k, v] of Object.entries(zh)) {
    const s = typeof v === 'string' ? v : Object.values(v).join(' ');
    assert.equal((s.match(/\{/g) || []).length, (s.match(/\}/g) || []).length, k);
  }
});

test('塔吉克语、俄语、乌兹别克语、吉尔吉斯语：词条和中文一一对应，占位符一致，单复数写全', async () => {
  const ph = (s) => [...String(s).matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');
  for (const l of ['tg', 'ru', 'uz', 'ky']) {
    const d = (await import(`../src/i18n/${l}.js`)).default;
    const missing = Object.keys(zh).filter((k) => d[k] == null);
    const extra = Object.keys(d).filter((k) => zh[k] == null);
    assert.deepEqual(missing, [], `${l} 缺少词条`);
    assert.deepEqual(extra, [], `${l} 多出词条`);
    const bad = [];
    for (const [k, v] of Object.entries(d)) {
      // 日期格式里月份可以写数字 {m} 或月名 {month}（程序两个都给）
      const norm = (x) => (k.startsWith('date.') ? x.replace(/month/g, 'm') : x);
      const want = norm(ph(typeof zh[k] === 'object' ? zh[k].other : zh[k]));
      const forms = (typeof v === 'object' ? Object.values(v) : [v]).map(norm);
      if (typeof v === 'object') for (const f of ['one', 'few', 'many', 'other']) if (l === 'ru' && v[f] == null) bad.push(`${k} 缺 ${f}`);
      for (const f of forms) if (norm(ph(f)) !== want) bad.push(`${k}: ${f}`);
      if (/[一-鿿]/.test(forms.join(''))) bad.push(`${k} 里还有中文`);
      // 乌兹别克语用拉丁字母：不应混进西里尔字母
      if (l === 'uz' && /[А-Яа-яЁё]/.test(forms.join(''))) bad.push(`${k} 里有西里尔字母`);
    }
    assert.deepEqual(bad, [], `${l} 的问题`);
  }
});

test('内容：念词、经文、圣训、诗歌都有各语言的意思、出处、译音', async () => {
  const { R, TASBIH, TASBIH_100, surah } = await import('../src/content/recitations.js');
  const { SHORT_SURAHS } = await import('../src/content/prayers.js');
  const miss = [];
  const need = (o, name, keys = ['tg', 'ru']) => keys.forEach((k) => (o == null || !o[k] ? miss.push(`${name}.${k}`) : 0));
  for (const [k, r] of Object.entries(R)) {
    need(r, k);
    need(r.src, k + '.src');
    need(r.trc, k + '.trc');
  }
  for (const x of TASBIH) {
    need(x, x.key);
    need(x.trc, x.key + '.trc');
  }
  need(TASBIH_100, 'tasbih100');
  need(TASBIH_100.src, 'tasbih100.src');
  for (const n of [1, ...SHORT_SURAHS.map((x) => x.surah || x)]) {
    const s = surah(n);
    need(s.name, `surah${n}.name`);
    need(s.src, `surah${n}.src`);
    s.ayahs.forEach((a, i) => {
      need(a, `surah${n}.${i + 1}`);
      need(a.trc, `surah${n}.${i + 1}.trc`);
    });
  }
  // 乌兹别克语、吉尔吉斯语：意思和出处；乌兹别克语还有本地拉丁字母译音
  const UK = ['uz', 'ky'];
  for (const [k, r] of Object.entries(R)) {
    need(r, k, UK);
    need(r.src, k + '.src', UK);
    need(r.trc, k + '.trc', ['uz']);
  }
  for (const x of TASBIH) need(x, x.key, UK);
  need(TASBIH_100, 'tasbih100', UK);
  for (const n of [1, ...SHORT_SURAHS.map((x) => x.surah || x)]) {
    const s = surah(n);
    need(s.name, `surah${n}.name`, UK);
    need(s.src, `surah${n}.src`, UK);
    s.ayahs.forEach((a, i) => need(a, `surah${n}.${i + 1}`, UK));
  }
  const { HADITH } = await import('../src/content/hadith.js');
  for (const [k, h] of Object.entries(HADITH)) {
    need(h, k, ['tg', 'ru', 'uz', 'ky']);
    need(h.src, k + '.src', ['tg', 'ru', 'uz', 'ky']);
  }
  for (const [i, p] of POEMS.entries()) {
    need(p.poet, `poem${i}.poet`);
    need(p.note, `poem${i}.note`);
    need(p.src, `poem${i}.src`);
    for (const l of ['ru', 'uz', 'ky']) if (!Array.isArray(p[l]) || p[l].length !== p.zh.length) miss.push(`poem${i}.${l} 行数`);
    need(p.poet, `poem${i}.poet`, UK);
    need(p.note, `poem${i}.note`, UK);
    need(p.src, `poem${i}.src`, UK);
  }
  assert.deepEqual(miss, []);
});
