// 在线人数服务（Cloudflare Workers + Durable Objects，免费套餐可用）。
// 每个房间（大殿/庭院/诗歌夜）一个 Durable Object，用 WebSocket 休眠接口：
// 没人说话时不占资源；每个连接的状态存在连接自身的附件里，不写任何存储。
//
// 部署（上线时做）：
//   cd server && npx wrangler deploy
//   然后把 wrangler.toml 里的 ALLOWED_ORIGINS 改成网站地址，
//   构建网站时设置 VITE_PRESENCE_URL=wss://<部署后的地址>
import { ROOMS, newSession, applyAction, removeSession, snapshotFor, parseMessage } from './room.js';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    // 只读人数：GET /counts → {hall:{online,capacity,taken}, courtyard:{online}, poetry:{online}}（不进房间、不算人头）
    if (url.pathname === '/counts') {
      const out = {};
      for (const room of Object.keys(ROOMS)) {
        const r = await env.ROOMS.get(env.ROOMS.idFromName(room)).fetch('https://room/count/' + room);
        out[room] = await r.json();
      }
      return new Response(JSON.stringify(out), {
        headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*', 'cache-control': 'no-store' },
      });
    }
    const m = url.pathname.match(/^\/room\/([a-z]+)$/);
    if (!m || !ROOMS[m[1]]) return new Response('not found', { status: 404 });
    if (request.headers.get('Upgrade') !== 'websocket') return new Response('expected websocket', { status: 426 });
    const allowed = (env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
    if (allowed.length && !allowed.includes(request.headers.get('Origin') || '')) return new Response('forbidden', { status: 403 });
    return env.ROOMS.get(env.ROOMS.idFromName(m[1])).fetch(request);
  },
};

export class Room {
  constructor(state) {
    this.state = state;
    // 客户端每 25 秒发 "ping"，由平台直接回 "pong"，不唤醒房间
    this.state.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
  }

  async fetch(request) {
    const path = new URL(request.url).pathname;
    const room = path.split('/').pop();
    const conf = ROOMS[room];
    if (path.startsWith('/count/')) {
      const list = this.entries().map((e) => e.s);
      return new Response(JSON.stringify({ online: list.length, capacity: conf.capacity, taken: list.filter((x) => x.mat != null).length }));
    }
    if (this.state.getWebSockets().length >= conf.maxOnline) return new Response('full', { status: 503 });
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.state.acceptWebSocket(server);
    server.serializeAttachment({ room, ...newSession(crypto.randomUUID()) });
    this.broadcast(room);
    return new Response(null, { status: 101, webSocket: client });
  }

  entries(exclude) {
    return this.state
      .getWebSockets()
      .filter((ws) => ws !== exclude)
      .map((ws) => ({ ws, s: ws.deserializeAttachment() }))
      .filter((e) => e.s);
  }

  persist(entries) {
    for (const { ws, s } of entries) ws.serializeAttachment(s);
  }

  async webSocketMessage(ws, message) {
    const action = parseMessage(typeof message === 'string' ? message : '');
    const entries = this.entries();
    const mine = entries.find((e) => e.ws === ws);
    if (!action || !mine) return;
    const room = mine.s.room;
    const list = entries.map((e) => e.s);
    const res = applyAction(list, mine.s, action, ROOMS[room].capacity);
    this.persist(entries);
    const events = Object.fromEntries(res.assigned.map((id) => [id, 'assigned']));
    if (!res.ok) events[mine.s.id] = 'error:' + res.error;
    this.broadcast(room, events, entries);
  }

  async webSocketClose(ws) {
    this.leave(ws);
    try {
      ws.close(1000, 'bye');
    } catch (e) {
      /* 已关闭 */
    }
  }

  async webSocketError(ws) {
    this.leave(ws);
  }

  leave(ws) {
    const gone = ws.deserializeAttachment();
    if (!gone) return;
    const entries = this.entries(ws);
    const list = entries.map((e) => e.s);
    const assigned = removeSession(list, gone.id, ROOMS[gone.room].capacity);
    this.persist(entries);
    this.broadcast(gone.room, Object.fromEntries(assigned.map((id) => [id, 'assigned'])), entries);
  }

  broadcast(room, events = {}, entries = this.entries()) {
    const list = entries.map((e) => e.s);
    for (const { ws, s } of entries) {
      try {
        ws.send(JSON.stringify(snapshotFor(list, s, ROOMS[room].capacity, events[s.id])));
      } catch (e) {
        /* 对方已断开 */
      }
    }
  }
}
