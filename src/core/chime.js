// 到时间时的一声轻响：用 Web Audio 合成的柔和钟声，不加载音频文件。
// 默认静音；用户在设置里打开"提醒声"时（一次点按）才创建音频，符合浏览器的自动播放规则。
let ctx = null;

export function unlockAudio() {
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    if (!ctx) ctx = new AC();
    if (ctx.state === 'suspended') ctx.resume();
    return true;
  } catch (e) {
    return false;
  }
}

export function playChime() {
  if (!unlockAudio()) return;
  const t0 = ctx.currentTime + 0.05;
  // 两个音，像远处的一声铃，音量很低
  [
    [523.25, 0],
    [659.25, 0.45],
  ].forEach(([freq, delay]) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, t0 + delay);
    gain.gain.exponentialRampToValueAtTime(0.12, t0 + delay + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + delay + 2.2);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t0 + delay);
    osc.stop(t0 + delay + 2.3);
  });
}
