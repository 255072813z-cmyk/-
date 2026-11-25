// 古兰经（底部标签），从上到下：
//   继续读（上次读到哪一章哪一节、这一章读了百分之几、几天前）
//   我的读经：今天读了几节、最近 7 天、全部读了多少；书签；最近读过
//   常念的章节、30 天通读计划、114 章目录（可搜索，每章显示读到哪里、读完打勾）
// 读书记录只存在这台手机上，不计分、不排名。
import { SURAHS, surah, lastRead, searchSurahs, COMMON, surahProgress, allProgress, readDays, bookmarks, toggleBookmark, recentRead, daysAgo } from '../../core/quran.js';
import { JUZ } from '../../content/juz.js';
import { load } from '../../core/storage.js';
import { ramadanStatus } from '../../core/ramadan.js';
import { ymdKey } from '../../core/clock.js';
import { star8 } from '../../ui/art.js';
import { t, getLang } from '../../i18n/index.js';

/** 当前语言的章名（中文开发版、塔吉克语、俄语） */
export const surahName = (s) => s[getLang()] || s.ru;

const ago = (tm) => {
  const d = daysAgo(tm);
  return d == null ? '' : d === 0 ? t('qr.ago0') : d === 1 ? t('qr.ago1') : t('qr.agoN', { n: d });
};
const pct = (a, b) => (b ? Math.round((100 * a) / b) : 0);

function row(s) {
  const p = surahProgress(s.n);
  const state = p.done ? `<span class="sura-done" aria-label="${t('qr.doneShort')}">✓</span>` : '';
  return `<li><a class="sura ${p.done ? 'is-done' : ''}" href="#/quran/${s.n}">
  <span class="sura-n">${s.n}</span>
  <span class="sura-main"><b>${surahName(s)}</b><small>${t('qr.place.' + s.place)} · ${t('qr.ayahs', { n: s.ayahs })}${p.max && !p.done ? ` · ${t('qr.readTo', { n: p.max })}` : ''}</small>
    ${p.max && !p.done ? `<span class="q-bar thin" aria-hidden="true"><i style="width:${pct(p.max, p.total)}%"></i></span>` : ''}</span>
  <span class="sura-ar" lang="ar" dir="rtl">${s.ar}</span>${state}</a></li>`;
}

/** 书签一行：章节 + 章名 + 几天前；右边可以删 */
const markRow = (b) => {
  const s = surah(b.s);
  return `<li class="q-li"><a href="#/quran/${b.s}/${b.a}"><span class="q-li-t"><b>${b.s}:${b.a}</b>${surahName(s)}</span><small>${ago(b.t)}</small></a>
    <button type="button" class="q-x" data-unmark="${b.s}:${b.a}" aria-label="${t('qr.unmark', { n: `${b.s}:${b.a}` })}">×</button></li>`;
};

