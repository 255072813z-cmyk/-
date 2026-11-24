// 小净步骤（哈乃斐学派）
// 依据：《古兰经》5:6（四项主命）；哈乃斐学派教法书（如《Nur al-Idah》）中的圣行与可嘉行为。
// level：fard 主命（必须）/ sunnah 圣行 / mustahab 可嘉（做了更好）
// zone：插图上要高亮的身体部位
// 文字在语言文件 wudu.<id>.title / .how / .note / .fard 里。
export const WUDU_STEPS = [
  { id: 'niyyah', zone: 'none', level: 'sunnah', items: [{ k: 'basmala' }] },
  { id: 'hands', zone: 'hands', level: 'sunnah', count: 3 },
  { id: 'mouth', zone: 'mouth', level: 'sunnah', count: 3, note: true },
  { id: 'nose', zone: 'nose', level: 'sunnah', count: 3, note: true },
  { id: 'face', zone: 'face', level: 'fard', count: 3, fard: true },
  { id: 'arms', zone: 'arms', level: 'fard', count: 3, fard: true },
  { id: 'head', zone: 'head', level: 'fard', count: 1, fard: true },
  { id: 'ears', zone: 'ears', level: 'sunnah', count: 1 },
  { id: 'neck', zone: 'neck', level: 'mustahab', count: 1 },
  { id: 'feet', zone: 'feet', level: 'fard', count: 3, fard: true },
  { id: 'dua', zone: 'done', level: 'sunnah', items: [{ k: 'wuduDua' }] },
];

// 冬天的方便、坏小净的事：条数（文字在 wudu.winter.1… / wudu.breaker.1…）
export const WUDU_WINTER_COUNT = 3;
export const WUDU_BREAKER_COUNT = 6;
