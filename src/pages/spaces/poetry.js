// 诗歌夜：宵礼之后到晨礼之前开放。诗句轮换，配乐默认静音。
import { poetryScene } from '../../ui/spaces-art.js';
import { ICONS, star8 } from '../../ui/art.js';
import { POEMS } from '../../content/poems.js';
import { joinRoom, presenceEnabled } from '../../core/presence.js';
import { startPoetryMusic, stopAll } from '../../core/music.js';
import { fmtHM } from '../../core/clock.js';
import { poetryOpen } from './index.js';
import { t, L, getLang } from '../../i18n/index.js';

const ROTATE_MS = 20000;

export function poetryPage(ctx) {
  const open = poetryOpen(ctx.sched);
  const live = presenceEnabled();
  let i = 0;
  let playing = false;
  let el = null;
  let room = null;
  let online = null;
  let rot = null;

  if (!open) {
    const isha = ctx.sched.times.isha;
    return {
      html: `
      <div class="page poetry-page">
        <div class="page-head"><a class="back" href="#/masjid" aria-label="${t('common.back')}">${ICONS.back}</a><h1>${t('poetry.title')}</h1></div>
        <section class="poetry-wrap">${poetryScene({ open: false })}</section>
        <section class="card center-card">
          <p class="sit-title">${t('poetry.opensAt', { time: fmtHM(isha) })}</p>
          <p>${t('poetry.closedText')}</p>
        </section>
      </div>`,
    };
  }

  const html = `
  <div class="page poetry-page">
    <div class="page-head"><a class="back" href="#/masjid" aria-label="${t('common.back')}">${ICONS.back}</a><h1>${t('poetry.title')} <span class="ar-sm" lang="fa" dir="rtl">شب شعر</span></h1></div>
    <section class="poetry-wrap" data-scene>${poetryScene({ open: true })}</section>
    <section class="card verse-card" data-verse aria-live="polite"></section>
    <div class="step-btns">
      <button class="btn btn-ghost" type="button" data-prev>${t('poetry.prev')}</button>
      <button class="btn btn-primary" type="button" data-music aria-pressed="false">${t('poetry.play')}</button>
      <button class="btn btn-ghost" type="button" data-nextp>${t('poetry.next')}</button>
    </div>
    <p class="note center" data-count></p>
    <section class="card soft-card">
      <h2 class="card-title">${star8(18)} ${t('poetry.aboutTitle')}</h2>
      <p>${t('poetry.about')}</p>
      <p class="note">${t('poetry.musicNote')}</p>
      <p class="note">${t('poetry.textNote')}</p>
    </section>
  </div>`;

  function drawVerse() {
    const p = POEMS[i];
    const box = el.querySelector('[data-verse]');
    box.classList.remove('fade-in');
    void box.offsetWidth;
    box.classList.add('fade-in');
    box.innerHTML = `
      <p class="poet">${getLang() === 'zh' ? `${L(p.poet)} <span lang="tg">${p.poet.cyr}</span>` : `<span lang="${getLang()}">${L(p.poet)}</span>`} <span class="ar-sm" lang="fa" dir="rtl">${p.poet.fa}</span></p>
      <div class="fa" lang="fa" dir="rtl">${p.fa.map((l) => `<p>${l}</p>`).join('')}</div>
      <div class="tg" lang="tg">${p.cyr.map((l) => `<p>${l}</p>`).join('')}</div>
      ${getLang() === 'tg' ? '' : `<div class="zh">${L(p).map((l) => `<p>${l}</p>`).join('')}</div>`}
      <p class="src">${L(p.note)} · ${t('common.source', { src: L(p.src) })}</p>
      <p class="verse-dots" aria-hidden="true">${POEMS.map((_, k) => `<span class="${k === i ? 'on' : ''}"></span>`).join('')}</p>`;
  }
  const go = (d) => {
    i = (i + d + POEMS.length) % POEMS.length;
    drawVerse();
    restart();
  };
  function restart() {
    clearInterval(rot);
    rot = setInterval(() => go(1), ROTATE_MS);
  }

  return {
    html,
    mount(root) {
      el = root;
      drawVerse();
      restart();
      el.querySelector('[data-prev]').addEventListener('click', () => go(-1));
      el.querySelector('[data-nextp]').addEventListener('click', () => go(1));
      el.querySelector('[data-music]').addEventListener('click', (e) => {
        playing = !playing;
        if (playing) startPoetryMusic();
        else stopAll();
        e.currentTarget.setAttribute('aria-pressed', String(playing));
        e.currentTarget.textContent = playing ? t('poetry.stop') : t('poetry.play');
        el.querySelector('[data-scene]').innerHTML = poetryScene({ open: true, playing });
      });
      if (live)
        room = joinRoom('poetry', {
          onState(m) {
            online = m.online;
            const n = el && el.querySelector('[data-count]');
            if (n) n.textContent = t('poetry.online', { n: online });
          },
        });
    },
    tick(c) {
      // 到了晨礼，诗歌夜关门
      if (el && !poetryOpen(c.sched)) c.rerender();
    },
    unmount() {
      clearInterval(rot);
      stopAll();
      if (room) room.leave();
      el = null;
    },
  };
}
