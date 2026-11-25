// 备份与恢复：导出、导入来回一致；不收别的文件；不导出亲友圈密钥和统计排队
import { test } from 'node:test';
import assert from 'node:assert/strict';

// 用内存代替手机的 localStorage
const mem = new Map();
globalThis.window = {
  localStorage: {
    get length() {
      return mem.size;
    },
    key: (i) => [...mem.keys()][i] ?? null,
    getItem: (k) => (mem.has(k) ? mem.get(k) : null),
    setItem: (k, v) => mem.set(k, String(v)),
    removeItem: (k) => mem.delete(k),
  },
};
const { makeBackup, parseBackup, applyBackup } = await import('../src/core/backup.js');
const put = (k, v) => mem.set('masjid:' + k, JSON.stringify(v));

test('导出 → 导入：个人记录原样恢复，亲友圈密钥、统计排队不导出', () => {
  mem.clear();
  put('settings', { lang: 'uz', city: 'tashkent' });
  put('prayed', { '2026-12-17': { fajr: true }, '2026-12-18': { fajr: true, dhuhr: true } });
  put('qada', { fajr: 3, isha: 2 });
  put('qprog', { 1: 7, 2: 20 });
  put('qmarks', [{ s: 2, a: 255, t: 1 }]);
  put('fast:2027', { 1: 1 });
  put('circle', { id: 'secret', key: 'k' });
  put('statq', [1, 2]);
  const b = makeBackup(new Date('2026-12-18T10:00:00Z'));
  assert.equal(b.app, 'joynamoz');
  assert.ok(!('circle' in b.data) && !('statq' in b.data));
  const text = JSON.stringify(b);
  // 换到"新手机"：先清空，再导入
  mem.clear();
  put('circle', { id: 'other' });
  const r = parseBackup(text);
  assert.equal(r.created, '2026-12-18');
  assert.deepEqual(r.summary, { prayed: 2, qada: 5, verses: 27, marks: 1, badges: 0 });
  applyBackup(r.data);
  assert.deepEqual(JSON.parse(mem.get('masjid:qada')), { fajr: 3, isha: 2 });
  assert.deepEqual(JSON.parse(mem.get('masjid:fast:2027')), { 1: 1 });
  assert.equal(JSON.parse(mem.get('masjid:settings')).lang, 'uz');
  assert.deepEqual(JSON.parse(mem.get('masjid:circle')), { id: 'other' }); // 新手机上的亲友圈不动
});

test('不是本应用的备份、坏文件、更新版本的备份都不接受；不认识的键丢掉', () => {
  assert.equal(parseBackup('').error, 'empty');
  assert.equal(parseBackup('{oops').error, 'format');
  assert.equal(parseBackup(JSON.stringify({ app: 'other', v: 1, data: { qada: {} } })).error, 'format');
  assert.equal(parseBackup(JSON.stringify({ app: 'joynamoz', v: 99, data: { qada: {} } })).error, 'newer');
  const r = parseBackup(JSON.stringify({ app: 'joynamoz', v: 1, data: { qada: { fajr: 1 }, evil: 1, 'fast:abc': 1, 'quran:2026': [1] } }));
  assert.deepEqual(Object.keys(r.data).sort(), ['qada', 'quran:2026']);
});
