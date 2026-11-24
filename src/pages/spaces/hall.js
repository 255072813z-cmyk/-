// 礼拜大殿：可左右走动的全景。选一张垫子坐下，安静待一会儿；垫子坐满了就排队。
// 人数、哪些垫子有人，全部来自在线人数服务的真实数据；服务未启用时只有你自己。
import { hallPanorama, matPos } from '../../ui/spaces-art.js';
import { ICONS } from '../../ui/art.js';
import { joinRoom, presenceEnabled } from '../../core/presence.js';
import { skyPhase } from '../../core/prayer-times.js';
import { fmtHM, splitDuration } from '../../core/clock.js';
import { t } from '../../i18n/index.js';

const LOCAL_CAPACITY = 40;

export function hallPage(ctx) {
  const live = presenceEnabled();
  const st = { online: null, capacity: LOCAL_CAPACITY, taken: [], queue: 0, mine: null, queuePos: null, connected: false };
  let room = null;
  let el = null;
  let msg = '';

  const html = `
  <div class="page hall-page">
    <div class="page-head"><a class="back" href="#/masjid" aria-label="返回清真寺">${ICONS.back}</a>
      <h1>礼拜大殿 <span class="ar-sm" lang="ar" dir="rtl">بَيْتُ الصَّلَاة</span></h1></div>
    <p class="hall-count" data-count aria-live="polite"></p>
    <div class="pano-wrap">
      <div class="pano" data-pano tabindex="0" aria-label="大殿全景，可以左右滑动"></div>
      <div class="walk">
        <button class="btn btn-ghost btn-sm" type="button" data-walk="-1" aria-label="往左走">← 往左走</button>
        <button class="btn btn-ghost btn-sm" type="button" data-walk="1" aria-label="往右走">往右走 →</button>
      </div>
    </div>
    <section class="card hall-panel" data-panel></section>
  </div>`;

  const mySpot = () => (st.mine == null ? null : matPos(st.mine));

  function drawPano() {
    const pano = el.querySelector('[data-pano]');
    const left = pano.scrollLeft;
    pano.innerHTML = hallPanorama({ capacity: st.capacity, taken: st.taken, mine: st.mine, phase: skyPhase(ctx.sched.times, ctx.now) });
    pano.scrollLeft = left;
    pano.querySelectorAll('.mat.is-free').forEach((g) => {
      const go = () => sit(+g.dataset.mat);
      g.addEventListener('click', go);
      g.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          go();
        }
      });
    });
  }

  function drawCount() {
    const n = el.querySelector('[data-count]');
    if (!live) n.textContent = '在线人数在网站正式上线后显示。现在你可以先选一张垫子坐下。';
    else if (!st.connected) n.textContent = '正在连接…';
    else n.textContent = `此刻在大殿 ${st.online} 人 · 坐着 ${st.taken.length} 人 · 空垫子 ${st.capacity - st.taken.length} 张`;
  }

  function drawPanel() {
    const p = el.querySelector('[data-panel]');
    const s = ctx.sched;
    const left = splitDuration(s.nextTime - ctx.now);
    const next = `下一番：${t('prayer.' + s.next)} ${fmtHM(s.nextTime)}（还有 ${left.h ? left.h + ' 小时 ' : ''}${left.m} 分）`;
    const spot = mySpot();
    const full = st.taken.length >= st.capacity && st.mine == null;
    if (spot) {
      p.className = 'card hall-panel is-sitting';
      p.innerHTML = `<p class="sit-title">你坐在第 ${spot.r + 1} 排第 ${spot.c + 1} 张垫子上</p>
        <div class="breath" aria-hidden="true"></div>
        <p>安静坐一会儿。可以默念赞词，也可以什么都不想。</p>
        <p class="note">${next}</p>
        <div class="step-btns"><a class="btn btn-ghost" href="#/tasbih">默念赞词</a><button class="btn btn-ghost" type="button" data-stand>起身离开</button></div>`;
      p.querySelector('[data-stand]').addEventListener('click', stand);
    } else if (full) {
      p.className = 'card hall-panel is-full';
      p.innerHTML = st.queuePos
        ? `<p class="sit-title">你排在第 ${st.queuePos} 位</p><p>有人起身时，空出来的垫子会自动留给排在最前面的人。</p><p class="note">${next}</p>
           <div class="step-btns"><a class="btn btn-ghost" href="#/masjid/courtyard">先去庭院喝杯茶</a></div>`
        : `<p class="sit-title">垫子都坐满了</p><p>${st.capacity} 张垫子都有人。可以排队等一张，也可以先在后面站一会儿。</p><p class="note">${next}</p>
           <div class="step-btns"><button class="btn btn-primary" type="button" data-queue>排队等一张</button><a class="btn btn-ghost" href="#/masjid/courtyard">去庭院</a></div>`;
      const q = p.querySelector('[data-queue]');
      if (q) q.addEventListener('click', () => room && room.queue());
    } else {
      p.className = 'card hall-panel';
      p.innerHTML = `<p class="sit-title">${msg || '点一张空垫子，坐下来'}</p><p>脱了鞋，走到前面去。可以左右走走看看。</p><p class="note">${next}</p>`;
    }
  }

  function drawAll() {
    if (!el) return;
    drawPano();
    drawCount();
    drawPanel();
  }

  function sit(i) {
    msg = '';
    if (live) {
      if (room) room.sit(i);
    } else {
      st.mine = i;
      drawAll();
    }
  }
  function stand() {
    if (live) {
      if (room) room.stand();
    } else {
      st.mine = null;
      drawAll();
    }
  }

  function toast(text) {
    const layer = document.querySelector('.toast-layer');
    if (!layer) return;
    layer.innerHTML = `<div class="toast" role="status"><div class="toast-text"><strong>${text}</strong></div><div class="toast-actions"><button class="btn btn-ghost btn-sm" type="button" data-close>知道了</button></div></div>`;
    layer.querySelector('[data-close]').addEventListener('click', () => (layer.innerHTML = ''));
  }

  return {
    html,
    mount(root) {
      el = root;
      drawAll();
      // 一进来，镜头对着米哈拉布
      const pano = el.querySelector('[data-pano]');
      pano.scrollLeft = (pano.scrollWidth - pano.clientWidth) / 2;
      el.querySelectorAll('[data-walk]').forEach((b) =>
        b.addEventListener('click', () => pano.scrollBy({ left: +b.dataset.walk * pano.clientWidth * 0.6, behavior: 'smooth' })),
      );
      if (live) {
        room = joinRoom('hall', {
          onStatus(s) {
            st.connected = s === 'open';
            drawCount();
          },
          onState(m) {
            st.connected = true;
            st.online = m.online;
            st.capacity = m.capacity;
            st.taken = m.taken.filter((x) => x !== m.you.mat);
            st.mine = m.you.mat;
            st.queuePos = m.you.queuePos;
            if (m.event === 'assigned' && st.mine != null) {
              const p = matPos(st.mine);
              toast(`轮到你了：第 ${p.r + 1} 排第 ${p.c + 1} 张垫子留给你`);
            }
            if (m.event === 'error:taken') msg = '这张刚被别人坐了，换一张吧';
            drawAll();
          },
        });
      }
    },
    tick() {
      if (el && ctx.now.getUTCSeconds() === 0) drawPanel();
    },
    unmount() {
      if (room) room.leave();
      el = null;
    },
  };
}
