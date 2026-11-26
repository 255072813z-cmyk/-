// 插图：全部为 SVG，不使用图片文件。
// 红线：人物只用剪影或背影，不画五官；装饰用几何花纹、穹顶、宣礼塔、拱门。

/** 八角星（伊斯兰几何花纹的基本形） */
export function star8(size = 24, cls = '') {
  return `<svg class="star8 ${cls}" width="${size}" height="${size}" viewBox="-12 -12 24 24" aria-hidden="true">
    <rect x="-7.5" y="-7.5" width="15" height="15" />
    <rect x="-7.5" y="-7.5" width="15" height="15" transform="rotate(45)" />
    <circle r="3.2" class="star8-c" />
  </svg>`;
}

/** 背影：走向清真寺的人（戴多比帽，长者拄杖、孩子牵手） */
export function walker(x, s, variant) {
  const stick = variant === 'elder' ? '<path d="M15 14L19 40" class="stick"/>' : '';
  return `<g transform="translate(${x} ${200 - 46 * s}) scale(${s})" class="walker">
    <circle cx="8" cy="5" r="4.2"/><path class="cap" d="M3.9 4.2Q4 0 8 -0.2Q12 0 12.1 4.2Z"/>
    <path d="M2 10Q8 7.5 14 10L15.5 30L14 44L2 44L0.5 30Z"/>${stick}
  </g>`;
}

/**
 * 首页场景：远处的群山、蓝绿色穹顶的清真寺、亮着灯的大门，人们走向清真寺。
 * phase：dawn/day/dusk/night 天色；winter：下雪（积雪 + 飘雪）
 */
export function mosqueScene({ phase = 'day', winter = false } = {}) {
  const flakes = winter
    ? `<g class="snow">${Array.from({ length: 34 }, (_, i) => {
        const x = (i * 53) % 360;
        const r = 0.8 + ((i * 7) % 5) * 0.35;
        const d = 6 + ((i * 13) % 7);
        const delay = -((i * 1.7) % d);
        return `<circle cx="${x}" cy="-6" r="${r}" style="animation-duration:${d}s;animation-delay:${delay}s"/>`;
      }).join('')}</g>`
    : '';
  const stars =
    !winter && (phase === 'night' || phase === 'dawn')
      ? `<g class="stars">${Array.from({ length: 18 }, (_, i) => `<circle cx="${(i * 71) % 350 + 5}" cy="${(i * 37) % 70 + 6}" r="${i % 3 ? 0.7 : 1.1}"/>`).join('')}</g>`
      : '';
  const orb = winter
    ? '<g class="clouds"><ellipse cx="80" cy="40" rx="60" ry="16"/><ellipse cx="250" cy="30" rx="80" ry="18"/><ellipse cx="170" cy="56" rx="70" ry="12"/></g>'
    : phase === 'night'
      ? '<path class="moon" d="M300 34a14 14 0 1 0 10 24a11 11 0 1 1-10-24z"/>'
      : phase === 'dusk' || phase === 'dawn'
        ? '<circle class="sun low" cx="300" cy="118" r="16"/>'
        : '<circle class="sun" cx="300" cy="40" r="13"/>';
  return `<svg class="scene phase-${phase} ${winter ? 'is-winter' : ''}" viewBox="0 0 360 200" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
    <rect class="sky" width="360" height="200"/>
    ${stars}${orb}
    <path class="mtn far" d="M0 128L40 96L70 112L112 78L150 106L190 84L232 110L270 90L312 112L360 92V200H0Z"/>
    <path class="mtn-snow" d="M104 85L112 78L121 86L115 84L110 88ZM183 89L190 84L197 90L192 88ZM263 95L270 90L277 96L271 94Z"/>
    <path class="mtn near" d="M0 150L56 126L98 142L150 120L210 146L262 128L320 148L360 136V200H0Z"/>
    <g class="mosque">
      <rect class="m-body" x="112" y="128" width="136" height="52"/>
      <path class="m-portal" d="M156 180V118H204V180Z"/>
      <path class="m-door" d="M168 180V146Q168 134 180 128Q192 134 192 146V180Z"/>
      <path class="m-dome" d="M150 128Q150 92 180 84Q210 92 210 128Z"/>
      <path class="m-rib" d="M180 84V128M165 90Q160 108 162 128M195 90Q200 108 198 128"/>
      <path class="m-drum" d="M146 128H214V134H146Z"/>
      <path class="m-finial" d="M180 84V74M176 70a4.5 4.5 0 1 0 6 -1a3.6 3.6 0 1 1 -6 1z"/>
      <rect class="m-minaret" x="100" y="86" width="12" height="94"/>
      <rect class="m-minaret" x="248" y="86" width="12" height="94"/>
      <path class="m-cap" d="M98 88L106 72L114 88ZM246 88L254 72L262 88Z"/>
      <rect class="m-band" x="100" y="104" width="12" height="4"/><rect class="m-band" x="248" y="104" width="12" height="4"/>
      <g class="m-win">${[124, 138, 216, 230].map((x) => `<path d="M${x} 170V156Q${x} 150 ${x + 5} 148Q${x + 10} 150 ${x + 10} 156V170Z"/>`).join('')}</g>
      ${winter ? '<path class="snowcap" d="M150 112Q160 92 180 86Q200 92 210 112Q196 100 180 98Q164 100 150 112ZM98 88L114 88L112 91L100 91ZM246 88L262 88L260 91L248 91ZM110 128H250V131H110Z"/>' : ''}
    </g>
    <rect class="ground" y="180" width="360" height="20"/>
    ${winter ? '<path class="snow-ground" d="M0 182Q60 176 120 181T240 180T360 181V200H0Z"/>' : ''}
    <g class="walkers">${walker(70, 1, 'elder')}${walker(92, 0.95)}${walker(112, 0.7)}${walker(268, 0.9)}</g>
    ${flakes}
  </svg>`;
}

