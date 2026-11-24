// 检查：界面代码里不许写死文字（中文），文字必须放在 src/i18n/ 的语言文件里。
// 内容文件（src/content/）里，按语言分的字段 zh: '…' 是允许的（以后加 tg、ru 字段）。
// 用法：node scripts/check-i18n.mjs        （也在 npm test 里运行）
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const CJK = /[一-鿿　-〿！-｠]/;

function walk(d, out = []) {
  for (const f of readdirSync(d)) {
    const p = join(d, f);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (p.endsWith('.js')) out.push(p);
  }
  return out;
}

/** 去掉注释（保留字符串），按行返回 */
function codeLines(src) {
  let out = '';
  let i = 0;
  let q = null;
  while (i < src.length) {
    const c = src[i];
    const n = src[i + 1];
    if (q) {
      out += c;
      if (c === '\\') {
        out += n;
        i += 2;
        continue;
      }
      if (c === q) q = null;
      i++;
      continue;
    }
    if (c === '/' && n === '/') {
      while (i < src.length && src[i] !== '\n') i++;
      continue;
    }
    if (c === '/' && n === '*') {
      const end = src.indexOf('*/', i + 2);
      out += src.slice(i, end + 2).replace(/[^\n]/g, '');
      i = end + 2;
      continue;
    }
    if (c === "'" || c === '"' || c === '`') q = c;
    out += c;
    i++;
  }
  return out.split('\n');
}

export function findHardcoded() {
  const problems = [];
  for (const file of walk(join(root, 'src'))) {
    const rel = relative(root, file);
    if (rel.startsWith('src/i18n/')) continue;
    // 古兰经中文译文（马坚）本身就是按语言分开的内容文件，和 tg-*.js、ru-*.js 一样
    if (/^src\/content\/quran\/zh-\d+\.js$/.test(rel)) continue;
    const isContent = rel.startsWith('src/content/');
    const lines = codeLines(readFileSync(file, 'utf8'));
    let inZhBlock = false;
    let cont = false;
    lines.forEach((line, idx) => {
      const has = CJK.test(line);
      // 内容文件：允许 zh: '…'、zh: [ … ] 块，以及 zh: '…' + 换行续写
      if (isContent) {
        const ZH = /\bzh"?:\s*/;
        if (/\bzh"?:\s*\[/.test(line) && !/\]/.test(line.split(/\bzh"?:\s*\[/)[1])) inZhBlock = true;
        const ok = inZhBlock || cont || /\bzh"?:\s*[\['"`]/.test(line);
        cont = ok && /\+\s*$/.test(line.trim()) ? true : new RegExp(ZH.source + '$').test(line);
        if (inZhBlock && /\]/.test(line) && !/\bzh"?:\s*\[/.test(line)) inZhBlock = false;
        if (has && !ok) problems.push(`${rel}:${idx + 1}  ${line.trim().slice(0, 80)}`);
        return;
      }
      if (has) problems.push(`${rel}:${idx + 1}  ${line.trim().slice(0, 80)}`);
    });
  }
  return problems;
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const p = findHardcoded();
  if (p.length) {
    console.log(`代码里写死的文字 ${p.length} 处（请移到 src/i18n/zh.js）：`);
    console.log(p.join('\n'));
    process.exit(1);
  }
  console.log('没有写死的文字');
}
