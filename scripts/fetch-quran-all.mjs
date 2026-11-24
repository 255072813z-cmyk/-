// 生成古兰经全文和三种译文：src/content/quran/（npm run quran:all，需要联网；或 --from 目录 读事先下载好的文件）
//
// 原文：Tanzil 古兰经标准文本（quran-simple，带全部符号），经 alquran.cloud 获取。
//   alquran.cloud 把太斯米并进了各章第 1 节开头（第 1 章、第 9 章除外），这里拿掉，恢复 Tanzil 原来的分法，页面上单独显示。
// 译文（只表达意思，不能代替原文）：
//   塔吉克语：Абдолмуҳаммад Оятӣ（AbdolMohammad Ayati），Tanzil 版
//   俄语：Эльмир Кулиев（Elmir Kuliev），Tanzil 版
//   中文：马坚（中国社会科学出版社，1981），Tanzil 版
// 章名：中文、俄语取自 quran.com 的章名译名；塔吉克语为通行音译（见 TG_NAMES，请母语者再核对）。
//
// 数据源里有少量扫描错误，下面 FIXES 逐条列出修正（只改错字和多余符号，不改词句意思），可以对照原书核查。
import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';

const FROM = process.argv.includes('--from') ? process.argv[process.argv.indexOf('--from') + 1] : null;
const EDITIONS = { ar: 'quran-simple', tg: 'tg.ayati', ru: 'ru.kuliev', zh: 'zh.jian' };

// 塔吉克语译文的扫描错误（对照 Оятӣ 波斯文原译）
const FIXES = {
  tg: {
    '7:37': [['«0н чизҳое', '«Он чизҳое'], ['мекардед. акиуи куҷоянд?.', 'мекардед, акнун куҷоянд?»'], ['Гӯянд;', 'Гӯянд:']],
    '7:49': [['инхо6 хамом', 'инҳо ҳамон'], ['шумо7', 'шумо'], ['хурда будед', 'хӯрда будед'], ['ра^мати', 'раҳмати'], ['бих, ишт шавед8,', 'биҳишт шавед,'], ['гамгин', 'ғамгин']],
    '7:60': [['«Ту] ро', '«Туро']],
    '8:67': [['насазад*', 'насазад,']],
    '10:40': [['IIарвардигори', 'Парвардигори']],
    '27:56': [['мекунанд» (Пораи 20).', 'мекунанд».']],
    '71:23': [['накунед:,', 'накунед:'], ['Насрро*', 'Насрро']],
  },
  zh: {
    // 两个数据源（alquran.cloud、quran.com）的这一节都在半句处断掉，不凭记忆补经文，如实注明
    '4:12': [['须在交付亡人所嘱的遗？<br>', '须在交付亡人所嘱的遗……【数据源此节不完整，请以马坚译本原书为准】']],
    '44:43': [['櫕（木+苦）木', '攒楛木']],
    '56:52': [['攒（木+苦）木', '攒楛木']],
  },
};

// 马坚译文：只做排版清理（全角标点、扫描时把"一"认成"－"、叩头处的※），不改词句
const tidyZh = (s) =>
  s
    .replace(/[　\s]+/g, '')
    .replace(/－{2,}|-{2,}/g, '——')
    .replace(/－(?=[一-鿿])/g, '一')
    .replace(/,/g, '，')
    .replace(/;/g, '；')
    .replace(/:/g, '：')
    .replace(/[?﹖]/g, '？')
    .replace(/!/g, '！')
    .replace(/[｀＇]/g, '"')
    .replace(/※/g, '')
    .replace(/後/g, '后')
    .replace(/^\.+/, '');
const tidy = (s) => s.replace(/﻿/g, '').replace(/\s+/g, ' ').trim();

// 阿拉伯文符号的存储顺序在不同数据里可能不同，比较时去掉符号只看字母
const bare = (s) => s.replace(/[ؐ-ًؚ-ٰٟۖ-ۭـ﻿]/g, '');
const BASMALA = ['بسم', 'الله', 'الرحمن', 'الرحيم'];
function dropBasmala(text) {
  const w = text.split(/\s+/);
  return w.slice(0, 4).map(bare).join(' ') === BASMALA.join(' ') ? w.slice(4).join(' ') : null;
}

