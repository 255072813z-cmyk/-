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
  tg: { name: 'Тоҷикӣ', locale: 'tg-TJ', ready: true }, // 初稿，待母语者和伊玛目审定
  ru: { name: 'Русский', locale: 'ru-RU', ready: true }, // 初稿，待母语者和伊玛目审定
};
// 手机语言既不是塔吉克语、俄语也不是中文时用哪种。开发阶段为中文；上线前改成 'tg'（或 'ru'）。
export const DEFAULT_LANG = 'zh';

const DICTS = { zh };
// 塔吉克语、俄语按需下载（不增加首屏体积）
const LOADERS = { tg: () => import('./tg.js'), ru: () => import('./ru.js') };

/** 下载某种语言的词典；成功返回 true */
export function loadLang(l) {
  if (DICTS[l]) return Promise.resolve(true);
  if (!LOADERS[l]) return Promise.resolve(false);
  return LOADERS[l]()
    .then((m) => {
      DICTS[l] = m.default;
      return true;
    })
    .catch(() => false);
}

/** 第一次打开时按手机语言选：塔吉克语 → 俄语 → 中文，都不是就用 DEFAULT_LANG */
export function guessLang() {
  try {
    const list = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language];
    for (const x of list) {
      const p = String(x || '').toLowerCase().slice(0, 2);
      if (p === 'tg' || p === 'ru' || p === 'zh') return p;
    }
  } catch (e) {
    /* 非浏览器环境 */
  }
  return DEFAULT_LANG;
}
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

/** 念词的译音：塔吉克语、俄语界面用西里尔字母（trc），其他用拉丁字母（tr）。返回 { text, lang } */
export function TR(obj) {
  const c = obj && obj.trc && obj.trc[lang];
  return c ? { text: c, lang: lang === 'tg' ? 'tg-Cyrl' : 'ru-Cyrl' } : { text: (obj && obj.tr) || '', lang: 'en' };
}

/** 这个词条在当前语言里有没有（用来决定某段说明要不要显示） */
export function has(key) {
  return lookup(key) != null;
}
