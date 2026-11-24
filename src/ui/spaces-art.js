// 三个空间的插图（SVG）。人物只用剪影、背影，不画五官。

/** 坐着的背影（戴多比帽），用在垫子上 */
function seatedBack(cx, baseY, s, cls = '') {
  return `<g class="sb ${cls}" transform="translate(${cx} ${baseY}) scale(${s})">
    <path d="M-15 0Q-16 -14 -9 -20Q-6 -22 0 -22Q6 -22 9 -20Q16 -14 15 0Z"/>
    <path d="M-4 -22h8v-4h-8z"/>
    <circle cx="0" cy="-31" r="6.6"/>
    <path class="cap" d="M-6.8 -33.5L-6 -38.6Q0 -40.6 6 -38.6L6.8 -33.5Q0 -35 -6.8 -33.5Z"/>
  </g>`;
}

/** 大殿的垫子布局：4 排，每排 10 张，前排（靠近米哈拉布）小、后排大，营造纵深 */
export const MAT_ROWS = [
  { y: 250, w: 40, h: 24 },
  { y: 288, w: 48, h: 30 },
  { y: 333, w: 58, h: 37 },
  { y: 385, w: 70, h: 44 },
];
export const MATS_PER_ROW = 10;

export function matPos(i) {
  const r = Math.floor(i / MATS_PER_ROW);
  const c = i % MATS_PER_ROW;
  const row = MAT_ROWS[r];
  const step = row.w * 1.3;
  const x0 = 540 - (step * (MATS_PER_ROW - 1)) / 2;
  return { r, c, x: x0 + c * step, y: row.y, w: row.w, h: row.h };
}

function mat(i, state) {
  const p = matPos(i);
  const { x, y, w, h } = p;
  const label = `第 ${p.r + 1} 排第 ${p.c + 1} 张垫子，${state === 'mine' ? '你坐在这里' : state === 'taken' ? '有人' : '空着'}`;
  const tone = (p.r + p.c) % 2 ? 'mt-a' : 'mt-b';
  const person = state === 'taken' || state === 'mine' ? seatedBack(x, y + h * 0.45, h / 40, state === 'mine' ? 'me' : '') : '';
  return `<g class="mat ${tone} is-${state}" data-mat="${i}" role="button" tabindex="${state === 'free' ? 0 : -1}" aria-label="${label}">
    <rect x="${x - w / 2}" y="${y - h / 2}" width="${w}" height="${h}" rx="${w * 0.08}"/>
    <path class="mt-arch" d="M${x - w * 0.3} ${y + h * 0.36}V${y - h * 0.12}Q${x - w * 0.3} ${y - h * 0.36} ${x} ${y - h * 0.42}Q${x + w * 0.3} ${y - h * 0.36} ${x + w * 0.3} ${y - h * 0.12}V${y + h * 0.36}Z"/>
    ${person}
  </g>`;
}

/**
 * 礼拜大殿全景：从大殿后部看向米哈拉布。
 * taken：有人的垫子编号；mine：你的垫子；phase：天色（窗外）
 */
