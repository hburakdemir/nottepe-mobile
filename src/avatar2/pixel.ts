// ─── Avatar 2.0 piksel çizimi ─────────────────────────────────────────────────
// core.ts ile birlikte web ve mobilde BİREBİR aynı taşınır (asıl kopya web'de).
//
// Tuval (canvas) kullanmaz: SVG yolları çokgene çevrilir, her pikselin merkezi
// test edilir. Bu yüzden React Native'de ve sunucuda da aynı sonucu verir.
// Büyük şekiller (yüz, saç, kıyafet) ızgaraya dökülür; göz, kaş, burun ve ağız
// bu boyutta eğriden okunaklı çıkmadığı için core.ts'teki elle çizilmiş piksel
// kalıplarıyla basılır.

import { art, mix, shade, tint, BROWS, EYES, LID, MOUTHS, MOUTH_IN, NOSES, PUPIL, TEETH, TONGUE, WHITE_EYE, type AvatarV2, type Group } from './core';

export const N = 48;

// ═══ SVG yolu → çokgenler ═══ (yalnızca core.ts'in kullandığı mutlak komutlar: M L H V C Q A Z)
type Pt = [number, number];
interface Sub { pts: Pt[]; closed: boolean }
const cache = new Map<string, Sub[]>();
function flatten(d: string): Sub[] {
  const hit = cache.get(d); if (hit) return hit;
  const toks = d.match(/[MLHVCQAZ]|-?\d*\.?\d+(?:e-?\d+)?/gi) || [];
  const subs: Sub[] = []; let cur: Sub | null = null; let x = 0, y = 0, sx = 0, sy = 0, i = 0, cmd = '';
  const num = () => parseFloat(toks[i++]);
  const push = (p: Pt) => { if (!cur) { cur = { pts: [[x, y]], closed: false }; subs.push(cur); } cur.pts.push(p); };
  while (i < toks.length) {
    if (/^[A-Za-z]$/.test(toks[i])) cmd = toks[i++];
    switch (cmd) {
      case 'M': x = num(); y = num(); sx = x; sy = y; cur = { pts: [[x, y]], closed: false }; subs.push(cur); cmd = 'L'; break;
      case 'L': x = num(); y = num(); push([x, y]); break;
      case 'H': x = num(); push([x, y]); break;
      case 'V': y = num(); push([x, y]); break;
      case 'C': { const x1 = num(), y1 = num(), x2 = num(), y2 = num(), x3 = num(), y3 = num();
        for (let k = 1; k <= 12; k++) { const t = k / 12, u = 1 - t; push([u * u * u * x + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x3, u * u * u * y + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y3]); }
        x = x3; y = y3; break; }
      case 'Q': { const x1 = num(), y1 = num(), x2 = num(), y2 = num();
        for (let k = 1; k <= 8; k++) { const t = k / 8, u = 1 - t; push([u * u * x + 2 * u * t * x1 + t * t * x2, u * u * y + 2 * u * t * y1 + t * t * y2]); }
        x = x2; y = y2; break; }
      case 'A': { const rx0 = num(), ry0 = num(); num(); const fa = num(), fs = num(), x2 = num(), y2 = num();
        arc(x, y, rx0, ry0, fa, fs, x2, y2, push); x = x2; y = y2; break; }
      case 'Z': case 'z': if (cur) { (cur as Sub).closed = true; } x = sx; y = sy; cur = null; i += 0; cmd = ''; break;
      default: i++;
    }
  }
  cache.set(d, subs);
  return subs;
}
// Uç noktalı SVG yayını merkezli biçime çevirip parçalar (döndürmesiz; core.ts döndürme kullanmıyor).
function arc(x1: number, y1: number, rx: number, ry: number, fa: number, fs: number, x2: number, y2: number, push: (p: Pt) => void) {
  const dx = (x1 - x2) / 2, dy = (y1 - y2) / 2;
  let lam = (dx * dx) / (rx * rx) + (dy * dy) / (ry * ry);
  if (lam > 1) { lam = Math.sqrt(lam); rx *= lam; ry *= lam; }
  const num = rx * rx * ry * ry - rx * rx * dy * dy - ry * ry * dx * dx, den = rx * rx * dy * dy + ry * ry * dx * dx;
  const co = (fa === fs ? -1 : 1) * Math.sqrt(Math.max(0, num / den));
  const cxp = co * (rx * dy) / ry, cyp = co * -(ry * dx) / rx;
  const cx = cxp + (x1 + x2) / 2, cy = cyp + (y1 + y2) / 2;
  const ang = (ux: number, uy: number, vx: number, vy: number) => Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
  const t1 = ang(1, 0, (dx - cxp) / rx, (dy - cyp) / ry);
  let dt = ang((dx - cxp) / rx, (dy - cyp) / ry, (-dx - cxp) / rx, (-dy - cyp) / ry);
  if (!fs && dt > 0) dt -= 2 * Math.PI; else if (fs && dt < 0) dt += 2 * Math.PI;
  const steps = Math.max(8, Math.ceil(Math.abs(dt) / (Math.PI / 12)));
  for (let k = 1; k <= steps; k++) { const t = t1 + (dt * k) / steps; push([cx + rx * Math.cos(t), cy + ry * Math.sin(t)]); }
}
// Sarmal sayısı (nonzero) ile içerde mi: dolgu ve kırpma için. Açık alt yollar dolguda kapalı sayılır.
function inside(subs: Sub[], px: number, py: number) {
  let wn = 0;
  for (const s of subs) {
    const p = s.pts, n = p.length;
    for (let k = 0; k < n; k++) {
      const a = p[k], b = p[(k + 1) % n];
      if (a[1] <= py) { if (b[1] > py && (b[0] - a[0]) * (py - a[1]) - (px - a[0]) * (b[1] - a[1]) > 0) wn++; }
      else if (b[1] <= py && (b[0] - a[0]) * (py - a[1]) - (px - a[0]) * (b[1] - a[1]) < 0) wn--;
    }
  }
  return wn !== 0;
}
// Çizgiye uzaklık ≤ w/2 mi: yuvarlak uç ve birleşimlerle aynı sonuç.
function onStroke(subs: Sub[], px: number, py: number, half: number) {
  const h2 = half * half;
  for (const s of subs) {
    const p = s.pts, n = p.length, segs = s.closed ? n : n - 1;
    for (let k = 0; k < segs; k++) {
      const a = p[k], b = p[(k + 1) % n], vx = b[0] - a[0], vy = b[1] - a[1];
      const len = vx * vx + vy * vy; let t = len ? ((px - a[0]) * vx + (py - a[1]) * vy) / len : 0;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const ex = a[0] + t * vx - px, ey = a[1] + t * vy - py;
      if (ex * ex + ey * ey <= h2) return true;
    }
  }
  return false;
}
function bbox(subs: Sub[], pad: number) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const s of subs) for (const [x, y] of s.pts) { if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y; }
  return [x0 - pad, y0 - pad, x1 + pad, y1 + pad];
}

