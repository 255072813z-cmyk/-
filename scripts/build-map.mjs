// 生成朝向页用的区域地图（中亚—阿拉伯半岛），输出为 SVG 路径常量。
// 数据：Natural Earth 1:110m（world-atlas 包，公有领域）。只在开发时运行：npm run map
import { readFileSync, writeFileSync } from 'node:fs';
import { feature } from 'topojson-client';

const topo = JSON.parse(readFileSync(new URL('../node_modules/world-atlas/countries-110m.json', import.meta.url)));
const countries = feature(topo, topo.objects.countries).features;

// 等距圆柱投影，按中心纬度压缩经度，避免东西方向被拉宽
export const VIEW = { lonMin: 30, lonMax: 80, latMin: 12, latMax: 47, lat0: 30, k: 10 };
const kx = VIEW.k * Math.cos((VIEW.lat0 * Math.PI) / 180);
const W = Math.round((VIEW.lonMax - VIEW.lonMin) * kx);
const H = Math.round((VIEW.latMax - VIEW.latMin) * VIEW.k);
const px = (lon) => ((lon - VIEW.lonMin) * kx).toFixed(1);
const py = (lat) => ((VIEW.latMax - lat) * VIEW.k).toFixed(1);

// 把多边形裁剪到视野矩形内（Sutherland–Hodgman），只留下看得见的部分，文件更小
const BOX = { x0: -4, y0: -4, x1: W + 4, y1: H + 4 };
function clip(points) {
  const edges = [
    [(p) => p[0] >= BOX.x0, (a, b) => cut(a, b, 0, BOX.x0)],
    [(p) => p[0] <= BOX.x1, (a, b) => cut(a, b, 0, BOX.x1)],
    [(p) => p[1] >= BOX.y0, (a, b) => cut(a, b, 1, BOX.y0)],
    [(p) => p[1] <= BOX.y1, (a, b) => cut(a, b, 1, BOX.y1)],
  ];
  let out = points;
  for (const [inside, inter] of edges) {
    const input = out; out = [];
    for (let i = 0; i < input.length; i++) {
      const cur = input[i], prev = input[(i + input.length - 1) % input.length];
      if (inside(cur)) { if (!inside(prev)) out.push(inter(prev, cur)); out.push(cur); }
      else if (inside(prev)) out.push(inter(prev, cur));
    }
    if (!out.length) break;
  }
  return out;
}
function cut(a, b, axis, v) {
  const t = (v - a[axis]) / (b[axis] - a[axis]);
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}
function pathOf(geom) {
  const polys = geom.type === 'Polygon' ? [geom.coordinates] : geom.coordinates;
  let d = '';
  for (const poly of polys) for (const ring of poly) {
    const pts = clip(ring.map(([lon, lat]) => [+px(lon), +py(lat)]));
    const r = [];
    for (const [x, y] of pts) {
      const q = [Math.round(x), Math.round(y)];
      const last = r[r.length - 1];
      if (!last || last[0] !== q[0] || last[1] !== q[1]) r.push(q);
    }
    if (r.length < 3) continue;
    d += r.map(([x, y], i) => `${i ? 'L' : 'M'}${x} ${y}`).join('') + 'Z';
  }
  return d;
}
// ISO 3166 数字代码：762 塔吉克斯坦，682 沙特阿拉伯
let land = '', tj = '', sa = '';
for (const f of countries) {
  const d = pathOf(f.geometry);
  if (!d) continue;
  if (f.id === '762') tj = d; else if (f.id === '682') sa = d; else land += d;
}
const out = `// 自动生成：npm run map（scripts/build-map.mjs）。请勿手改。
// 底图数据：Natural Earth 1:110m，经 world-atlas 2.0.2（公有领域）。
export const MAP = ${JSON.stringify({ ...VIEW, kx: +kx.toFixed(4), width: W, height: H })};
export const LAND = ${JSON.stringify(land)};
export const TAJIKISTAN = ${JSON.stringify(tj)};
export const SAUDI = ${JSON.stringify(sa)};
`;
writeFileSync(new URL('../src/content/region-map.js', import.meta.url), out);
console.log(`region-map.js: ${W}x${H}, ${(out.length / 1024).toFixed(1)} KB`);
