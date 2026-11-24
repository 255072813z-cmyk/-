// 诗歌夜：宵礼之后到晨礼之前开放。诗句轮换，配乐默认静音。
import { poetryScene } from '../../ui/spaces-art.js';
import { ICONS, star8 } from '../../ui/art.js';
import { POEMS } from '../../content/poems.js';
import { joinRoom, presenceEnabled } from '../../core/presence.js';
import { startPoetryMusic, stopAll } from '../../core/music.js';
import { fmtHM } from '../../core/clock.js';
import { poetryOpen } from './index.js';

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
        <div class="page-head"><a class="back" href="#/masjid" aria-label="返回清真寺">${ICONS.back}</a><h1>诗歌夜</h1></div>
        <section class="poetry-wrap">${poetryScene({ open: false })}</section>
        <section class="card center-card">
          <p class="sit-title">今晚宵礼（${fmtHM(isha)}）后开放</p>
          <p>礼完宵礼，来这里坐一坐，听一段沙什玛考姆，读几句鲁达基、鲁米、哈菲兹的诗。到晨礼为止。</p>
        </section>
      </div>`,
    };
  }

  const html = `
  <div class="page poetry-page">
    <div class="page-head"><a class="back" href="#/masjid" aria-label="返回清真寺">${ICONS.back}</a><h1>诗歌夜 <span class="ar-sm" lang="fa" dir="rtl">شب شعر</span></h1></div>
    <section class="poetry-wrap" data-scene>${poetryScene({ open: true })}</section>
    <section class="card verse-card" data-verse aria-live="polite"></section>
    <div class="step-btns">
      <button class="btn btn-ghost" type="button" data-prev>上一首</button>
      <button class="btn btn-primary" type="button" data-music aria-pressed="false">播放配乐</button>
      <button class="btn btn-ghost" type="button" data-nextp>下一首</button>
    </div>
    <p class="note center" data-count></p>
    <section class="card soft-card">
      <h2 class="card-title">${star8(18)} 关于诗歌夜</h2>
      <p>沙什玛考姆（Шашмақом，"六大木卡姆"）是塔吉克、乌兹别克的古典音乐，常用鲁米、哈菲兹等诗人的诗句作唱词。</p>
      <p class="note">配乐为本站合成的弹拨乐氛围音，不是沙什玛考姆原曲录音。默认静音，点"播放配乐"才会响。</p>
      <p class="note">波斯文原文出自 Ganjoor 古典诗歌库；塔吉克文为本站转写，中文为本站意译。</p>
    </section>
  </div>`;

  function drawVerse() {
    const p = POEMS[i];
    const box = el.querySelector('[data-verse]');
    box.classList.remove('fade-in');
    void box.offsetWidth;
    box.classList.add('fade-in');
    box.innerHTML = `
      <p class="poet">${p.poet.zh} <span lang="tg">${p.poet.tg}</span> <span class="ar-sm" lang="fa" dir="rtl">${p.poet.fa}</span></p>
      <div class="fa" lang="fa" dir="rtl">${p.fa.map((l) => `<p>${l}</p>`).join('')}</div>
      <div class="tg" lang="tg">${p.tg.map((l) => `<p>${l}</p>`).join('')}</div>
      <div class="zh">${p.zh.map((l) => `<p>${l}</p>`).join('')}</div>
      <p class="src">${p.note} · 出处：${p.src}</p>
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
        e.currentTarget.textContent = playing ? '停止配乐' : '播放配乐';
        el.querySelector('[data-scene]').innerHTML = poetryScene({ open: true, playing });
      });
      if (live)
        room = joinRoom('poetry', {
          onState(m) {
            online = m.online;
            const n = el && el.querySelector('[data-count]');
            if (n) n.textContent = `此刻在诗歌夜 ${online} 人`;
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
