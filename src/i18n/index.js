// 多语言
//
// 所有界面文字都在语言文件里（zh.js 中文；以后加 tg.js 塔吉克语、ru.js 俄语），代码里不写死任何文字。
// 翻译时：复制 zh.js，逐条翻译右边的文字，保留 {名字} 这样的占位符不动。
// 宗教内容（念词的意思、诗句译文、古兰经译文）在 content/ 下，每条按语言分字段：{ zh: '…', tg: '…', ru: '…' }。
//
// 单复数：词条可以写成 { one, few, many, other }（俄语需要），t(key, { n }) 会按语言规则选择。
import zh from './zh.js';

export const LANGS = {
  zh: { name: '中文', locale: 'zh-CN', ready: true },
  tg: { name: 'Тоҷикӣ', locale: 'tg-TJ', ready: false }, // 待翻译
  ru: { name: 'Русский', locale: 'ru-RU', ready: false }, // 待翻译
};

const DICTS = { zh };
let lang = 'zh';

export function setLang(l) {
  if (LANGS[l] && DICTS[l]) lang = l;
  try {
    document.documentElement.lang = LANGS[lang].locale;
  } catch (e) {
    /* 非浏览器环境 */
  }
}

export function getLang() {
  return lang;
}

/** 以后加载其他语言的词典（按需下载，不增加首屏体积） */
export function registerDict(l, dict) {
  DICTS[l] = dict;
}

let plural = null;
function pluralForm(n) {
  try {
    if (!plural || plural.lang !== lang) plural = { lang, rules: new Intl.PluralRules(LANGS[lang].locale) };
    return plural.rules.select(n);
  } catch (e) {
    return n === 1 ? 'one' : 'other';
  }
}

function lookup(key) {
  const d = DICTS[lang] || zh;
  if (d[key] != null) return d[key];
  if (zh[key] != null) return zh[key];
  return null;
}

/** 取一条界面文字。vars 里的值会填进 {名字}；vars.n 用来选单复数 */
export function t(key, vars) {
  let s = lookup(key);
  if (s == null) return key;
  if (typeof s === 'object') {
    const form = vars && typeof vars.n === 'number' ? pluralForm(vars.n) : 'other';
    s = s[form] != null ? s[form] : s.other;
  }
  if (vars) for (const k in vars) s = s.split('{' + k + '}').join(vars[k]);
  return s;
}

/** 取一条分语言的内容字段：{ zh, tg, ru } → 当前语言，没有就用中文 */
export function L(obj) {
  if (obj == null) return '';
  if (typeof obj === 'string') return obj;
  return obj[lang] != null ? obj[lang] : obj.zh;
}

/** 这个词条在当前语言里有没有（用来决定某段说明要不要显示） */
export function has(key) {
  return lookup(key) != null;
}