const TG_NAMES = `Фотиҳа|Бақара|Оли Имрон|Нисо|Моида|Анъом|Аъроф|Анфол|Тавба|Юнус|Ҳуд|Юсуф|Раъд|Иброҳим|Ҳиҷр|Наҳл|Исро|Каҳф|Марям|Тоҳо|Анбиё|Ҳаҷ|Муъминун|Нур|Фурқон|Шуаро|Намл|Қасас|Анкабут|Рум|Луқмон|Саҷда|Аҳзоб|Сабаъ|Фотир|Ёсин|Соффот|Сод|Зумар|Ғофир|Фуссилат|Шӯро|Зухруф|Духон|Ҷосия|Аҳқоф|Муҳаммад|Фатҳ|Ҳуҷурот|Қоф|Зориёт|Тур|Наҷм|Қамар|Раҳмон|Воқеа|Ҳадид|Муҷодала|Ҳашр|Мумтаҳана|Сафф|Ҷумъа|Мунофиқун|Тағобун|Талоқ|Таҳрим|Мулк|Қалам|Ҳоққа|Маъориҷ|Нӯҳ|Ҷин|Муззаммил|Муддассир|Қиёмат|Инсон|Мурсалот|Набаъ|Нозиот|Абаса|Таквир|Инфитор|Мутаффифин|Иншиқоқ|Буруҷ|Ториқ|Аъло|Ғошия|Фаҷр|Балад|Шамс|Лайл|Зуҳо|Шарҳ|Тин|Алақ|Қадр|Баййина|Залзала|Одиёт|Қориа|Такосур|Аср|Ҳумаза|Фил|Қурайш|Моъун|Кавсар|Кофирун|Наср|Масад|Ихлос|Фалақ|Нос`.split('|');
if (TG_NAMES.length !== 114) throw new Error('塔吉克语章名应为 114 个，现在 ' + TG_NAMES.length);

async function getJson(name, url) {
  if (FROM) return JSON.parse(readFileSync(`${FROM}/${name}`, 'utf8'));
  const r = await fetch(url);
  if (!r.ok) throw new Error(url + ' ' + r.status);
  return r.json();
}

const data = {};
for (const [lang, ed] of Object.entries(EDITIONS)) data[lang] = (await getJson(`${ed}.json`, `https://api.alquran.cloud/v1/quran/${ed}`)).data.surahs;
const chapters = {};
for (const l of ['zh', 'ru']) chapters[l] = (await getJson(`ch-${l}.json`, `https://api.quran.com/api/v4/chapters?language=${l}`)).chapters;

const used = { tg: new Set(), zh: new Set() };
const surahs = [];
const text = { ar: {}, tg: {}, ru: {}, zh: {} };
let total = 0;
for (let i = 0; i < 114; i++) {
  const n = i + 1;
  const src = data.ar[i];
  const count = src.ayahs.length;
  for (const l of ['tg', 'ru', 'zh']) if (data[l][i].ayahs.length !== count) throw new Error(`${l} 第 ${n} 章节数不一致`);
  for (const l of Object.keys(text)) {
    text[l][n] = data[l][i].ayahs.map((a, k) => {
      let t = tidy(a.text);
      if (l === 'ar' && k === 0 && n !== 1 && n !== 9) {
        const rest = dropBasmala(t);
        if (!rest) throw new Error(`第 ${n} 章第 1 节开头不是太斯米`);
        t = rest;
      }
      if (l === 'zh') t = tidyZh(t);
      const fx = FIXES[l] && FIXES[l][`${n}:${k + 1}`];
      if (fx)
        for (const [from, to] of fx) {
          if (!t.includes(from)) throw new Error(`修正没对上：${l} ${n}:${k + 1} ${from}`);
          t = t.replace(from, to);
          used[l].add(`${n}:${k + 1}`);
        }
      if (!t) throw new Error(`${l} ${n}:${k + 1} 是空的`);
      return t;
    });
  }
  total += count;
  const ch = (l) => chapters[l].find((c) => c.id === n);
  surahs.push({
    n,
    ar: src.name.replace(/^سُورَةُ\s*/, ''),
    ayahs: count,
    place: src.revelationType === 'Meccan' ? 'mecca' : 'medina',
    zh: ch('zh').translated_name.name,
    ru: ch('ru').translated_name.name,
    tg: TG_NAMES[i],
  });
}
if (total !== 6236) throw new Error('总节数应为 6236，现在 ' + total);
for (const l of Object.keys(FIXES)) for (const k of Object.keys(FIXES[l])) if (!used[l].has(k)) throw new Error('修正没用上：' + l + ' ' + k);

// 按大小分成几块（同一章不拆开），打开哪一章只下载那一块
const size = (n) => Object.keys(text).reduce((s, l) => s + text[l][n].join('').length, 0);
const all = surahs.reduce((s, x) => s + size(x.n), 0);
const PARTS = 8;
let part = 0;
let acc = 0;
for (const s of surahs) {
  if (acc >= ((part + 1) * all) / PARTS && part < PARTS - 1) part++;
  s.part = part;
  acc += size(s.n);
}

const dir = new URL('../src/content/quran/', import.meta.url);
if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
const head = `// 自动生成：npm run quran:all（scripts/fetch-quran-all.mjs）。请勿手改经文。\n`;
writeFileSync(
  new URL('meta.js', dir),
  `${head}// 章目录：编号、阿拉伯文章名、节数、降示地（麦加/麦地那）、所在数据块、三种语言的章名\nexport const PARTS = ${PARTS};\nexport const SURAHS = ${JSON.stringify(surahs)};\n`,
);
for (const l of Object.keys(text))
  for (let p = 0; p < PARTS; p++) {
    const obj = Object.fromEntries(surahs.filter((s) => s.part === p).map((s) => [s.n, text[l][s.n]]));
    writeFileSync(new URL(`${l}-${p}.js`, dir), `${head}export default ${JSON.stringify(obj)};\n`);
  }
console.log(`114 章、${total} 节；${PARTS} 块；修正 ${[...used.tg].length + [...used.zh].length} 节`);
