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

/** 头和多比帽（toqi：塔吉克方顶小帽，帽上有白色杏仁纹）。rot：头顶朝向（0 = 朝上） */
function head(cx, cy, rot = 0) {
  const cap =
    `M${cx - 7.8} ${cy - 2.6}L${cx - 7} ${cy - 8.6}Q${cx} ${cy - 10.9} ${cx + 7} ${cy - 8.6}L${cx + 7.8} ${cy - 2.6}Q${cx} ${cy - 4.2} ${cx - 7.8} ${cy - 2.6}Z`;
  const rim = `M${cx - 7.4} ${cy - 3.4}Q${cx} ${cy - 5} ${cx + 7.4} ${cy - 3.4}`;
  return `<g transform="rotate(${rot} ${cx} ${cy})"><circle cx="${cx}" cy="${cy}" r="7.4"/><path class="cap" d="${cap}"/><path class="cap-rim" d="${rim}"/></g>`;
}

/** 戴多比帽的人形，侧面剪影（无五官），面向右。posture: stand/raise/ruku/sujud/sit */
function figure(posture) {
  const edge = (d) => `<path class="edge" d="${d}"/>`;
  switch (posture) {
    case 'raise':
      return `${head(50, 16)}<path d="M47 21h6v6h-6z"/>
        <path d="M46 24Q40 26 40 33L39.5 60L37 93L62 93L60 58Q60 40 58 31Q56 25 52 24Z"/>
        <path d="M51 29Q56 27 58 30L58.5 12.5Q57 10.5 54.8 11.6L54 26Z"/>${edge('M52.5 30Q55 28.5 57.5 30.5')}
        <path d="M37 93L63 93Q67 93.5 67 96L37 96Z"/>`;
    case 'ruku':
      return `<path d="M35 52Q33 72 34.5 93L52 93L50.5 57Z"/>
        <path d="M35 53Q33 44 42 43L71 42.5Q76.5 43 76.5 48Q76 53.5 70 54.5L50 58Z"/>
        <path d="M73 44.5h6v6h-6z"/>${head(82, 47.5, 90)}
        <path d="M66 49L72.5 51L54.5 76.5L49.5 73.5Z"/>${edge('M67 50.5Q60 60 52 72')}
        <path d="M33.5 93L54 93Q58 93.5 58 96L33.5 96Z"/>`;
    case 'sujud':
      return `<path d="M12 96L12.5 89Q13 86.5 17 86.5L44 85.5L47 96Z"/>
        <path d="M30 67Q33 58 43 60L48 88L32 90Z"/>
        <path d="M31.5 63Q36 54.5 47 59L71 77.5Q75 82 70.5 88L44 80Z"/>
        ${head(77, 88.4, 118)}
        <path d="M62 79.5L69.5 82.5L79 96L66 96Z"/>${edge('M64 82Q70 88 73 95')}`;
    case 'sit':
      return `<path d="M27 96L27.5 87Q28.5 80 37 80L63 80.5Q70.5 81.5 70.5 88.5L69.5 96Z"/>
        <path d="M37 52Q35.5 44 44.5 42.5Q53 42.5 55 49L57.5 84L33.5 84Z"/>
        <path d="M43 35h6v8h-6z"/>${head(46, 32)}
        <path d="M49.5 48L55.5 47.5L66 79L60 81Z"/>${edge('M51.5 50Q57 64 62 79')}`;
    default:
      return `${head(50, 16)}<path d="M47 21h6v6h-6z"/>
        <path d="M46 24Q40 26 40 33L39.5 60L37 93L62 93L60 58Q60 40 58 31Q56 25 52 24Z"/>
        ${edge('M50.5 30Q53.5 40 55 46Q58 49 62 49')}
        <path d="M56.5 45Q64 45.5 63.6 50.4Q60 52.6 56 51Z"/>
        <path d="M37 93L63 93Q67 93.5 67 96L37 96Z"/>`;
  }
}

/**
 * 一排人一起礼拜（侧面），前方是米哈拉布拱门。
 * 三个人：长者、中年人、孩子——让在家礼拜的人感觉站在大家中间。
 */
