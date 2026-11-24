// 氛围音：全部在手机上用 Web Audio 合成，不加载任何录音文件。
// - 诗歌夜：类似坦布尔/都塔尔的弹拨声（Karplus-Strong 弦振动算法）+ 低音持续音。
//   页面写明"本站合成的器乐氛围音，不是沙什玛考姆原曲录音"。
// - 庭院：小水池的流水声（滤波噪声）。
// 默认静音，只有用户点"播放"后才发声（符合浏览器自动播放规则）。
let ctx = null;
let master = null;
let timer = null;
let nodes = [];

function audio() {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  if (!ctx) {
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.0001;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

/** 一根弦拨一下：生成一段 Karplus-Strong 音频 */
function pluckBuffer(freq, seconds = 2.4) {
  const sr = ctx.sampleRate;
  const len = Math.floor(sr * seconds);
  const buf = ctx.createBuffer(1, len, sr);
  const out = buf.getChannelData(0);
  const period = Math.max(2, Math.round(sr / freq));
  const ring = new Float32Array(period);
  for (let i = 0; i < period; i++) ring[i] = Math.random() * 2 - 1;
  let idx = 0;
  for (let i = 0; i < len; i++) {
    const next = (idx + 1) % period;
    const v = 0.996 * 0.5 * (ring[idx] + ring[next]);
    out[i] = ring[idx];
    ring[idx] = v;
    idx = next;
  }
  return buf;
}

const cache = new Map();
const live = new Set(); // 已排好、还没响完的弹拨音，停止时一起停掉
function pluck(freq, when, gain = 0.5) {
  const key = Math.round(freq * 10);
  if (!cache.has(key)) cache.set(key, pluckBuffer(freq));
  const src = ctx.createBufferSource();
  src.buffer = cache.get(key);
  const g = ctx.createGain();
  g.gain.value = gain;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 2400;
  src.connect(lp).connect(g).connect(master);
  live.add(src);
  src.onended = () => live.delete(src);
  src.start(when);
}

// D 为主音的音阶（D E♭ F♯ G A B♭ C），中亚、波斯音乐中常见的音程色彩
const D = 146.83;
const ratio = { D: 1, Eb: 16 / 15, Fs: 5 / 4, G: 4 / 3, A: 3 / 2, Bb: 8 / 5, C: 16 / 9, D2: 2 };
const PHRASES = [
  ['D', 'A', 'G', 'Fs', 'G', 'A', '', 'A', 'Bb', 'A', 'G', 'Fs', 'Eb', 'D', '', ''],
  ['A', 'Bb', 'C', 'Bb', 'A', '', 'G', 'A', 'Fs', 'G', 'Eb', 'Fs', 'D', '', '', ''],
  ['D', 'D', 'Fs', 'G', 'A', 'A', 'Bb', 'A', 'G', 'Fs', 'G', 'A', 'D', '', '', ''],
];

export function startPoetryMusic() {
  if (!audio()) return false;
  stopAll();
  master.gain.cancelScheduledValues(ctx.currentTime);
  master.gain.setValueAtTime(0.0001, ctx.currentTime);
  master.gain.exponentialRampToValueAtTime(0.22, ctx.currentTime + 2);
  // 低音持续音
  [D / 2, (D / 2) * 1.5].forEach((f, i) => {
    const o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.value = f;
    const g = ctx.createGain();
    g.gain.value = i ? 0.04 : 0.06;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.15 + i * 0.07;
    const lg = ctx.createGain();
    lg.gain.value = 0.02;
    lfo.connect(lg).connect(g.gain);
    o.connect(g).connect(master);
    o.start();
    lfo.start();
    nodes.push(o, lfo);
  });
  let t = ctx.currentTime + 0.3;
  let p = 0;
  const beat = 0.42;
  const schedule = () => {
    // 提前排好下一句
    while (t < ctx.currentTime + 4) {
      const phrase = PHRASES[p % PHRASES.length];
      phrase.forEach((n, i) => {
        if (!n) return;
        const swing = i % 2 ? 0.04 : 0;
        pluck(D * ratio[n], t + i * beat + swing, i % 4 === 0 ? 0.55 : 0.4);
        if (i % 4 === 0) pluck((D * ratio[n]) / 2, t + i * beat, 0.25);
      });
      t += phrase.length * beat + beat * 2;
      p++;
    }
  };
  schedule();
  timer = setInterval(schedule, 1000);
  return true;
}

export function startFountain() {
  if (!audio()) return false;
  stopAll();
  master.gain.cancelScheduledValues(ctx.currentTime);
  master.gain.setValueAtTime(0.0001, ctx.currentTime);
  master.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + 1.5);
  const len = ctx.sampleRate * 2;
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 900;
  bp.Q.value = 0.6;
  const g = ctx.createGain();
  g.gain.value = 0.25;
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 0.3;
  const lg = ctx.createGain();
  lg.gain.value = 300;
  lfo.connect(lg).connect(bp.frequency);
  src.connect(bp).connect(g).connect(master);
  src.start();
  lfo.start();
  nodes.push(src, lfo);
  return true;
}

export function stopAll() {
  clearInterval(timer);
  timer = null;
  if (ctx && master) {
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.setValueAtTime(master.gain.value, ctx.currentTime);
    master.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.6);
  }
  live.forEach((s) => { try { s.stop(); } catch (e) { /* 已停止 */ } });
  live.clear();
  const old = nodes;
  nodes = [];
  setTimeout(() => old.forEach((n) => { try { n.stop(); } catch (e) { /* 已停止 */ } }), 700);
}