export function quranHome(ctx) {
  const today = ymdKey(ctx.sched.today);
  const last = lastRead();
  const ls = last && surah(last.s);
  const lp = last ? surahProgress(last.s) : null;
  const st = ramadanStatus(ctx.sched.today, ctx.hijriAdjust);
  const raw = load('quran:' + st.year, []);
  const done = Array.isArray(raw) ? [...new Set(raw.filter((n) => Number.isInteger(n) && n >= 1 && n <= 30))] : [];
  const next = JUZ.find((j) => !done.includes(j.n));
  const all = allProgress();
  const week = readDays(today, 7);
  const peak = Math.max(10, ...week.map((d) => d.n));
  const todayN = week[week.length - 1].n;
  const marks = bookmarks();
  const recent = recentRead().filter((h) => !last || h.s !== last.s).slice(0, 4);

  const statsCard = `<section class="card q-stats">
      <div class="q-today-big"><b>${todayN}</b><span>${todayN ? t('qr.todayN', { n: todayN }) : t('qr.todayZero')}</span></div>
      <ol class="q-week" aria-label="${t('qr.week')}">${week
        .map((d, i) => {
          const wd = new Date(d.day + 'T00:00:00Z').getUTCDay();
          return `<li class="${i === week.length - 1 ? 'is-today' : ''} ${d.n ? 'has' : ''}" title="${d.day}: ${d.n}"><span class="q-col"><i style="height:${d.n ? Math.max(8, pct(d.n, peak)) : 4}%"></i></span><small>${t('weekShort.' + wd)}</small></li>`;
        })
        .join('')}</ol>
      <p class="q-all">${t('qr.overall', { n: all.read, c: all.done })}</p>
      <span class="q-bar" aria-hidden="true"><i style="width:${Math.max(all.read ? 1 : 0, pct(all.read, all.total))}%"></i></span>
      <p class="note">${t('qr.readNote')}</p>
    </section>`;

  const html = `
  <div class="page quran-home">
    <header class="ph">
      <h1>${t('qr.title')} <span class="ar-sm" lang="ar" dir="rtl">القُرْآنُ الكَرِيمُ</span></h1>
      <p class="ph-sub">${t('qr.sub')}</p>
    </header>
    ${
      ls
        ? `<a class="card card-link q-continue" href="#/quran/${last.s}/${last.a}">
            <span class="q-continue-k">${t('qr.continue')}${last.t ? ` · ${ago(last.t)}` : ''}</span>
            <b>${last.s}. ${surahName(ls)}</b><span>${t('qr.ayahN', { n: last.a })} · ${t('qr.pct', { p: pct(lp.max, lp.total) })}</span>
            <span class="q-bar light" aria-hidden="true"><i style="width:${pct(lp.max, lp.total)}%"></i></span>
            <span class="r-link-go">→</span></a>`
        : `<a class="card card-link q-continue" href="#/quran/1">
            <span class="q-continue-k">${t('qr.start')}</span><b>1. ${surahName(surah(1))}</b><span class="r-link-go">→</span></a>`
    }

    <h2 class="sec">${t('qr.secMine')}</h2>
    ${statsCard}
    ${
      recent.length
        ? `<section class="card"><h3 class="card-title">${star8(18)} ${t('qr.recent')}</h3><ul class="q-list">${recent
            .map((h) => {
              const s = surah(h.s);
              const p = surahProgress(h.s);
              return `<li class="q-li"><a href="#/quran/${h.s}/${h.a}"><span class="q-li-t"><b>${h.s}.</b>${surahName(s)}</span><small>${p.done ? t('qr.doneShort') : t('qr.ayahN', { n: h.a })} · ${ago(h.t)}</small></a></li>`;
            })
            .join('')}</ul></section>`
        : ''
    }
    <section class="card" data-q-marks ${marks.length ? '' : 'hidden'}>
      <h3 class="card-title">${star8(18)} ${t('qr.marks')} <span class="badge-count">${marks.length}</span></h3>
      <ul class="q-list" data-q-marklist>${marks.slice(0, 20).map(markRow).join('')}</ul>
    </section>

    <h2 class="sec">${t('qr.common')}</h2>
    <div class="q-chips">${COMMON.map((c) => {
      const s = surah(c.s);
      return `<a class="chip" href="#/quran/${c.s}${c.a ? '/' + c.a : ''}">${c.key ? t('qr.' + c.key) : surahName(s)}</a>`;
    }).join('')}</div>

    <h2 class="sec">${t('qr.secPlan')}</h2>
    <a class="card card-link q-plan" href="#/quran/plan">
      <span class="r-link-t">${t('qr.planTitle')}</span>
      <span class="r-link-s">${done.length >= 30 ? t('quran.allDone') : t('qr.planNext', { done: done.length, n: next ? next.n : 30 })}</span>
      <span class="q-bar" aria-hidden="true"><i style="width:${Math.round((done.length / 30) * 100)}%"></i></span>
      <span class="r-link-go">→</span>
    </a>

    <h2 class="sec">${t('qr.all')}</h2>
    <section class="card">
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
      // 删书签：原地删掉这一行
      const box = el.querySelector('[data-q-marks]');
      box.addEventListener('click', (e) => {
        const b = e.target.closest('[data-unmark]');
        if (!b) return;
        const [s, a] = b.dataset.unmark.split(':').map(Number);
        toggleBookmark(s, a);
        b.closest('li').remove();
        const left = bookmarks().length;
        box.querySelector('.badge-count').textContent = left;
        if (!left) box.hidden = true;
      });
    },
  };
}