function stamp(rows: string[], x0: number, y0: number, map: Record<string, string>, col: string[], grp: Group[], mirror: boolean) {
  rows.forEach((r, dy) => r.split('').forEach((ch, dx) => {
    const color = map[ch]; if (!color) return;
    const x = mirror ? N - 1 - (x0 + dx) : x0 + dx, y = y0 + dy;
    if (x < 0 || y < 0 || x >= N || y >= N) return;
    col[y * N + x] = color; grp[y * N + x] = 'feat';
  }));
}

// 48×48 renk ızgarası (satır satır, hex).
export function pixelGrid(input: Partial<AvatarV2> | null | undefined): string[] {
  const { layers, ctx: c, browColor, cfg } = art(input);
  const col: string[] = new Array(N * N).fill(cfg.bg), grp: Group[] = new Array(N * N).fill('bg');
  const U = 100 / N;
  for (const l of layers) {
    if ('marker' in l) {
      if (l.marker === 'eyes') {
        const e = EYES.find((x) => x.id === cfg.eyes)!.px;
        const map = { k: LID, w: WHITE_EYE, i: c.ec, p: PUPIL, h: tint(c.ec, 0.55), s: c.ds, l: LID };
        stamp(e.L, 18, e.y0, map, col, grp, false); stamp(e.R || e.L, 18, e.y0, map, col, grp, true);
      } else if (l.marker === 'brows') {
        const b = BROWS.find((x) => x.id === cfg.brows)!;
        stamp(b.px, 18, b.y0 ?? 19, { b: browColor }, col, grp, false); stamp(b.px, 18, b.y0 ?? 19, { b: browColor }, col, grp, true);
      } else if (l.marker === 'nose') {
        const n = NOSES.find((x) => x.id === cfg.nose)!.px; stamp(n.rows, 22, n.y0, { s: c.dds }, col, grp, false);
      } else {
        stamp(MOUTHS.find((x) => x.id === cfg.mouth)!.px, 21, 29, { l: c.lc, d: MOUTH_IN, t: TEETH, L: shade(c.lc, 0.18), r: TONGUE, s: c.dds }, col, grp, false);
      }
      continue;
    }
    if ('sprite' in l) {
      const sp = l.sprite; stamp(sp.rows, sp.x0, sp.y0, sp.colors, col, grp, false);
      if (sp.mirror) stamp(sp.rows, sp.x0, sp.y0, sp.colors, col, grp, true);
      continue;
    }
    if (l.vo) continue;
    const subs = flatten(l.d), clip = l.clip ? flatten(l.clip) : null;
    const half = l.fill ? 0 : (l.pw || Math.max(l.w || 0, 2.2)) / 2;
    const [bx0, by0, bx1, by1] = bbox(subs, half);
    const xa = Math.max(0, Math.floor(bx0 / U)), xb = Math.min(N - 1, Math.ceil(bx1 / U)), ya = Math.max(0, Math.floor(by0 / U)), yb = Math.min(N - 1, Math.ceil(by1 / U));
    const paint = (l.fill || l.stroke)!, op = l.op ?? 1;
    for (let y = ya; y <= yb; y++) for (let x = xa; x <= xb; x++) {
      const px = (x + 0.5) * U, py = (y + 0.5) * U;
      if (l.fill ? !inside(subs, px, py) : !onStroke(subs, px, py, half)) continue;
      if (clip && !inside(clip, px, py)) continue;
      const i = y * N + x;
      col[i] = op < 1 ? mix(col[i], paint, op) : paint;
      if (l.g !== 'shade') grp[i] = l.g;
    }
  }
  // Kontur: zemine değen piksel koyulaşır; saç/şapka/kıyafetin tene değen kenarı hafif koyulaşır.
  const out = col.slice();
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const i = y * N + x, g0 = grp[i]; if (g0 === 'bg') continue;
    let toBg = false, toSkin = false;
    for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {
      if (nx < 0 || ny < 0 || nx >= N || ny >= N) continue;
      const gg = grp[ny * N + nx];
      if (gg === 'bg') toBg = true;
      else if (gg === 'skin' && (g0 === 'hair' || g0 === 'hat' || g0 === 'outfit')) toSkin = true;
    }
    if (toBg) out[i] = mix(col[i], '#140d0a', 0.5);
    else if (toSkin) out[i] = mix(col[i], '#140d0a', 0.2);
  }
  return out;
}

// Renk başına tek yol (viewBox 0 0 48 48, shape-rendering crispEdges ile basılır).
export function pixelPaths(input: Partial<AvatarV2> | null | undefined): { fill: string; d: string }[] {
  const grid = pixelGrid(input); const byColor = new Map<string, string[]>();
  for (let y = 0; y < N; y++) {
    let x = 0;
    while (x < N) {
      const cc = grid[y * N + x]; let e = x + 1;
      while (e < N && grid[y * N + e] === cc) e++;
      let arr = byColor.get(cc); if (!arr) { arr = []; byColor.set(cc, arr); }
      arr.push(`M${x} ${y}h${e - x}v1h${x - e}z`);
      x = e;
    }
  }
  return [...byColor].map(([fill, ds]) => ({ fill, d: ds.join('') }));
}
