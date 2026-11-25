// 读古兰经的一章：阿拉伯原文（大字、从右往左）+ 当前语言的译文；太斯米单独一行（第 1 章它就是第 1 节，第 9 章没有）。
// 读书记录（只存在这台手机上）：
// - 屏幕上方读到哪一节，停一下就记住，下次"继续读"；这一章读过的，再打开时提示"接着上次：第 N 节"
// - 一节在屏幕中间停留一会儿，就算读过：记下这一章读到的最远一节、今天读了几节；读完一章有提示
// - 每节都可以加书签
import { surah, loadSurah, arNum, setLastRead, readPrefs, setReadPrefs, lastInSurah, markRead, surahProgress, readOn, isMarked, toggleBookmark } from '../../core/quran.js';
import { ymdKey } from '../../core/clock.js';
import { softToast } from '../../core/reminder.js';
import { ICONS } from '../../ui/art.js';
import { replay } from '../../ui/motion.js';
import { t, getLang } from '../../i18n/index.js';
import { surahName } from './index.js';
import { esc } from '../../i18n/format.js';

const SIZES = ['q-s0', 'q-s1', 'q-s2', 'q-s3'];

/**
 * 译文显示：长的括号（80 字以上）是译者的解说（乌兹别克语译本里很多），另起一行用小字；
 * 短括号是译者补足语气的词，照常显示。只改显示，不改译文。返回 { html, note: 有没有解说 }
 */
export function trHTML(text) {
  const s = String(text);
  let html = '';
  let last = 0;
  let depth = 0;
  let start = -1;
  let note = false;
  const cut = (a, b) => {
    html += esc(s.slice(last, a).trimEnd()) + `<span class="ayah-note">${esc(s.slice(a, b))}</span>`;
    last = b;
    note = true;
  };
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '(') {
      if (depth === 0) start = i;
      depth++;
    } else if (s[i] === ')' && depth > 0 && --depth === 0 && i - start > 80) cut(start, i + 1);
  }
  // 解说一直写到这一节末尾、没有右括号的
  if (depth > 0 && s.length - start > 80) cut(start, s.length);
  return { html: html + esc(s.slice(last)), note };
}
const RIBBON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 3.5h11v17l-5.5-3.8-5.5 3.8z"/></svg>';
const BOOK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 6.2C9.8 4.6 6.6 4.1 3.5 4.6v11.6c3.1-.4 6.3.1 8.5 1.7 2.2-1.6 5.4-2.1 8.5-1.7V4.6c-3.1-.5-6.3 0-8.5 1.6Z"/></svg>';

