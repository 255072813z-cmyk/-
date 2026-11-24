// 成就徽章的图标和格子。图标全是几何线条（拱门、日出、水滴、新月、书……），没有人物和动物。
import { t } from '../i18n/index.js';

const P = (d) => `<path d="${d}"/>`;
const C = (x, y, r) => `<circle cx="${x}" cy="${y}" r="${r}"/>`;
const beads = Array.from({ length: 10 }, (_, i) => {
  const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
  return C((12 + 6.5 * Math.cos(a)).toFixed(1), (10.5 + 6.5 * Math.sin(a)).toFixed(1), 1.3);
}).join('');

const ICON = {
  firstPrayer: P('M6 20v-8a6 6 0 0 1 12 0v8') + P('M3.5 20h17') + P('M12 9.5v4'),
  fiveDay: [0, 1, 2, 3, 4].map((i) => C(4 + i * 4, i % 2 ? 9 : 14, 1.8)).join('') + P('M3 19h18'),
  fiveWeek: '<rect x="3.5" y="5" width="17" height="15" rx="2"/>' + P('M3.5 9.5h17M8 3v4M16 3v4') + P('M8.5 14.5l2.5 2.5 4.5-4.5'),
  fajr7: P('M4 18h16') + P('M7 18a5 5 0 0 1 10 0') + P('M12 8.5v2M6.5 11l1.3 1.3M17.5 11l-1.3 1.3M4.5 15h1.5M18 15h1.5'),
  fajr30: P('M3 18h18') + P('M6 18a6 6 0 0 1 12 0') + P('M12 6.5v2.5M5.5 9.5l1.6 1.6M18.5 9.5l-1.6 1.6M3 14h2M19 14h2') + P('M8 21h8'),
  wudu: P('M12 3.5c3.5 4.6 5.5 7.8 5.5 10.5a5.5 5.5 0 0 1-11 0c0-2.7 2-5.9 5.5-10.5z') + P('M9.5 14.5a2.5 2.5 0 0 0 2.5 2.5'),
  guide1: '<rect x="6" y="3.5" width="12" height="17" rx="1.5"/>' + P('M9 20.5v-6a3 3 0 0 1 6 0v6'),
  guide30: '<rect x="7.5" y="3.5" width="11" height="17" rx="1.5"/>' + P('M10.5 20.5v-5.5a2.5 2.5 0 0 1 5 0v5.5') + P('M4.5 6.5v13'),
  tasbih: beads + P('M12 17v4.5M10.5 21.5h3'),
  qada: P('M4.5 12a7.5 7.5 0 1 0 2.2-5.3') + P('M4 4.5v3.5h3.5') + P('M12 8v4.5l3 2'),
  fast1: P('M15 4a8 8 0 1 0 5 13.5A6.5 6.5 0 1 1 15 4z'),
  fastAll: P('M13 4a8 8 0 1 0 5 13.5A6.5 6.5 0 1 1 13 4z') + P('M18.5 5l.7 1.5 1.6.2-1.2 1.1.3 1.6-1.4-.8-1.4.8.3-1.6-1.2-1.1 1.6-.2z'),
  naflFast: P('M14 4a8 8 0 1 0 5.5 13.6A6.5 6.5 0 1 1 14 4z') + C(18.5, 6.5, 1.6) + P('M18.5 2.5v1.2M18.5 9.3v1.2M14.5 6.5h1.2M21.3 6.5h1.2'),
  qadaFast: P('M14 4a8 8 0 1 0 5.5 13.6A6.5 6.5 0 1 1 14 4z') + P('M15.5 9.5a3 3 0 1 1 1 4.5') + P('M15 7.8v2.2h2.2'),
  tarawih: P('M12 2.5v2M9 4.5h6l1 3H8z') + P('M8 7.5l-1 9h10l-1-9') + P('M10 16.5v2.5h4v-2.5M12 10v3.5'),
  quran: P('M12 6.5c-2-1.5-5-2-8-1.5v13c3-.5 6 0 8 1.5 2-1.5 5-2 8-1.5V5c-3-.5-6 0-8 1.5z') + P('M12 6.5v13'),
  circle: C(8.5, 10, 4.5) + C(15.5, 10, 4.5) + C(12, 15.5, 4.5),
  share: C(17.5, 5.5, 2.3) + C(6.5, 12, 2.3) + C(17.5, 18.5, 2.3) + P('M8.5 10.8l7-4M8.5 13.2l7 4'),
};

export const badgeName = (id) => t('badge.' + id);
export const badgeHow = (id, need) => t('badge.' + id + '.how', { n: need });

export function badgeIcon(id, size = 30) {
  return `<svg class="badge-ico" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true">${ICON[id] || ''}</svg>`;
}

/** "我的坚持"页上的一个徽章格子：已解锁的亮起；没解锁的灰色，写怎样得到、进度条 */
export function badgeTile(b) {
  const pct = b.need ? Math.round((100 * (b.have || 0)) / b.need) : 0;
  const sub = b.got ? gotOn(b.got) : badgeHow(b.id, b.need);
  return `<li class="badge ${b.got ? 'is-got' : ''}" data-badge="${b.id}">
    <span class="badge-medal">${badgeIcon(b.id)}</span>
    <span class="badge-name">${badgeName(b.id)}</span>
    <span class="badge-sub">${sub}</span>
    ${!b.got && b.need ? `<span class="badge-bar" role="progressbar" aria-valuemin="0" aria-valuemax="${b.need}" aria-valuenow="${b.have || 0}" aria-label="${t('badge.progress', { have: b.have || 0, need: b.need })}"><i style="width:${pct}%"></i></span><span class="badge-prog">${t('badge.progress', { have: b.have || 0, need: b.need })}</span>` : ''}
  </li>`;
}

/** 获得的日期（短）：12月1日 / 1 декабря */
function gotOn(key) {
  const [, m, d] = key.split('-').map(Number);
  return t('badge.gotOn', { d, month: t('month.' + m) });
}
