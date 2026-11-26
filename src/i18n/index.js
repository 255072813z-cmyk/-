// 多语言
//
// 所有界面文字都在语言文件里（zh.js 中文开发版、tg.js 塔吉克语、ru.js 俄语、uz.js 乌兹别克语、ky.js 吉尔吉斯语），代码里不写死任何文字。
// 翻译时：复制 zh.js，逐条翻译右边的文字，保留 {名字} 这样的占位符不动。
// 宗教内容（念词的意思、诗句译文、古兰经译文）在 content/ 下，每条按语言分字段：{ zh: '…', tg: '…', ru: '…' }。
//
// 单复数：词条可以写成 { one, few, many, other }（俄语需要），t(key, { n }) 会按语言规则选择。

export const LANGS = {
  zh: { name: '中文', locale: 'zh-CN', ready: true },
  tg: { name: 'Тоҷикӣ', locale: 'tg-TJ', ready: true }, // 初稿，待母语者和伊玛目审定
  ru: { name: 'Русский', locale: 'ru-RU', ready: true }, // 初稿，待母语者和伊玛目审定
  uz: { name: 'Oʻzbekcha', locale: 'uz-UZ', ready: true }, // 拉丁字母（乌兹别克斯坦官方文字）；初稿，待审定
  ky: { name: 'Кыргызча', locale: 'ky-KG', ready: true }, // 初稿，待审定
};
// 内容（念词意思、圣训、诗句）还没有某种语言时退到哪种语言：乌兹别克语、吉尔吉斯语用户大多看得懂俄语
const FALLBACK = { uz: 'ru', ky: 'ru', tg: 'ru' };
// 手机语言既不是塔吉克语、俄语也不是中文时用哪种。开发阶段为中文；上线前改成 'tg'（或 'ru'）。
export const DEFAULT_LANG = 'zh';

const DICTS = {};
// 每种语言的词典都按需下载：只下载用户用的那一种（中文是开发用语言，正式用户不用下载它）
const LOADERS = { zh: () => import('./zh.js'), tg: () => import('./tg.js'), ru: () => import('./ru.js'), uz: () => import('./uz.js'), ky: () => import('./ky.js') };

/** 下载某种语言的词典；成功返回 true */
export function loadLang(l) {
  if (DICTS[l]) return Promise.resolve(true);
  if (!LOADERS[l]) return Promise.resolve(false);
  const once = () =>
    LOADERS[l]().then((m) => {
      DICTS[l] = m.default;
      return true;
    });
  // 网络偶尔抖一下：隔一会儿再试一次
  return once().catch(() => new Promise((r) => setTimeout(r, 800)).then(once).catch(() => false));
}

/** 第一次打开时按手机语言选（塔吉克语、俄语、乌兹别克语、吉尔吉斯语、中文），都不是就用 DEFAULT_LANG */
export function guessLang() {
  try {
    const list = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language];
    for (const x of list) {
      const p = String(x || '').toLowerCase().slice(0, 2);
      if (LANGS[p]) return p;
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
  // 当前语言 → 退到的语言 → 已经下载的任何一种（各语言的词条一一对应，测试保证）
  for (const l of [lang, FALLBACK[lang], ...Object.keys(DICTS)]) {
    const d = l && DICTS[l];
    if (d && d[key] != null) return d[key];
  }
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

/** 取一条分语言的内容字段：{ zh, tg, ru, uz, ky } → 当前语言；没有就退到俄语，再没有用中文 */
export function L(obj) {
  if (obj == null) return '';
  if (typeof obj === 'string') return obj;
  if (obj[lang] != null) return obj[lang];
  const f = FALLBACK[lang];
  return f && obj[f] != null ? obj[f] : obj.zh;
}

/** 念词的译音：塔吉克语、俄语、吉尔吉斯语界面用西里尔字母（trc；吉尔吉斯语用俄语那套），乌兹别克语用本地拉丁写法（trc.uz），没有的用通用拉丁字母（tr）。返回 { text, lang } */
export function TR(obj) {
  const key = lang === 'ky' ? 'ru' : lang;
  const c = obj && obj.trc && obj.trc[key];
  const tag = { tg: 'tg-Cyrl', ky: 'ky-Cyrl', uz: 'uz-Latn', ru: 'ru-Cyrl' }[lang] || 'en';
  return c ? { text: c, lang: tag } : { text: (obj && obj.tr) || '', lang: 'en' };
}

/** 这个词条在当前语言里有没有（用来决定某段说明要不要显示） */
export function has(key) {
  return lookup(key) != null;
}