export function prayerRow(posture = 'stand') {
  const people = [
    { x: 4, s: 1.0 },
    { x: 84, s: 1.0 },
    { x: 162, s: 0.8 },
  ];
  const figs = people
    .map(
      (p, i) =>
        `<g class="fig fig-${i}" transform="translate(${p.x} ${100 - 100 * p.s + 8}) scale(${p.s})">${figure(posture)}</g>`,
    )
    .join('');
  return `<svg class="prayer-row" viewBox="0 0 300 120" role="img" aria-label="一排人在礼拜（剪影）">
    <defs>
      <linearGradient id="mihrabGlow" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="var(--lamp)" stop-opacity=".55"/>
        <stop offset="1" stop-color="var(--lamp)" stop-opacity="0"/>
      </linearGradient>
    </defs>
    <path class="mihrab" d="M246 112V52Q246 30 268 16Q290 30 290 52V112Z"/>
    <path class="mihrab-in" d="M253 112V55Q253 38 268 27Q283 38 283 55V112Z"/>
    <path d="M253 112V55Q253 38 268 27Q283 38 283 55V112Z" fill="url(#mihrabGlow)"/>
    <rect class="rug" x="0" y="104" width="300" height="8" rx="2"/>
    <g class="rug-pattern">${Array.from({ length: 15 }, (_, i) => `<path d="M${10 + i * 20} 108l4-3 4 3-4 3z"/>`).join('')}</g>
    <g class="figs">${figs}</g>
  </svg>`;
}

/** 小净插图：正面剪影（无五官），高亮正在洗的部位 */
export function wuduFigure(zone) {
  const hl = {
    hands: '<ellipse cx="26.5" cy="102" rx="7" ry="8"/><ellipse cx="93.5" cy="102" rx="7" ry="8"/>',
    mouth: '<ellipse cx="60" cy="30" rx="5.5" ry="2.8"/>',
    nose: '<ellipse cx="60" cy="24.5" rx="2.8" ry="3.6"/>',
    face: '<ellipse cx="60" cy="25" rx="10.5" ry="12"/>',
    arms: '<path d="M26 72L34 74L31 99L22 98Z"/><path d="M94 72L86 74L89 99L98 98Z"/><circle cx="30" cy="73" r="4.5"/><circle cx="90" cy="73" r="4.5"/><circle cx="26" cy="103" r="6"/><circle cx="94" cy="103" r="6"/>',
    head: '<path d="M47.6 21A12.5 12.5 0 0 1 72.4 21Z"/>',
    ears: '<ellipse cx="47.6" cy="25" rx="4" ry="5"/><ellipse cx="72.4" cy="25" rx="4" ry="5"/>',
    neck: '<rect x="53.5" y="34" width="13" height="9" rx="3"/>',
    feet: '<path d="M40 122h19v14H40z"/><path d="M61 122h19v14H61z"/>',
  }[zone];
  const drops =
    zone && zone !== 'none' && zone !== 'done'
      ? `<g class="drops">${[
          [14, 30],
          [104, 44],
          [12, 78],
          [108, 96],
        ]
          .map(([x, y], i) => `<path style="animation-delay:${i * 0.4}s" d="M${x} ${y}q4 6 0 8q-4-2 0-8z"/>`)
          .join('')}</g>`
      : '';
  return `<svg class="wudu-fig ${zone === 'done' ? 'is-done' : ''}" viewBox="0 0 120 140" role="img" aria-label="小净示意（剪影）">
    ${zone === 'done' || zone === 'none' ? '<circle class="halo" cx="60" cy="70" r="58"/>' : ''}
    <g class="body">
      <circle cx="60" cy="24" r="12"/><ellipse cx="47.6" cy="25" rx="2.6" ry="3.6"/><ellipse cx="72.4" cy="25" rx="2.6" ry="3.6"/>
      <path d="M54.5 34h11v9h-11z"/>
      <path d="M44 42Q60 37.5 76 42Q83 44 84 52L83 92L37 92L36 52Q37 44 44 42Z"/>
      <path d="M38 45Q32 47 31 55L27 73L34.5 75L38 58Z"/><path d="M27 72L34.5 74.5L31.5 99L23 98Z"/>
      <path d="M21.5 98Q26 96 31.5 98L31 106Q26 109 22 106Z"/>
      <path d="M82 45Q88 47 89 55L93 73L85.5 75L82 58Z"/><path d="M93 72L85.5 74.5L88.5 99L97 98Z"/>
      <path d="M98.5 98Q94 96 88.5 98L89 106Q94 109 98 106Z"/>
      <path d="M41 92L58.5 92L57 128L44 128Z"/><path d="M61.5 92L79 92L76 128L63 128Z"/>
      <path d="M41 128.5Q49 126 57.5 129L58 135H41Z"/><path d="M62.5 129Q71 126 79 128.5L79 135H62Z"/>
    </g>
    ${hl ? `<g class="hl">${hl}</g>` : ''}
    ${drops}
  </svg>`;
}