export function hallPanorama({ capacity = 40, taken = [], mine = null, phase = 'day' } = {}) {
  const takenSet = new Set(taken);
  const arches = [];
  for (let i = 0; i < 7; i++) {
    const x = 50 + i * 140;
    if (i === 3) continue; // 中间是米哈拉布
    arches.push(`<g class="arch"><path class="arch-win" d="M${x + 30} 200V110Q${x + 30} 70 ${x + 70} 56Q${x + 110} 70 ${x + 110} 110V200Z"/>
      <path class="arch-bar" d="M${x + 70} 56V200M${x + 30} 130H${x + 110}"/></g>`);
  }
  const columns = Array.from({ length: 8 }, (_, i) => `<rect class="col" x="${44 + i * 140}" y="40" width="12" height="190"/>`).join('');
  const lamps = [190, 380, 700, 890]
    .map(
      (x) => `<g class="chandelier"><path d="M${x} 0V46" class="ch-line"/><circle cx="${x}" cy="60" r="44" class="ch-glow"/>
      <ellipse cx="${x}" cy="58" rx="28" ry="6" class="ch-ring"/>${[-20, -10, 0, 10, 20].map((d) => `<circle cx="${x + d}" cy="${58 + (Math.abs(d) < 15 ? 4 : 2)}" r="2.4" class="ch-light"/>`).join('')}</g>`,
    )
    .join('');
  const mats = Array.from({ length: capacity }, (_, i) => mat(i, i === mine ? 'mine' : takenSet.has(i) ? 'taken' : 'free')).join('');
  return `<svg class="hall phase-${phase}" viewBox="0 0 1080 420" role="group" aria-label="礼拜大殿">
    <rect class="h-wall" width="1080" height="240"/>
    <rect class="h-ceil" width="1080" height="40"/>
    <g class="h-ceil-star">${Array.from({ length: 27 }, (_, i) => `<path d="M${20 + i * 40} 20l6-6 6 6-6 6z"/>`).join('')}</g>
    ${arches.join('')}${columns}
    <g class="mihrab-big">
      <path class="mb-frame" d="M470 232V112Q470 60 540 36Q610 60 610 112V232Z"/>
      <path class="mb-tile" d="M482 232V116Q482 72 540 50Q598 72 598 116V232Z"/>
      <path class="mb-niche" d="M500 232V126Q500 92 540 76Q580 92 580 126V232Z"/>
      <text x="540" y="66" class="mb-text" lang="ar">اللَّه</text>
    </g>
    <g class="minbar"><path d="M626 232V150L640 150L640 168L652 168L652 186L664 186L664 204L676 204V232Z"/><path d="M626 150V120Q633 110 640 120V150" class="mn-top"/></g>
    <rect class="h-dado" y="214" width="1080" height="20"/>
    <g class="h-dado-star">${Array.from({ length: 36 }, (_, i) => `<path d="M${15 + i * 30} 224l5-5 5 5-5 5z"/>`).join('')}</g>
    ${lamps}
    <path class="h-floor" d="M0 234H1080V420H0Z"/>
    <g class="decor-people">
      <g transform="translate(70 270) scale(1.1)"><path d="M-16 40Q-17 18 -8 10Q0 6 8 10Q16 18 15 40Z"/><circle cx="0" cy="0" r="7"/>
        <path class="cap" d="M-7 -2.5L-6.2 -7.6Q0 -9.6 6.2 -7.6L7 -2.5Q0 -4 -7 -2.5Z"/><path class="rahle" d="M12 34L30 22M14 22L30 34"/><path class="book" d="M14 21L22 17L30 21L22 24Z"/></g>
      <g transform="translate(1000 262) scale(1.15)"><path d="M-12 56L-14 14Q-8 6 0 6Q8 6 14 14L12 56Z"/><circle cx="0" cy="-2" r="7"/>
        <path class="cap" d="M-7 -4.5L-6.2 -9.6Q0 -11.6 6.2 -9.6L7 -4.5Q0 -6 -7 -4.5Z"/><path d="M-14 16L-20 2L-16 0L-10 12ZM14 16L20 2L16 0L10 12Z"/></g>
    </g>
    <g class="mats">${mats}</g>
  </svg>`;
}

