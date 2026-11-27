// 早晚记念：早晨、傍晚各一组（内容和出处见 content/adhkar.js）。
// 每条：阿拉伯文 + 译音 + 意思 + 贵处 + 出处；点下面的圆按钮记一遍，念满就打勾。
// 念到哪里只存在这台手机上（当天有效），不计分、不排名。
import { ADHKAR, MORNING, EVENING, NAS_TR } from '../../content/adhkar.js';
import { TASBIH_100, surah as reciteSurah } from '../../content/recitations.js';
import { loadSurah, surah as quranSurah, arNum } from '../../core/quran.js';
import { adhkarPart, adhkarProgress, setAdhkarCount, resetAdhkar } from '../../core/adhkar.js';
import { ymdKey } from '../../core/clock.js';
import { ICONS, star8 } from '../../ui/art.js';
import { replay } from '../../ui/motion.js';
import { t, L, TR, getLang } from '../../i18n/index.js';
import { esc } from '../../i18n/format.js';
import { trHTML } from '../quran/read.js';
import { loadFailed } from '../../ui/load-failed.js';

const surahName = (s) => s[getLang()] || s.ru;

/** 第 112、113 章用念词里的译音，第 114 章用 NAS_TR */
function ayahTr(n, i) {
  if (n === 114) return TR({ tr: NAS_TR.tr[i], trc: { tg: NAS_TR.tg[i], ru: NAS_TR.ru[i], uz: NAS_TR.uz[i] } });
  return TR(reciteSurah(n).ayahs[i]);
}

function body(id) {
  const x = ADHKAR[id];
  if (x.quran) {
    // 三章：原文和意思等页面打开后从古兰经数据里取（和古兰经页同一个出版译本）
    return `${x.quran
      .map((n) => {
        const s = quranSurah(n);
        return `<div class="dk-surah" data-dk-surah="${n}">
          <p class="dk-sname">${n}. ${surahName(s)} <span class="ar-sm" lang="ar" dir="rtl">${s.ar}</span></p>
          <div class="skel" role="status" aria-label="${t('common.loading')}"><i></i><i></i></div></div>`;
      })
      .join('')}
      <p class="note">${t('adhkar.quranNote', { who: t('qr.translator') })}</p>`;
  }
  const r = x.tasbih100 ? TASBIH_100 : x;
  const tr = TR(r);
  return `<p class="ar" lang="ar" dir="rtl">${r.ar}</p>
    <p class="tr" lang="${tr.lang}">${tr.text}</p>
    <p class="zh">${x.tasbih100 ? L(TASBIH_100) : L(x.mean)}</p>`;
}

function itemHTML(id, n, done) {
  const x = ADHKAR[id];
  const label = x.perDay ? t('adhkar.perDay', { n: x.count }) : t('common.repeat', { n: x.count });
  return `<article class="card dk ${done ? 'is-done' : ''}" data-dk="${id}">
    <header class="dk-head"><h2 class="dk-title">${star8(16)} ${L(x.title)}</h2><span class="dk-count">${label}</span></header>
    ${body(id)}
    <p class="dk-fadl"><b>${t('adhkar.virtue')}</b> ${L(x.fadl)}</p>
    <p class="src">${t('common.source', { src: L(x.src) })}</p>
    <button type="button" class="dk-tap" data-tap aria-label="${t('adhkar.tap')}: ${L(x.title)}">
      <span class="dk-tap-n"><b data-n>${Math.min(n, x.count)}</b> / ${x.count}</span>
      <span class="dk-tap-l">${done ? t('adhkar.done') : t('adhkar.tap')}</span>
    </button>
  </article>`;
}

