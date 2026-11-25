// 乌兹别克语：西里尔字母 → 拉丁字母（1995 年正字法，按现行写法：oʻ、gʻ 用 ʻ，分音符号 ʼ）
// 规则：
//   е 在词首、元音后、ъ/ь 后写 ye，其他写 e；ё→yo，ю→yu，я→ya
//   ц 在元音后写 ts，其他写 s；ъ→ʼ，ь 不写；сҳ（s 和 h 分开读）写 sʼh；ўъ、ғъ 后面的 ъ 不写（мўъмин→moʻmin）
//   大写的双字母（Ш、Ч、Ў、Ғ、Ё…）：整个词大写时全大写（SH），否则首字母大写（Sh）
const VOW = new Set('аеёиоуўэюяАЕЁИОУЎЭЮЯ');
const MAP = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', ё: 'yo', ж: 'j', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n',
  о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'x', ч: 'ch', ш: 'sh', щ: 'sh', ъ: 'ʼ', ь: '', ы: 'i',
  э: 'e', ю: 'yu', я: 'ya', ў: 'oʻ', қ: 'q', ғ: 'gʻ', ҳ: 'h',
};
// 数据里偶尔混进外形一样的拉丁字母，先换回西里尔字母
const LOOKALIKE = { A: 'А', B: 'В', C: 'С', E: 'Е', H: 'Н', K: 'К', M: 'М', O: 'О', P: 'Р', T: 'Т', X: 'Х', a: 'а', c: 'с', e: 'е', o: 'о', p: 'р', x: 'х', y: 'у' };
const isCyr = (ch) => /[Ѐ-ӿ]/.test(ch || '');
const isUp = (ch) => !!ch && ch !== ch.toLowerCase();

export function fixLookalikes(s) {
  // 只换夹在西里尔字母词里的拉丁字母（整词是拉丁字母的不动）
  return s.replace(/[A-Za-z]+/g, (w, i) => (isCyr(s[i - 1]) || isCyr(s[i + w.length]) || w.length === 1 ? [...w].map((c) => LOOKALIKE[c] || c).join('') : w));
}

export function uzLatin(input) {
  const s = fixLookalikes(input);
  let out = '';
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    const lo = ch.toLowerCase();
    if (!(lo in MAP) && lo !== 'е' && lo !== 'ц') {
      out += ch;
      continue;
    }
    const prev = s[i - 1];
    const next = s[i + 1];
    let r;
    if (lo === 'е') r = !prev || !isCyr(prev) || VOW.has(prev) || /[ъьЪЬ]/.test(prev) ? 'ye' : 'e';
    else if (lo === 'ц') r = prev && VOW.has(prev) ? 'ts' : 's';
    else if (lo === 'с' && next && next.toLowerCase() === 'ҳ') r = 'sʼ';
    else if (lo === 'ъ' && prev && /[ўғЎҒ]/.test(prev)) r = '';
    else r = MAP[lo];
    if (isUp(ch) && r) {
      // 整个词大写：后一个字母也大写，或前一个字母大写而后面不是小写字母
      const allCaps = (next && isCyr(next) && isUp(next)) || (prev && isCyr(prev) && isUp(prev) && !(next && isCyr(next) && !isUp(next)));
      r = allCaps ? r.toUpperCase() : r[0].toUpperCase() + r.slice(1);
    }
    out += r;
  }
  return out;
}