/** 庭院：葡萄架、塔普昌（铺苏扎尼的木榻）、茶、馕、小水池 */
export function courtyardScene({ phase = 'day', tea = 0, bread = false } = {}) {
  const leaves = Array.from({ length: 22 }, (_, i) => {
    const x = 8 + i * 16.5;
    const y = 30 + ((i * 7) % 4) * 4;
    return `<path d="M${x} ${y}q6-8 12 0q-6 8-12 0z" class="leaf"/>`;
  }).join('');
  const grapes = [60, 150, 250, 320]
    .map((x) => `<g class="grapes">${[0, 1, 2, 3, 4, 5].map((k) => `<circle cx="${x + (k % 3) * 4 - 4 + (k > 2 ? 2 : 0)}" cy="${44 + Math.floor(k / 3) * 4 + (k > 4 ? 4 : 0)}" r="2.2"/>`).join('')}</g>`)
    .join('');
  const suzani = [150, 190, 230, 270]
    .map((x) => `<circle cx="${x}" cy="156" r="9" class="sz-o"/><circle cx="${x}" cy="156" r="4.5" class="sz-i"/>`)
    .join('');
  const fill = Math.max(0, Math.min(1, tea));
  return `<svg class="courtyard phase-${phase}" viewBox="0 0 360 220" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
    <rect class="c-sky" width="360" height="220"/>
    <path class="c-dome" d="M250 92Q250 66 276 60Q302 66 302 92Z"/><rect class="c-minaret" x="310" y="50" width="9" height="50"/>
    <path class="c-wall" d="M0 92H360V170H0Z"/>
    <g class="c-wall-tiles">${Array.from({ length: 12 }, (_, i) => `<path d="M${15 + i * 30} 100l5-5 5 5-5 5z"/>`).join('')}</g>
    <path class="c-tree" d="M38 170V112M38 128L24 112M38 120L52 104"/><circle cx="30" cy="100" r="20" class="c-crown"/><circle cx="52" cy="94" r="18" class="c-crown"/>
    <path class="c-beam" d="M0 26H360M0 36H360"/>
    <g class="c-posts"><rect x="118" y="26" width="6" height="150"/><rect x="314" y="26" width="6" height="150"/></g>
    ${leaves}${grapes}
    <rect class="c-ground" y="170" width="360" height="50"/>
    <ellipse class="pool" cx="70" cy="188" rx="46" ry="10"/><ellipse class="pool-in" cx="70" cy="187" rx="38" ry="7"/>
    <g class="fountain"><path d="M70 186V170"/><path d="M70 170q-10 -6 -16 10M70 170q10 -6 16 10"/></g>
    <g class="tapchan"><rect x="130" y="150" width="170" height="14" class="tp-top"/><rect x="134" y="164" width="8" height="26"/><rect x="288" y="164" width="8" height="26"/>
      <rect x="132" y="146" width="166" height="20" class="suzani" rx="2"/>${suzani}</g>
    <g class="khontakhta"><rect x="190" y="136" width="70" height="6" rx="1"/><rect x="194" y="142" width="5" height="6"/><rect x="251" y="142" width="5" height="6"/></g>
    <path class="choynak" d="M202 136Q200 122 210 120Q220 122 218 136ZM218 126Q226 124 226 118M206 120Q210 115 214 120"/>
    <g class="piyola"><path d="M230 136Q229 128 236 128H242Q249 128 248 136Z" class="pi-cup"/>
      <rect x="231" y="${136 - 6 * fill}" width="16" height="${6 * fill}" class="pi-tea" clip-path="url(#cupclip)"/></g>
    <clipPath id="cupclip"><path d="M230 136Q229 128 236 128H242Q249 128 248 136Z"/></clipPath>
    ${fill > 0 ? '<g class="c-steam"><path d="M236 124q-3-5 0-10t0-10"/><path d="M242 124q3-5 0-10t0-10"/></g>' : ''}
    <g class="non"><circle cx="262" cy="133" r="9"/><circle cx="262" cy="133" r="4.6" class="non-c"/>${[0, 60, 120, 180, 240, 300].map((a) => `<circle cx="${(262 + 6.8 * Math.cos((a * Math.PI) / 180)).toFixed(1)}" cy="${(133 + 6.8 * Math.sin((a * Math.PI) / 180)).toFixed(1)}" r="0.8" class="non-dot"/>`).join('')}</g>
    ${bread ? '<g class="non-piece"><path d="M276 140l9-2 2 6-8 2z"/></g><g class="non-steam"><path d="M262 122q-3-5 0-10t0-10"/></g>' : ''}
    <g class="people">
      ${seatedBack(158, 150, 0.9)}${seatedBack(288, 150, 0.95)}
      <g transform="translate(112 196) scale(0.62)"><path d="M-10 0L-11 -26Q-6 -32 0 -32Q6 -32 11 -26L10 0Z"/><circle cx="0" cy="-38" r="6.5"/><path class="cap" d="M-6.5 -40.5L-5.8 -45.6Q0 -47.6 5.8 -45.6L6.5 -40.5Q0 -42 -6.5 -40.5Z"/></g>
    </g>
  </svg>`;
}

