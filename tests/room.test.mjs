// 在线人数与垫子规则测试
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newSession, applyAction, removeSession, snapshotFor, parseMessage } from '../server/room.js';

const mk = (...ids) => ids.map((id) => newSession(id));

test('坐空垫子；有人的垫子坐不了', () => {
  const list = mk('a', 'b');
  assert.equal(applyAction(list, list[0], { type: 'sit', mat: 3 }, 4).ok, true);
  const r = applyAction(list, list[1], { type: 'sit', mat: 3 }, 4);
  assert.equal(r.ok, false);
  assert.equal(r.error, 'taken');
  assert.deepEqual(snapshotFor(list, list[1], 4).taken, [3]);
});

test('坐满了排队；有人起身，垫子自动给排在最前面的人', () => {
  const list = mk('a', 'b', 'c', 'd');
  applyAction(list, list[0], { type: 'sit', mat: 0 }, 2);
  applyAction(list, list[1], { type: 'sit', mat: 1 }, 2);
  assert.equal(applyAction(list, list[2], { type: 'queue' }, 2, 100).ok, true);
  assert.equal(applyAction(list, list[3], { type: 'queue' }, 2, 200).ok, true);
  assert.equal(snapshotFor(list, list[2], 2).you.queuePos, 1);
  assert.equal(snapshotFor(list, list[3], 2).you.queuePos, 2);
  // 排队的人不能插队直接坐
  assert.equal(applyAction(list, list[3], { type: 'sit', mat: 0 }, 2).error, 'taken');
  const r = applyAction(list, list[0], { type: 'stand' }, 2);
  assert.deepEqual(r.assigned, ['c']);
  assert.equal(list[2].mat, 0);
  assert.equal(snapshotFor(list, list[3], 2).you.queuePos, 1);
  // 断线也会让出垫子
  const assigned = removeSession(list, 'b', 2);
  assert.deepEqual(assigned, ['d']);
  assert.equal(list.length, 3);
});

test('有空垫子时不用排队', () => {
  const list = mk('a');
  assert.equal(applyAction(list, list[0], { type: 'queue' }, 3).error, 'free');
});

test('人数房间（庭院、诗歌夜）只有人数', () => {
  const list = mk('a', 'b', 'c');
  const s = snapshotFor(list, list[0], 0);
  assert.equal(s.online, 3);
  assert.equal(s.capacity, 0);
  assert.equal(applyAction(list, list[0], { type: 'sit', mat: 0 }, 0).ok, false);
});

test('发给客户端的状态里没有别人的编号', () => {
  const list = mk('secret-a', 'secret-b');
  applyAction(list, list[0], { type: 'sit', mat: 1 }, 4);
  const json = JSON.stringify(snapshotFor(list, list[1], 4));
  assert.ok(!json.includes('secret-a') && !json.includes('secret-b'));
});

test('只接受很短的合法消息', () => {
  assert.deepEqual(parseMessage('{"type":"sit","mat":2}'), { type: 'sit', mat: 2 });
  assert.equal(parseMessage('x'.repeat(500)), null);
  assert.equal(parseMessage('not json'), null);
  assert.equal(applyAction(mk('a'), newSession('a'), { type: 'sit', mat: 1.5 }, 4).ok, false);
});