export function quranRead(ctx, n, startAyah) {
  const s = surah(Number(n));
  if (!s) return { html: `<div class="page"><p class="loading">${t('qr.none')}</p></div>` };
  const today = ymdKey(ctx.sched.today);
  const prefs = readPrefs();
  const prev = surah(s.n - 1);
  const next = surah(s.n + 1);
  const target = Number(startAyah) || 0;
  const resumeAt = target ? 0 : lastInSurah(s.n);
  const prog = surahProgress(s.n);
  const html = `
  <div class="page quran-read ${SIZES[prefs.size]} ${prefs.tr ? '' : 'no-tr'}" data-q-page>
    <div class="page-head"><a class="back" href="#/quran" aria-label="${t('common.back')}">${ICONS.back}</a>
      <h1>${s.n}. ${surahName(s)} <span class="ar-sm" lang="ar" dir="rtl">${s.ar}</span></h1></div>
    <p class="q-meta">${t('qr.place.' + s.place)} · ${t('qr.ayahs', { n: s.ayahs })}${prog.max ? ` · ${prog.done ? t('qr.doneShort') : t('qr.readTo', { n: prog.max })}` : ''}</p>
    <div class="q-tools" role="group" aria-label="${t('qr.tools')}">
      <button type="button" class="btn btn-ghost btn-sm" data-q-size="-1" aria-label="${t('qr.smaller')}">A−</button>
      <button type="button" class="btn btn-ghost btn-sm" data-q-size="1" aria-label="${t('qr.bigger')}">A+</button>
      <button type="button" class="btn btn-ghost btn-sm ${prefs.tr ? 'is-on' : ''}" data-q-tr aria-pressed="${prefs.tr}">${t('qr.showTr')}</button>
      <span class="q-today" title="${t('qr.todayTitle')}">${BOOK}<b data-q-today>${readOn(today)}</b></span>
    </div>
    ${resumeAt > 1 ? `<a class="q-resume" href="#/quran/${s.n}/${resumeAt}" data-q-resume>${t('qr.resume', { n: resumeAt })} →</a>` : ''}
    ${s.n !== 1 && s.n !== 9 ? `<p class="q-basmala" lang="ar" dir="rtl">بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</p>` : ''}
    <div class="ayahs" data-ayahs><div class="skel" role="status" aria-label="${t('common.loading')}"><i class="tall"></i><i></i><i></i><i></i></div></div>
    <p class="q-done" data-q-done ${prog.done ? '' : 'hidden'}>✓ ${t('qr.doneSurah')}</p>
    <nav class="q-nav" data-q-end>
      ${prev ? `<a class="btn btn-ghost" href="#/quran/${prev.n}">← ${prev.n}. ${surahName(prev)}</a>` : '<span></span>'}
      ${next ? `<a class="btn btn-primary" href="#/quran/${next.n}">${next.n}. ${surahName(next)} →</a>` : ''}
    </nav>
    <p class="note center">${t('qr.trNote', { who: t('qr.translator') })} <span data-q-notehint hidden>${t('qr.noteHint')}</span></p>
    <p class="src center">${t('qr.src')}</p>
  </div>`;

  let observers = [];
  let timer = 0;
  const readTimers = new Map();
  return {
    html,
    mount(el) {
      const box = el.querySelector('[data-ayahs]');
      const page = el.querySelector('[data-q-page]');
      el.querySelectorAll('[data-q-size]').forEach((b) =>
        b.addEventListener('click', () => {
          const size = Math.max(0, Math.min(3, readPrefs().size + Number(b.dataset.qSize)));
          setReadPrefs({ size });
          SIZES.forEach((c) => page.classList.remove(c));
          page.classList.add(SIZES[size]);
        }),
      );
      const trBtn = el.querySelector('[data-q-tr]');
      trBtn.addEventListener('click', () => {
        const on = !readPrefs().tr;
        setReadPrefs({ tr: on });
        page.classList.toggle('no-tr', !on);
        trBtn.classList.toggle('is-on', on);
        trBtn.setAttribute('aria-pressed', String(on));
      });

      // 读过一节：今天的数字跳一下；读完一章：底部亮出"这一章读完了"
      const counted = (k) => {
        const r = markRead(s.n, k, today);
        if (r.newly) {
          const num = el.querySelector('[data-q-today]');
          if (num) {
            num.textContent = readOn(today);
            replay(num, 'bump');
          }
        }
        if (r.surahDone) {
          const done = el.querySelector('[data-q-done]');
          if (done) {
            done.hidden = false;
            replay(done, 'is-pop');
          }
          if (navigator.vibrate) navigator.vibrate([30, 50, 30]);
        }
      };

      loadSurah(s.n, getLang())
        .then(({ ar, tr }) => {
          const trs = tr.map(trHTML);
          const hint = el.querySelector('[data-q-notehint]');
          if (hint) hint.hidden = !trs.some((x) => x.note);
          box.innerHTML = ar
            .map((a, i) => {
              const k = i + 1;
              const on = isMarked(s.n, k);
              return `<article class="ayah" id="a${k}" data-ayah="${k}">
                <div class="ayah-head"><span class="ayah-key">${s.n}:${k}</span>
                  <button type="button" class="ayah-mark ${on ? 'is-on' : ''}" data-mark="${k}" aria-pressed="${on}" aria-label="${t(on ? 'qr.unmark' : 'qr.mark', { n: `${s.n}:${k}` })}">${RIBBON}</button></div>
                <p class="ayah-ar" lang="ar" dir="rtl">${esc(a)} <span class="ayah-no">﴿${arNum(k)}﴾</span></p>
                <p class="ayah-tr">${trs[i].html}</p></article>`;
            })
            .join('');
          box.querySelectorAll('[data-mark]').forEach((b) =>
            b.addEventListener('click', () => {
              const k = Number(b.dataset.mark);
              const on = toggleBookmark(s.n, k);
              b.classList.toggle('is-on', on);
              b.setAttribute('aria-pressed', String(on));
              b.setAttribute('aria-label', t(on ? 'qr.unmark' : 'qr.mark', { n: `${s.n}:${k}` }));
              if (on) replay(b, 'is-pop');
              if (navigator.vibrate) navigator.vibrate(15);
              softToast(t(on ? 'qr.marked' : 'qr.unmarked', { n: `${s.n}:${k}` }));
            }),
          );
          if (target > 1 && target <= s.ayahs) {
            const node = el.querySelector('#a' + target);
            if (node) {
              node.classList.add('is-target');
              node.scrollIntoView({ block: 'start' });
            }
          }
          setLastRead(s.n, target > 0 && target <= s.ayahs ? target : 1);
          if (!('IntersectionObserver' in window)) return;
          // 读到哪里：屏幕上方第一节，停下 0.8 秒后记下
          const seen = new Set();
          const where = new IntersectionObserver(
            (entries) => {
              for (const e of entries) e.isIntersecting ? seen.add(Number(e.target.dataset.ayah)) : seen.delete(Number(e.target.dataset.ayah));
              clearTimeout(timer);
              timer = setTimeout(() => seen.size && setLastRead(s.n, Math.min(...seen)), 800);
            },
            { rootMargin: '-20% 0px -60% 0px' },
          );
          // 读过没有：一节在屏幕中间那一段停了 1.2 秒，就算读过
          const read = new IntersectionObserver(
            (entries) => {
              for (const e of entries) {
                const k = Number(e.target.dataset.ayah);
                if (e.isIntersecting && !readTimers.has(k)) readTimers.set(k, setTimeout(() => counted(k), 1200));
                if (!e.isIntersecting && readTimers.has(k)) {
                  clearTimeout(readTimers.get(k));
                  readTimers.delete(k);
                }
              }
            },
            { rootMargin: '-15% 0px -25% 0px' },
          );
          // 翻到这一章最后：屏幕上还看得见的几节也算读过（短章一屏就能看完）
          const end = new IntersectionObserver(
            (entries) => {
              if (!entries.some((e) => e.isIntersecting)) return;
              setTimeout(() => {
                const vh = window.innerHeight;
                box.querySelectorAll('.ayah').forEach((a) => {
                  const r = a.getBoundingClientRect();
                  if (r.bottom > 0 && r.top < vh) counted(Number(a.dataset.ayah));
                });
              }, 1500);
            },
            { threshold: 0.6 },
          );
          box.querySelectorAll('.ayah').forEach((a) => {
            where.observe(a);
            read.observe(a);
          });
          end.observe(el.querySelector('[data-q-end]'));
          observers = [where, read, end];
        })
        .catch(() => {
          box.innerHTML = `<p class="note">${t('common.offlineMissing')}</p>`;
        });
    },
    unmount() {
      clearTimeout(timer);
      readTimers.forEach((x) => clearTimeout(x));
      observers.forEach((o) => o.disconnect());
    },
  };
}
