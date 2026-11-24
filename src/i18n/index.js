// 界面文字。现在只有中文；塔吉克语（tg）、俄语（ru）以后在这里加同名词条即可。
// 礼拜念词的阿拉伯文、译音、意思放在 content/ 下，以后同样按语言加字段。
import zh from './zh.js';

const DICTS = { zh, tg: null, ru: null };
let lang = 'zh';

export function setLang(l) {
  if (DICTS[l]) lang = l;
}

export function t(key, vars) {
  const d = DICTS[lang] || zh;
  let s = d[key] != null ? d[key] : zh[key] != null ? zh[key] : key;
  if (vars) for (const k in vars) s = s.split('{' + k + '}').join(vars[k]);
  return s;
}
