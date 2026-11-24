// 古兰经（底部标签）：继续读、礼拜常念的章节、30 天通读计划、114 章目录（可搜索）。
import { SURAHS, surah, lastRead, searchSurahs, COMMON } from '../../core/quran.js';
import { JUZ } from '../../content/juz.js';
import { load } from '../../core/storage.js';
import { ramadanStatus } from '../../core/ramadan.js';
import { star8 } from '../../ui/art.js';
import { t, getLang } from '../../i18n/index.js';

/** 当前语言的章名（中文开发版、塔吉克语、俄语） */
export const surahName = (s) => s[getLang()] || s.ru;

const row = (s) => `<li><a class="sura" href="#/quran/${s.n}">
  <span class="sura-n">${s.n}</span>
  <span class="sura-main"><b>${surahName(s)}</b><small>${t('qr.place.' + s.place)} · ${t('qr.ayahs', { n: s.ayahs })}</small></span>
  <span class="sura-ar" lang="ar" dir="rtl">${s.ar}</span></a></li>`;

export function quranHome(ctx) {
  const last = lastRead();
  const ls = last && surah(last.s);
  const st = ramadanStatus(ctx.sched.today, ctx.hijriAdjust);
  const raw = load('quran:' + st.year, []);
  const done = Array.isArray(raw) ? [...new Set(raw.filter((n) => Number.isInteger(n) && n >= 1 && n <= 30))] : [];
  const next = JUZ.find((j) => !done.includes(j.n));
  const html = `
  <div class="page quran-home">
    <div class="r-status">
      <h1>${t('qr.title')} <span class="ar-sm" lang="ar" dir="rtl">القُرْآنُ الكَرِيمُ</span></h1>
    </div>
    ${
      ls
        ? `<a class="card card-link q-continue" href="#/quran/${last.s}/${last.a}">
            <span class="q-continue-k">${t('qr.continue')}</span>
            <b>${last.s}. ${surahName(ls)}</b><span>${t('qr.ayahN', { n: last.a })}</span><span class="r-link-go">→</span></a>`
        : `<a class="card card-link q-continue" href="#/quran/1">
            <span class="q-continue-k">${t('qr.start')}</span><b>1. ${surahName(surah(1))}</b><span class="r-link-go">→</span></a>`
    }
    <section class="card">
      <h2 class="card-title">${star8(18)} ${t('qr.common')}</h2>
      <div class="q-chips">${COMMON.map((c) => {
        const s = surah(c.s);
        return `<a class="chip" href="#/quran/${c.s}${c.a ? '/' + c.a : ''}">${c.key ? t('qr.' + c.key) : surahName(s)}</a>`;
      }).join('')}</div>
    </section>
    <a class="card card-link q-plan" href="#/quran/plan">
      <span class="r-link-t">${t('qr.planTitle')}</span>
      <span class="r-link-s">${done.length >= 30 ? t('quran.allDone') : t('qr.planNext', { done: done.length, n: next ? next.n : 30 })}</span>
      <span class="q-bar" aria-hidden="true"><i style="width:${Math.round((done.length / 30) * 100)}%"></i></span>
      <span class="r-link-go">→</span>
    </a>
    <section class="card">
      <h2 class="card-title">${star8(18)} ${t('qr.all')}</h2>
      <input class="q-search" type="search" data-q-search placeholder="${t('qr.search')}" aria-label="${t('qr.search')}" autocomplete="off">
      <ol class="suras" data-suras>${SURAHS.map(row).join('')}</ol>
      <p class="note" data-q-none hidden>${t('qr.none')}</p>
    </section>
    <p class="note center">${t('qr.trNote', { who: t('qr.translator') })}</p>
  </div>`;
  return {
    html,
    mount(el) {
      const input = el.querySelector('[data-q-search]');
      const list = el.querySelector('[data-suras]');
      const none = el.querySelector('[data-q-none]');
      input.addEventListener('input', () => {
        const found = searchSurahs(input.value);
        list.innerHTML = found.map(row).join('');
        none.hidden = found.length > 0;
      });
    },
  };
}
