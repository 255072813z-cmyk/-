// 读古兰经的一章：阿拉伯原文（大字、从右往左）+ 当前语言的译文；太斯米单独一行（第 1 章它就是第 1 节，第 9 章没有）。
// 可调字号、可只看原文；读到哪一节自动记住，下次"继续读"。
import { surah, loadSurah, arNum, setLastRead, readPrefs, setReadPrefs } from '../../core/quran.js';
import { ICONS } from '../../ui/art.js';
import { t, getLang } from '../../i18n/index.js';
import { surahName } from './index.js';
import { esc } from '../../i18n/format.js';

const SIZES = ['q-s0', 'q-s1', 'q-s2', 'q-s3'];

export function quranRead(ctx, n, startAyah) {
  const s = surah(Number(n));
  if (!s) return { html: `<div class="page"><p class="loading">${t('qr.none')}</p></div>` };
  const prefs = readPrefs();
  const prev = surah(s.n - 1);
  const next = surah(s.n + 1);
  const html = `
  <div class="page quran-read ${SIZES[prefs.size]} ${prefs.tr ? '' : 'no-tr'}" data-q-page>
    <div class="page-head"><a class="back" href="#/quran" aria-label="${t('common.back')}">${ICONS.back}</a>
      <h1>${s.n}. ${surahName(s)} <span class="ar-sm" lang="ar" dir="rtl">${s.ar}</span></h1></div>
    <p class="q-meta">${t('qr.place.' + s.place)} · ${t('qr.ayahs', { n: s.ayahs })}</p>
    <div class="q-tools" role="group" aria-label="${t('qr.tools')}">
      <button type="button" class="btn btn-ghost btn-sm" data-q-size="-1" aria-label="${t('qr.smaller')}">A−</button>
      <button type="button" class="btn btn-ghost btn-sm" data-q-size="1" aria-label="${t('qr.bigger')}">A+</button>
      <button type="button" class="btn btn-ghost btn-sm ${prefs.tr ? 'is-on' : ''}" data-q-tr aria-pressed="${prefs.tr}">${t('qr.showTr')}</button>
    </div>
    ${s.n !== 1 && s.n !== 9 ? `<p class="q-basmala" lang="ar" dir="rtl">بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</p>` : ''}
    <div class="ayahs" data-ayahs><div class="skel" role="status" aria-label="${t('common.loading')}"><i class="tall"></i><i></i><i></i><i></i></div></div>
    <nav class="q-nav">
      ${prev ? `<a class="btn btn-ghost" href="#/quran/${prev.n}">← ${prev.n}. ${surahName(prev)}</a>` : '<span></span>'}
      ${next ? `<a class="btn btn-primary" href="#/quran/${next.n}">${next.n}. ${surahName(next)} →</a>` : ''}
    </nav>
    <p class="note center">${t('qr.trNote', { who: t('qr.translator') })}</p>
    <p class="src center">${t('qr.src')}</p>
  </div>`;

  let observer = null;
  let timer = 0;
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
      loadSurah(s.n, getLang())
        .then(({ ar, tr }) => {
          box.innerHTML = ar
            .map(
              (a, i) => `<article class="ayah" id="a${i + 1}" data-ayah="${i + 1}">
                <p class="ayah-ar" lang="ar" dir="rtl">${esc(a)} <span class="ayah-no">﴿${arNum(i + 1)}﴾</span></p>
                <p class="ayah-tr"><b>${s.n}:${i + 1}</b> ${esc(tr[i])}</p></article>`,
            )
            .join('');
          const target = Number(startAyah);
          if (target > 1 && target <= s.ayahs) {
            const node = el.querySelector('#a' + target);
            if (node) {
              node.classList.add('is-target');
              node.scrollIntoView({ block: 'start' });
            }
          }
          setLastRead(s.n, target > 0 && target <= s.ayahs ? target : 1);
          // 读到哪一节：屏幕上方第一节，停下 0.8 秒后记下
          if ('IntersectionObserver' in window) {
            const seen = new Set();
            observer = new IntersectionObserver(
              (entries) => {
                for (const e of entries) e.isIntersecting ? seen.add(Number(e.target.dataset.ayah)) : seen.delete(Number(e.target.dataset.ayah));
                clearTimeout(timer);
                timer = setTimeout(() => seen.size && setLastRead(s.n, Math.min(...seen)), 800);
              },
              { rootMargin: '-20% 0px -60% 0px' },
            );
            box.querySelectorAll('.ayah').forEach((a) => observer.observe(a));
          }
        })
        .catch(() => {
          box.innerHTML = `<p class="note">${t('common.offlineMissing')}</p>`;
        });
    },
    unmount() {
      clearTimeout(timer);
      if (observer) observer.disconnect();
    },
  };
}
