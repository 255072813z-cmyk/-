// 用 Miniflare（Cloudflare 官方本地运行时 workerd）测试 server/worker.js。
// 用法（Miniflare 较大，不放进项目依赖）：npm i --no-save miniflare@3.20250718.3 && node server/test-worker.mjs
import { Miniflare } from 'miniflare';
const root = new URL('.', import.meta.url).pathname.replace(/\/$/, '');
const mf = new Miniflare({
  modules: [
    { type: 'ESModule', path: root + '/worker.js' },
    { type: 'ESModule', path: root + '/room.js' },
  ],
  modulesRoot: root,
  compatibilityDate: '2025-06-01',
  durableObjects: { ROOMS: 'Room' },
  bindings: { ALLOWED_ORIGINS: '' },
});
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function connect(room) {
  const res = await mf.dispatchFetch('http://localhost/room/' + room, { headers: { Upgrade: 'websocket' } });
  const ws = res.webSocket;
  if (!ws) throw new Error('no websocket: ' + res.status);
  ws.accept();
  ws.send(JSON.stringify({ type: 'hello' }));
  const c = { ws, last: null, events: [] };
  ws.addEventListener('message', (e) => {
    if (e.data === 'pong') { c.pong = true; return; }
    c.last = JSON.parse(e.data);
    if (c.last.event) c.events.push(c.last.event);
  });
  return c;
}
const out = [];
const ok = (name, cond, detail = '') => { out.push(`${cond ? '通过' : '失败'}  ${name} ${detail}`); if (!cond) process.exitCode = 1; };

const bad = await mf.dispatchFetch('http://localhost/room/nope', { headers: { Upgrade: 'websocket' } });
ok('未知房间 404', bad.status === 404);
const noUp = await mf.dispatchFetch('http://localhost/room/hall');
ok('非 WebSocket 请求 426', noUp.status === 426);

const conns = [];
for (let i = 0; i < 42; i++) conns.push(await connect('hall'));
await sleep(300);
ok('42 人在线', conns[41].last && conns[41].last.online === 42, JSON.stringify(conns[41].last && conns[41].last.online));
for (let i = 0; i < 40; i++) conns[i].ws.send(JSON.stringify({ type: 'sit', mat: i }));
await sleep(400);
ok('40 张垫子坐满', conns[41].last.taken.length === 40);
conns[40].ws.send(JSON.stringify({ type: 'sit', mat: 5 }));
await sleep(200);
ok('有人的垫子坐不了', conns[40].events.includes('error:taken'));
conns[40].ws.send(JSON.stringify({ type: 'queue' }));
await sleep(100);
conns[41].ws.send(JSON.stringify({ type: 'queue' }));
await sleep(300);
ok('排队位置 1、2', conns[40].last.you.queuePos === 1 && conns[41].last.you.queuePos === 2, `${conns[40].last.you.queuePos},${conns[41].last.you.queuePos}`);
conns[7].ws.send(JSON.stringify({ type: 'stand' }));
await sleep(300);
ok('有人起身，垫子给排第一的人', conns[40].last.you.mat === 7 && conns[40].events.includes('assigned'), JSON.stringify(conns[40].last.you));
conns[3].ws.close(1000, 'bye');
await sleep(500);
ok('有人断线，垫子给下一位', conns[41].last.you.mat === 3 && conns[41].last.online === 41, JSON.stringify(conns[41].last.you) + ' online=' + conns[41].last.online);
conns[0].ws.send('ping');
await sleep(200);
ok('ping 自动回 pong', conns[0].pong === true);
const c2 = await connect('courtyard');
await sleep(200);
ok('庭院单独计数', c2.last && c2.last.online === 1 && c2.last.capacity === 0, JSON.stringify(c2.last));
const counts = await (await mf.dispatchFetch('http://localhost/counts')).json();
ok('只读人数 /counts', counts.hall.online === 41 && counts.courtyard.online === 1 && counts.poetry.online === 0 && counts.hall.taken === 40, JSON.stringify(counts));
console.log(out.join('\n'));
await mf.dispose();
