// 本地测试用的在线人数服务（与线上 Cloudflare 版共用 room.js 的规则）。
// 用法：node server/dev-server.mjs [端口] [大殿垫子数]
import { WebSocketServer } from 'ws';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { ROOMS, newSession, applyAction, removeSession, snapshotFor, parseMessage } from './room.js';

export function startPresenceServer({ port = 8787, hallCapacity } = {}) {
  const conf = JSON.parse(JSON.stringify(ROOMS));
  if (hallCapacity != null) conf.hall.capacity = hallCapacity;
  const rooms = Object.fromEntries(Object.keys(conf).map((r) => [r, new Map()])); // ws -> session
  // 只读人数：GET /counts（不进房间、不算人头）
  const http = createServer((req, res) => {
    if (req.url === '/counts') {
      const out = {};
      for (const [room, map] of Object.entries(rooms)) {
        const list = [...map.values()];
        out[room] = { online: list.length, capacity: conf[room].capacity, taken: list.filter((x) => x.mat != null).length };
      }
      res.writeHead(200, { 'content-type': 'application/json', 'access-control-allow-origin': '*', 'cache-control': 'no-store' });
      return res.end(JSON.stringify(out));
    }
    res.writeHead(404);
    res.end();
  });
  http.listen(port);
  const wss = new WebSocketServer({ server: http });
  const broadcast = (room, events = {}) => {
    const map = rooms[room];
    const list = [...map.values()];
    for (const [ws, s] of map) ws.send(JSON.stringify(snapshotFor(list, s, conf[room].capacity, events[s.id])));
  };
  wss.on('connection', (ws, req) => {
    const m = (req.url || '').match(/^\/room\/([a-z]+)$/);
    if (!m || !rooms[m[1]]) return ws.close(1008, 'not found');
    const room = m[1];
    const map = rooms[room];
    map.set(ws, newSession(randomUUID()));
    broadcast(room);
    ws.on('message', (data) => {
      const raw = data.toString();
      if (raw === 'ping') return ws.send('pong');
      const action = parseMessage(raw);
      const me = map.get(ws);
      if (!action || !me) return;
      const res = applyAction([...map.values()], me, action, conf[room].capacity);
      const events = Object.fromEntries(res.assigned.map((id) => [id, 'assigned']));
      if (!res.ok) events[me.id] = 'error:' + res.error;
      broadcast(room, events);
    });
    ws.on('close', () => {
      const me = map.get(ws);
      map.delete(ws);
      if (!me) return;
      const list = [...map.values(), me];
      const assigned = removeSession(list, me.id, conf[room].capacity);
      broadcast(room, Object.fromEntries(assigned.map((id) => [id, 'assigned'])));
    });
  });
  return {
    get port() {
      return http.address().port;
    },
    close: () => new Promise((r) => wss.close(() => http.close(r))),
    wss,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const s = startPresenceServer({ port: +(process.argv[2] || 8787), hallCapacity: process.argv[3] != null ? +process.argv[3] : undefined });
  console.log(`在线人数服务（本地）：ws://127.0.0.1:${s.port}/room/hall`);
}
