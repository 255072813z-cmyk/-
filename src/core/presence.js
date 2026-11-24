// 在线人数：连接后台服务（server/），只收发人数和垫子状态，不发送任何个人信息。
// 构建时设置 VITE_API_URL（或单独的 VITE_PRESENCE_URL）才会连接；后台也可以远程临时关闭。
// 没有设置时不连接，页面上也不显示人数——不编造数字。
// 本地测试可在地址后加 ?presence=ws://127.0.0.1:8787（只接受本机地址）。

import { apiBase } from './api.js';

let gate = () => true;
/** main.js 设置：远程开关关掉时不连接 */
export function setPresenceGate(fn) {
  gate = fn;
}

function baseUrl() {
  if (!gate()) return '';
  try {
    const q = new URLSearchParams(location.search).get('presence');
    if (q) {
      const u = new URL(q);
      if ((u.protocol === 'ws:' || u.protocol === 'wss:') && ['127.0.0.1', 'localhost'].includes(u.hostname)) return q.replace(/\/$/, '');
    }
  } catch (e) {
    /* ignore */
  }
  const env = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env.VITE_PRESENCE_URL : '';
  if (env) return String(env).replace(/\/$/, '');
  const api = apiBase();
  return api ? api.replace(/^http/, 'ws') : '';
}

/** 只读人数（不进房间）：{ hall:{online,capacity,taken}, courtyard:{online}, poetry:{online} }；未启用或失败时为 null */
export async function fetchCounts() {
  const base = baseUrl();
  if (!base) return null;
  try {
    const r = await fetch(base.replace(/^ws/, 'http') + '/counts', { cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer' });
    return r.ok ? await r.json() : null;
  } catch (e) {
    return null;
  }
}

export function presenceEnabled() {
  return !!baseUrl() && typeof WebSocket !== 'undefined';
}

/**
 * 进入一个房间（hall 大殿 / courtyard 庭院 / poetry 诗歌夜）。
 * onState({ online, capacity, taken, queue, you:{mat, queuePos}, event }) —— 服务未启用时不会被调用。
 * 返回 { sit(mat), queue(), stand(), leave() }
 */
export function joinRoom(room, { onState, onStatus } = {}) {
  const base = baseUrl();
  let ws = null;
  let closed = false;
  let retry = 0;
  let ping = null;
  const send = (obj) => {
    if (ws && ws.readyState === 1) ws.send(JSON.stringify(obj));
  };
  function connect() {
    if (!base || closed || typeof WebSocket === 'undefined') return;
    onStatus && onStatus('connecting');
    try {
      ws = new WebSocket(`${base}/room/${room}`);
    } catch (e) {
      return schedule();
    }
    ws.onopen = () => {
      retry = 0;
      onStatus && onStatus('open');
      send({ type: 'hello' });
      ping = setInterval(() => ws && ws.readyState === 1 && ws.send('ping'), 25000);
    };
    ws.onmessage = (e) => {
      if (e.data === 'pong') return;
      try {
        const m = JSON.parse(e.data);
        if (m && m.type === 'state' && onState) onState(m);
      } catch (err) {
        /* ignore */
      }
    };
    ws.onclose = () => {
      clearInterval(ping);
      if (!closed) {
        onStatus && onStatus('offline');
        schedule();
      }
    };
    ws.onerror = () => {};
  }
  function schedule() {
    retry = Math.min(retry + 1, 6);
    setTimeout(connect, 1000 * 2 ** retry);
  }
  // 页面切到后台再回来时，若断了就立刻重连
  const onVisible = () => {
    if (!document.hidden && ws && ws.readyState > 1 && !closed) {
      retry = 0;
      connect();
    }
  };
  document.addEventListener('visibilitychange', onVisible);
  connect();
  return {
    sit: (mat) => send({ type: 'sit', mat }),
    queue: () => send({ type: 'queue' }),
    stand: () => send({ type: 'stand' }),
    leave() {
      closed = true;
      clearInterval(ping);
      document.removeEventListener('visibilitychange', onVisible);
      if (ws) ws.close(1000, 'bye');
    },
  };
}