export function adhkarPage(ctx, which) {
  const part = which === 'morning' ? 'm' : which === 'evening' ? 'e' : adhkarPart(ctx.sched, ctx.now);
  const list = part === 'm' ? MORNING : EVENING;
  const day = ymdKey(ctx.sched.today);
  let { counts, done } = adhkarProgress(day, part);
  const bar = () => {
    const a = done.length;
    return `<p class="dk-prog-t">${t('adhkar.progress', { a, b: list.length })}</p>
      <span class="q-bar" aria-hidden="true"><i style="width:${Math.round((100 * a) / list.length)}%"></i></span>`;
  };
  const html = `
  <div class="page adhkar">
    <div class="page-head"><a class="back" href="#/pray" aria-label="${t('common.back')}">${ICONS.back}</a><h1>${t('adhkar.title')}</h1></div>
    <div class="segmented big" role="group" aria-label="${t('adhkar.title')}">
      <a class="seg ${part === 'm' ? 'is-on' : ''}" href="#/adhkar/morning" ${part === 'm' ? 'aria-current="page"' : ''}>${t('adhkar.morning')}</a>
      <a class="seg ${part === 'e' ? 'is-on' : ''}" href="#/adhkar/evening" ${part === 'e' ? 'aria-current="page"' : ''}>${t('adhkar.evening')}</a>
    </div>
    <p class="note">${t('adhkar.sub')} ${t('adhkar.when')}</p>
    <section class="card dk-prog" data-prog>${bar()}</section>
    <p class="dk-all" data-all ${done.length >= list.length ? '' : 'hidden'}>✓ ${t(part === 'm' ? 'adhkar.allDoneM' : 'adhkar.allDoneE')}</p>
    ${list.map((id) => itemHTML(id, counts[id] || 0, done.includes(id))).join('')}
    <p class="note center">${t('adhkar.private')}</p>
    <div class="step-btns"><button type="button" class="btn btn-ghost btn-sm" data-reset>${t('tasbih.reset')}</button></div>
  </div>`;

  return {
    html,
    mount(el) {
      // 三章古兰经：原文 + 译音 + 当前语言的译文
      el.querySelectorAll('[data-dk-surah]').forEach((box) => {
        const n = Number(box.dataset.dkSurah);
        loadSurah(n, getLang())
          .then(({ ar, tr }) => {
            const skel = box.querySelector('.skel');
            if (skel)
              skel.outerHTML = ar
                .map((a, i) => {
                  const x = ayahTr(n, i);
                  return `<div class="dk-ayah"><p class="ar" lang="ar" dir="rtl">${esc(a)} <span class="ayah-no">﴿${arNum(i + 1)}﴾</span></p>
                    <p class="tr" lang="${x.lang}">${x.text}</p><p class="zh">${trHTML(tr[i]).html}</p></div>`;
                })
                .join('');
          }, () => {
            const skel = box.querySelector('.skel');
            if (skel) loadFailed(skel);
          });
      });
      // 点一下记一遍；念满打勾，整组念完显示一句
      el.querySelectorAll('[data-dk]').forEach((card) => {
        const id = card.dataset.dk;
        const target = ADHKAR[id].count;
        const btn = card.querySelector('[data-tap]');
        btn.addEventListener('click', () => {
          const cur = Math.min(target, (counts[id] || 0) + 1);
          if ((counts[id] || 0) >= target) return;
          counts[id] = cur;
          const all = setAdhkarCount(day, part, id, cur, target);
          card.querySelector('[data-n]').textContent = cur;
          replay(card.querySelector('[data-n]'), 'bump');
          if (navigator.vibrate) navigator.vibrate(cur >= target ? [20, 40, 20] : 8);
          if (cur >= target) {
            if (!done.includes(id)) done.push(id);
            card.classList.add('is-done');
            btn.querySelector('.dk-tap-l').textContent = t('adhkar.done');
            replay(btn, 'is-pop');
            el.querySelector('[data-prog]').innerHTML = bar();
            // 下一条还没念完的，轻轻滚到它
            const next = [...el.querySelectorAll('[data-dk]:not(.is-done)')][0];
            if (next && !all) setTimeout(() => next.scrollIntoView({ behavior: 'smooth', block: 'start' }), 350);
          }
          if (all) {
            const box = el.querySelector('[data-all]');
            box.hidden = false;
            replay(box, 'is-pop');
          }
        });
      });
      el.querySelector('[data-reset]').addEventListener('click', () => {
        resetAdhkar(day, part);
        ({ counts, done } = adhkarProgress(day, part));
        ctx.rerender();
      });
    },
  };
}
