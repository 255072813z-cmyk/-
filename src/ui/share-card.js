// 今日礼拜时间卡片：画成一张图片（1080×1350，竖版），发到 Telegram、WhatsApp 群里。
// 当地习惯每天在群里转发"今天的礼拜时间"图片；这张图带应用名，是最自然的口碑传播。
// 只在手机上画，不经过任何服务器；没有人像，只有八角星图案。
import { timesFor, PRAYERS } from '../core/prayer-times.js';
import { fmtHM } from '../core/clock.js';
import { toHijri } from '../core/hijri.js';
import { t, getLang } from '../i18n/index.js';
import { cityName } from '../i18n/format.js';
import { shareLink } from '../core/share.js';

const W = 1080;
const H = 1350;
const C = { bg: '#f7f2e6', card: '#fffcf4', green: '#0f5940', green2: '#17734f', gold: '#c9a24b', goldSoft: '#e9d8a6', ink: '#1d2b24', muted: '#6b766f', line: '#e2d6bb' };
const SERIF = '"Noto Serif", "Noto Serif CJK SC", "Songti SC", serif';
const SANS = '"Noto Sans", "PingFang SC", "Noto Sans CJK SC", sans-serif';
const AR = 'Amiri, "Noto Naskh Arabic", serif';

/** 八角星（两个正方形叠成） */
function star(g, x, y, r) {
  g.beginPath();
  for (let i = 0; i < 16; i++) {
    const a = (Math.PI / 8) * i - Math.PI / 2;
    const rr = i % 2 ? r * 0.72 : r;
    g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  g.closePath();
}

/** 字太长时缩小字号，保证放得下 */
function fit(g, text, max, size, weight, family) {
  let s = size;
  do {
    g.font = `${weight} ${s}px ${family}`;
    if (g.measureText(text).width <= max) break;
    s -= 2;
  } while (s > 18);
  return s;
}

async function fontsReady(texts) {
  if (!document.fonts || !document.fonts.load) return;
  const all = texts.join(' ');
  const wait = Promise.all([
    document.fonts.load(`700 64px ${SERIF}`, all),
    document.fonts.load(`400 34px ${SANS}`, all),
    document.fonts.load(`700 60px ${SANS}`, '0123456789:'),
    document.fonts.load(`400 46px ${AR}`, 'بِسْمِ اللَّهِ'),
  ]).catch(() => {});
  // 字体最多等 1.5 秒，等不到就用系统字体
  await Promise.race([wait, new Promise((r) => setTimeout(r, 1500))]);
}

/** 画今天（或 ymd 那天）的礼拜时间，返回 canvas */
export async function drawTimesCard(ctx, ymd = ctx.sched.today) {
  const T = timesFor(ctx.city, ymd, ctx.offsets);
  const h = toHijri(ymd, ctx.hijriAdjust);
  const title = t('app.name');
  const city = cityName(ctx.city);
  const date = t('date.full', { y: ymd.y, m: ymd.m, d: ymd.d, month: t('month.' + ymd.m), wd: t('week.' + ymd.wd) });
  const hijri = t('hijri.date', { y: h.y, month: t('hijri.month.' + h.m), d: h.d });
  const rows = [];
  for (const p of PRAYERS) {
    rows.push({ name: ymd.wd === 5 && p === 'dhuhr' ? t('home.jumuah') : t('prayer.' + p), time: fmtHM(T[p]), main: true });
    if (p === 'fajr') rows.push({ name: t('prayer.sunrise'), time: fmtHM(T.sunrise), main: false });
  }
  const note = ctx.official ? t('times.shareNoteOfficial') : t('times.shareNote');
  await fontsReady([title, city, date, hijri, note, t('shareImg.footer'), ...rows.map((r) => r.name)]);

  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const g = cv.getContext('2d');
  g.textBaseline = 'middle';
  // 底色和上方绿色横幅
  g.fillStyle = C.bg;
  g.fillRect(0, 0, W, H);
  g.fillStyle = C.green;
  g.fillRect(0, 0, W, 330);
  // 横幅里淡淡的星纹
  g.save();
  g.globalAlpha = 0.09;
  g.strokeStyle = C.goldSoft;
  g.lineWidth = 2;
  for (let y = 30; y < 330; y += 90) for (let x = (y / 90) % 2 ? 0 : 45; x < W + 45; x += 90) (star(g, x, y, 26), g.stroke());
  g.restore();
  // 太斯米、应用名、城市和日期
  g.textAlign = 'center';
  g.fillStyle = C.goldSoft;
  g.font = `400 46px ${AR}`;
  g.direction = 'rtl';
  g.fillText('بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ', W / 2, 72);
  g.direction = 'ltr';
  g.fillStyle = '#ffffff';
  fit(g, title, W - 120, 64, 700, SERIF);
  g.fillText(title, W / 2, 158);
  g.fillStyle = 'rgba(255,255,255,0.88)';
  fit(g, `${city} · ${date}`, W - 120, 36, 400, SANS);
  g.fillText(`${city} · ${date}`, W / 2, 230);
  g.fillStyle = C.goldSoft;
  fit(g, hijri, W - 120, 30, 400, SANS);
  g.fillText(hijri, W / 2, 284);

  // 时间表卡片
  const top = 380;
  const rowH = 118;
  const left = 70;
  const right = W - 70;
  g.fillStyle = C.card;
  g.strokeStyle = C.line;
  g.lineWidth = 2;
  g.beginPath();
  if (g.roundRect) g.roundRect(left - 20, top - 20, right - left + 40, rowH * rows.length + 40, 36);
  else g.rect(left - 20, top - 20, right - left + 40, rowH * rows.length + 40);
  g.fill();
  g.stroke();
  rows.forEach((r, i) => {
    const y = top + rowH * i + rowH / 2;
    if (i) {
      g.strokeStyle = C.line;
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(left + 20, top + rowH * i);
      g.lineTo(right - 20, top + rowH * i);
      g.stroke();
    }
    // 名字前的小八角星
    g.fillStyle = r.main ? C.gold : C.line;
    star(g, left + 32, y, 14);
    g.fill();
    g.textAlign = 'left';
    g.fillStyle = r.main ? C.ink : C.muted;
    fit(g, r.name, 520, r.main ? 46 : 38, r.main ? 700 : 400, SERIF);
    g.fillText(r.name, left + 66, y);
    g.textAlign = 'right';
    g.fillStyle = r.main ? C.green : C.muted;
    g.font = `700 ${r.main ? 64 : 48}px ${SANS}`;
    g.fillText(r.time, right - 24, y);
  });

  // 说明和页脚
  g.textAlign = 'center';
  g.fillStyle = C.muted;
  fit(g, note, W - 140, 28, 400, SANS);
  g.fillText(note, W / 2, top + rowH * rows.length + 62);
  // 下载地址（设置了网站地址或商店链接时才有）
  const link = shareLink(ctx.remote);
  if (link) {
    g.fillStyle = C.green;
    fit(g, link.replace(/^https:\/\//, ''), W - 140, 30, 700, SANS);
    g.fillText(link.replace(/^https:\/\//, ''), W / 2, top + rowH * rows.length + 112);
  }
  g.fillStyle = C.green;
  g.fillRect(0, H - 110, W, 110);
  g.fillStyle = C.goldSoft;
  star(g, 90, H - 55, 22);
  g.fill();
  g.fillStyle = '#ffffff';
  g.textAlign = 'left';
  fit(g, title, 380, 40, 700, SERIF);
  g.fillText(title, 128, H - 55);
  g.textAlign = 'right';
  g.fillStyle = 'rgba(255,255,255,0.86)';
  fit(g, t('shareImg.footer'), W - 560, 28, 400, SANS);
  g.fillText(t('shareImg.footer'), W - 60, H - 55);
  cv.dataset.lang = getLang();
  return cv;
}