/** 背影：走向清真寺的人（戴多比帽，长者拄杖、孩子牵手） */
function walker(x, s, variant) {
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

/** 在家礼拜页：暖灯、窗外的雪、冒热气的茶碗（皮亚拉）、地毯 */
export function homeInterior({ winter = true } = {}) {
  return `<svg class="interior ${winter ? 'is-winter' : ''}" viewBox="0 0 360 180" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <rect class="wall" width="360" height="180"/>
    <g class="lattice">${Array.from({ length: 10 }, (_, i) => `<g transform="translate(${18 + i * 36} 14)">${'<path d="M0 -8L2.4 -2.4L8 0L2.4 2.4L0 8L-2.4 2.4L-8 0L-2.4 -2.4Z"/>'}</g>`).join('')}</g>
    <path class="win-frame" d="M196 150V70Q196 30 246 18Q296 30 296 70V150Z"/>
    <path class="win-sky" d="M204 146V72Q204 40 246 28Q288 40 288 72V146Z"/>
    <path class="win-mtn" d="M204 120L226 104L240 112L258 98L288 116V146H204Z"/>
    <path class="win-dome" d="M232 132Q232 116 246 112Q260 116 260 132Z"/><rect class="win-dome" x="236" y="132" width="20" height="14"/>
    <path class="win-bar" d="M246 28V146M204 96H288"/>
    ${winter ? `<g class="snow">${Array.from({ length: 16 }, (_, i) => `<circle cx="${208 + ((i * 29) % 78)}" cy="20" r="${1 + (i % 3) * 0.4}" style="animation-duration:${5 + (i % 4)}s;animation-delay:-${(i * 0.9) % 6}s"/>`).join('')}</g>` : ''}
    <circle class="lamp-glow" cx="76" cy="60" r="70"/>
    <path class="lamp-chain" d="M76 0V30"/>
    <path class="lamp" d="M64 32H88L84 52Q76 60 68 52Z"/>
    <path class="lamp-top" d="M70 26H82L84 32H68Z"/>
    <rect class="floor" y="150" width="360" height="30"/>
    <path class="rug" d="M20 160H340L332 176H28Z"/>
    <path class="rug-in" d="M40 163H320L314 173H46Z"/>
    <g class="table"><rect x="110" y="140" width="80" height="6" rx="2"/><rect x="118" y="146" width="6" height="12"/><rect x="176" y="146" width="6" height="12"/></g>
    <path class="bowl" d="M128 140Q128 128 140 128H152Q164 128 164 140Z"/>
    <path class="teapot" d="M168 140Q166 124 178 122Q190 124 188 140ZM188 128Q196 126 196 120M172 122Q178 116 184 122"/>
    <g class="steam"><path d="M140 124q-4-6 0-12t0-12"/><path d="M150 124q4-6 0-12t0-12"/></g>
    <g class="non"><ellipse cx="216" cy="141" rx="14" ry="4"/><ellipse cx="216" cy="139" rx="9" ry="2.4" class="non-in"/></g>
  </svg>`;
}

/** 天房小图标 */
export function kaaba(size = 28) {
  return `<svg class="kaaba" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M4 8L12 5L20 8V19L12 22L4 19Z" class="k-body"/><path d="M4 10.5L12 7.5L20 10.5V12L12 9L4 12Z" class="k-band"/>
    <path d="M12 9V22" class="k-edge"/></svg>`;
}

/** 底部导航用的小图标 */
export const ICONS = {
  home: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20V11Q4 6 12 3Q20 6 20 11V20H14V15Q14 13 12 13Q10 13 10 15V20Z"/></svg>',
  pray: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="5" r="2.2"/><path d="M6 9Q9 8 12 9L13 15L19 15Q21 15 21 17V20H4L5 15Z"/></svg>',
  masjid: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 21V13Q7 8 12 6Q17 8 17 13V21H14V17Q14 15 12 15Q10 15 10 17V21Z"/><rect x="2.5" y="9" width="2.6" height="12"/><rect x="18.9" y="9" width="2.6" height="12"/><path d="M12 6V3M2.5 9L3.8 6L5.1 9ZM18.9 9L20.2 6L21.5 9Z" stroke-width="1.2"/></svg>',
  ramadan: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13 3a9 9 0 1 0 7.5 14A7.2 7.2 0 1 1 13 3Z"/><path d="M18 5l.8 1.7 1.8.3-1.3 1.3.3 1.8-1.6-.9-1.6.9.3-1.8L15.4 7l1.8-.3Z"/></svg>',
  qibla: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke-width="2"/><path d="M12 5L15 13L12 11.5L9 13Z"/></svg>',
  tasbih: '<svg viewBox="0 0 24 24" aria-hidden="true">' + Array.from({ length: 9 }, (_, i) => { const a = (i / 9) * Math.PI * 2 - Math.PI / 2; return `<circle cx="${(12 + 7.5 * Math.cos(a)).toFixed(1)}" cy="${(11 + 7.5 * Math.sin(a)).toFixed(1)}" r="1.7"/>`; }).join('') + '<path d="M12 18.5V23" stroke-width="1.6"/></svg>',
  settings: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 8.5A3.5 3.5 0 1 0 12 15.5A3.5 3.5 0 1 0 12 8.5ZM10.5 2H13.5L14 5L16.5 6.2L19 4.5L21 7L19 9.5L19.6 12L22 13V16L19.4 16.6L18.2 19L19.5 21.5L17 23L14.6 21L12 21.5L9.5 23L7 21.5L8 19L6.6 16.8L4 16V13L6.5 12L6.9 9.5L5 7L7 4.5L9.5 6.2L10 5Z" fill-rule="evenodd"/></svg>',
  back: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 4L7 12L15 20" fill="none" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
};

/** 灯笼（法努斯） */
function lantern(x, len, s = 1) {
  return `<g class="lantern" transform="translate(${x} 0)">
    <path class="l-string" d="M0 0V${len}"/>
    <g transform="translate(0 ${len}) scale(${s})">
      <circle class="l-glow" cx="0" cy="16" r="20"/>
      <path class="l-cap" d="M-7 4L0 -3L7 4Z"/>
      <path class="l-body" d="M-8 4H8L10 12V22L8 28H-8L-10 22V12Z"/>
      <path class="l-light" d="M-5 8H5L6.5 13V21L5 25H-5L-6.5 21V13Z"/>
      <path class="l-bar" d="M0 4V28M-10 17H10"/>
      <path class="l-cap" d="M-6 28H6L0 35Z"/>
    </g></g>`;
}

/** 斋月场景：夜空、新月、星星、灯笼、亮灯的清真寺；iftar=true 时灯光更亮 */
export function ramadanScene({ iftar = false } = {}) {
  const stars = Array.from({ length: 26 }, (_, i) => {
    const x = (i * 67) % 352 + 4;
    const y = (i * 29) % 96 + 6;
    return `<circle cx="${x}" cy="${y}" r="${i % 4 ? 0.8 : 1.4}" style="animation-delay:-${(i * 0.37) % 3}s"/>`;
  }).join('');
  return `<svg class="ramadan-scene ${iftar ? 'is-iftar' : ''}" viewBox="0 0 360 200" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
    <defs>
      <linearGradient id="rsky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0d1530"/><stop offset=".7" stop-color="#22305a"/><stop offset="1" stop-color="#3b3a5e"/></linearGradient>
      <radialGradient id="lglow"><stop offset="0" stop-color="#ffcf6b" stop-opacity=".55"/><stop offset="1" stop-color="#ffcf6b" stop-opacity="0"/></radialGradient>
    </defs>
    <rect width="360" height="200" fill="url(#rsky)"/>
    <g class="r-stars">${stars}</g>
    <path class="r-moon" d="M286 22a20 20 0 1 0 15 34a16 16 0 1 1 -15 -34z"/>
    <path class="r-mtn" d="M0 150L50 128L96 142L150 118L206 144L262 126L320 146L360 134V200H0Z"/>
    <g class="r-mosque">
      <rect x="120" y="140" width="120" height="44"/>
      <path d="M152 140Q152 110 180 104Q208 110 208 140Z"/>
      <rect x="106" y="108" width="11" height="76"/><rect x="243" y="108" width="11" height="76"/>
      <path d="M104 110L111.5 94L119 110ZM241 110L248.5 94L256 110Z"/>
      <path d="M180 104V96" class="r-finial"/>
    </g>
    <g class="r-win">${[132, 146, 206, 220].map((x) => `<path d="M${x} 176V164Q${x} 158 ${x + 4} 156Q${x + 8} 158 ${x + 8} 164V176Z"/>`).join('')}
      <path d="M170 184V160Q170 150 180 146Q190 150 190 160V184Z"/></g>
    <rect class="r-ground" y="184" width="360" height="16"/>
    <g class="walkers">${walker(60, 0.9, 'elder')}${walker(80, 0.85)}${walker(282, 0.9)}${walker(300, 0.65)}</g>
    <g class="lanterns">${lantern(34, 26)}${lantern(84, 44, 0.85)}${lantern(326, 34)}${lantern(276, 18, 0.8)}</g>
  </svg>`;
}