/** 诗歌夜：灯笼、星空，乐师弹长颈琴（坦布尔），听众围坐 */
export function poetryScene({ open = true, playing = false } = {}) {
  const stars = Array.from({ length: 20 }, (_, i) => `<circle cx="${(i * 59) % 350 + 5}" cy="${(i * 23) % 70 + 6}" r="${i % 3 ? 0.8 : 1.3}"/>`).join('');
  const listener = (x, s) => `<g transform="translate(${x} 196) scale(${s})"><path d="M-15 0Q-16 -14 -9 -20Q0 -24 9 -20Q16 -14 15 0Z"/><path d="M-4 -22h8v-4h-8z"/><circle cx="0" cy="-31" r="6.6"/><path class="cap" d="M-6.8 -33.5L-6 -38.6Q0 -40.6 6 -38.6L6.8 -33.5Q0 -35 -6.8 -33.5Z"/></g>`;
  return `<svg class="poetry ${open ? 'is-open' : 'is-closed'} ${playing ? 'is-playing' : ''}" viewBox="0 0 360 220" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
    <defs><radialGradient id="pglow"><stop offset="0" stop-color="#ffcf6b" stop-opacity=".6"/><stop offset="1" stop-color="#ffcf6b" stop-opacity="0"/></radialGradient></defs>
    <rect class="p-sky" width="360" height="220"/>
    <g class="p-stars">${stars}</g>
    <path class="p-moon" d="M300 26a14 14 0 1 0 10 24a11 11 0 1 1-10-24z"/>
    <path class="p-wall" d="M0 96H360V180H0Z"/>
    <g class="p-arches">${[20, 110, 250].map((x) => `<path d="M${x} 180V130Q${x} 108 ${x + 30} 100Q${x + 60} 108 ${x + 60} 130V180Z"/>`).join('')}</g>
    <text x="280" y="122" class="p-callig" lang="fa">بشنو این نی</text>
    ${open ? '<circle cx="180" cy="150" r="70" fill="url(#pglow)" class="p-glow"/>' : ''}
    <g class="p-lantern"><path d="M180 96V110" class="pl-s"/><path d="M172 114L180 108L188 114ZM171 114H189L191 122V130L189 136H171L169 130V122Z" class="pl-b"/><path d="M174 117H186L187 122V129L186 133H174L173 129V122Z" class="pl-l"/></g>
    <rect class="p-floor" y="180" width="360" height="40"/>
    <path class="p-rug" d="M60 184H300L292 206H68Z"/>
    ${
      open
        ? `<g class="musician" transform="translate(180 192)">
        <path d="M-16 0Q-18 -16 -10 -24Q0 -28 8 -24Q16 -16 16 0Z"/><path d="M-4 -26h8v-4h-8z"/><circle cx="0" cy="-36" r="7"/>
        <path class="cap" d="M-7.2 -38.6L-6.4 -43.8Q0 -45.8 6.4 -43.8L7.2 -38.6Q0 -40.2 -7.2 -38.6Z"/>
        <g class="tanbur"><ellipse cx="14" cy="-8" rx="9" ry="6" transform="rotate(-28 14 -8)"/><path d="M18 -12L48 -58" class="neck"/><path d="M46 -56L52 -62" class="peg"/></g>
      </g>
      <g class="listeners">${listener(92, 0.85)}${listener(124, 0.78)}${listener(240, 0.8)}${listener(272, 0.88)}</g>`
        : '<path class="p-door" d="M150 180V140Q150 122 180 114Q210 122 210 140V180Z"/>'
    }
  </svg>`;
}

/** 清真寺大门：三道门（庭院、大殿、诗歌夜） */
export function gateScene({ phase = 'day' } = {}) {
  return `<svg class="gate phase-${phase}" viewBox="0 0 360 200" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
    <rect class="g-sky" width="360" height="200"/>
    <path class="g-dome" d="M140 70Q140 34 180 26Q220 34 220 70Z"/><path class="g-finial" d="M180 26V16"/>
    <rect class="g-min" x="40" y="40" width="16" height="150"/><rect class="g-min" x="304" y="40" width="16" height="150"/>
    <path class="g-mincap" d="M38 42L48 22L58 42ZM302 42L312 22L322 42Z"/>
    <rect class="g-wall" x="56" y="70" width="248" height="120"/>
    <path class="g-portal" d="M120 190V62H240V190Z"/>
    <g class="g-tiles">${Array.from({ length: 8 }, (_, i) => `<path d="M${128 + i * 14} 70l5-5 5 5-5 5z"/>`).join('')}</g>
    <path class="g-door main" d="M146 190V112Q146 86 180 78Q214 86 214 112V190Z"/>
    <path class="g-door side" d="M72 190V138Q72 124 90 118Q108 124 108 138V190Z"/>
    <path class="g-door side" d="M252 190V138Q252 124 270 118Q288 124 288 138V190Z"/>
    <rect class="g-ground" y="190" width="360" height="10"/>
  </svg>`;
}