/** 底部导航用的小图标 */
export const ICONS = {
  // 分享（向上的箭头出盒子）
  share: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 15V4M8 8l4-4 4 4M5 13v6h14v-6"/></svg>',
  // 早晚记念：地平线上半个太阳和一弯新月
  adhkar: '<svg viewBox="0 0 24 24" aria-hidden="true"><g fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 19h18M6.5 19a5.5 5.5 0 0 1 11 0M12 7.5V5M6.2 10.2 4.6 8.6M17.8 10.2l1.6-1.6"/></g><path d="M18.6 2.6a3.2 3.2 0 1 0 2.8 4.6 2.6 2.6 0 0 1-2.8-4.6Z"/></svg>',
  home: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20V11Q4 6 12 3Q20 6 20 11V20H14V15Q14 13 12 13Q10 13 10 15V20Z"/></svg>',
  pray: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="5" r="2.2"/><path d="M6 9Q9 8 12 9L13 15L19 15Q21 15 21 17V20H4L5 15Z"/></svg>',
  masjid: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 21V13Q7 8 12 6Q17 8 17 13V21H14V17Q14 15 12 15Q10 15 10 17V21Z"/><rect x="2.5" y="9" width="2.6" height="12"/><rect x="18.9" y="9" width="2.6" height="12"/><path d="M12 6V3M2.5 9L3.8 6L5.1 9ZM18.9 9L20.2 6L21.5 9Z" stroke-width="1.2"/></svg>',
  ramadan: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13 3a9 9 0 1 0 7.5 14A7.2 7.2 0 1 1 13 3Z"/><path d="M18 5l.8 1.7 1.8.3-1.3 1.3.3 1.8-1.6-.9-1.6.9.3-1.8L15.4 7l1.8-.3Z"/></svg>',
  qibla: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke-width="2"/><path d="M12 5L15 13L12 11.5L9 13Z"/></svg>',
  tasbih: '<svg viewBox="0 0 24 24" aria-hidden="true">' + Array.from({ length: 9 }, (_, i) => { const a = (i / 9) * Math.PI * 2 - Math.PI / 2; return `<circle cx="${(12 + 7.5 * Math.cos(a)).toFixed(1)}" cy="${(11 + 7.5 * Math.sin(a)).toFixed(1)}" r="1.7"/>`; }).join('') + '<path d="M12 18.5V23" stroke-width="1.6"/></svg>',
  settings: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 8.5A3.5 3.5 0 1 0 12 15.5A3.5 3.5 0 1 0 12 8.5ZM10.5 2H13.5L14 5L16.5 6.2L19 4.5L21 7L19 9.5L19.6 12L22 13V16L19.4 16.6L18.2 19L19.5 21.5L17 23L14.6 21L12 21.5L9.5 23L7 21.5L8 19L6.6 16.8L4 16V13L6.5 12L6.9 9.5L5 7L7 4.5L9.5 6.2L10 5Z" fill-rule="evenodd"/></svg>',
  back: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 4L7 12L15 20" fill="none" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  // 古兰经：打开的书放在经架（rahla）上
  quran: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 6.2C9.8 4.6 6.6 4.1 3.5 4.6v11.6c3.1-.4 6.3.1 8.5 1.7 2.2-1.6 5.4-2.1 8.5-1.7V4.6c-3.1-.5-6.3 0-8.5 1.6Z"/><path d="M4 20.5l8-3.2 8 3.2" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  // 我的：简单的人形图标（不画五官）
  me: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4.2"/><path d="M3.8 21c.6-4.6 3.9-7.2 8.2-7.2s7.6 2.6 8.2 7.2Z"/></svg>',
  rings: '<svg viewBox="0 0 24 24" aria-hidden="true"><g fill="none" stroke-width="2"><circle cx="8.5" cy="10" r="4.5"/><circle cx="15.5" cy="10" r="4.5"/><circle cx="12" cy="15.5" r="4.5"/></g></svg>',
  calendar: '<svg viewBox="0 0 24 24" aria-hidden="true"><g fill="none" stroke-width="2" stroke-linecap="round"><rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/></g><circle cx="8" cy="14.5" r="1.3"/><circle cx="12" cy="14.5" r="1.3"/><circle cx="16" cy="14.5" r="1.3"/></svg>',
  pin: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 22s7-6.5 7-12a7 7 0 1 0-14 0c0 5.5 7 12 7 12Z" fill="none" stroke-width="2"/><circle cx="12" cy="10" r="2.6"/></svg>',
  drop: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5c4 5.2 6.5 8.8 6.5 12a6.5 6.5 0 0 1-13 0c0-3.2 2.5-6.8 6.5-12Z"/></svg>',
  qada: '<svg viewBox="0 0 24 24" aria-hidden="true"><g fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3"/><path d="M4 4.5V8h3.5"/><path d="M12 8v4.5l3 2"/></g></svg>',
};
