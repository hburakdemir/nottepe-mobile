// ─── Avatar 2.0 çekirdeği ─────────────────────────────────────────────────────
// Web (client/src/avatar2) ve mobil (src/avatar2) bu dosyayı BİREBİR aynı taşır.
// Asıl kopya web'de; mobilde değiştirme, web'de değiştirip kopyala.
//
// Karakter bir kez tarif edilir (AvatarV2). `art()` tarifi, 0-100 koordinatlı
// katman listesine çevirir. Normal çizim bu katmanları vektör yol olarak basar
// (vectorPaths); piksel çizim aynı katmanları 48×48 ızgaraya döker, yüz
// detaylarını elle çizilmiş piksel kalıplarıyla basar (pixel.ts).
//
// Kayıt dizinle değil adla yapılır: `hair: "uzun"`, renkler hex. Seçenek
// eklemek, silmek ya da sırasını değiştirmek kayıtlı avatarları bozmaz. Bir
// seçeneğin `id`'sini değiştirmek bozar; onu yapma.

export type Sex = 'k' | 'e';
export type Group = 'bg' | 'skin' | 'hair' | 'outfit' | 'hat' | 'acc' | 'feat' | 'shade';
// Avatarın sahibinin seçtiği görünüm; herkes avatarı bu görünümde görür.
export type Style = 'normal' | 'piksel';

export interface AvatarV2 {
  v: 2;
  style: Style;
  body: string; build: string; face: string; skin: string; bg: string;
  hair: string; hairColor: string; eyes: string; eyeColor: string; brows: string;
  nose: string; mouth: string; lip: string; beard: string; beardColor: string;
  makeup: string; makeupColor: string; outfit: string; outfitColor: string; accent: string;
  hat: string; hatColor: string; acc: string; accColor: string;
}

export interface Paint { d: string; fill?: string; stroke?: string; w?: number; pw?: number; op?: number; clip?: string; g?: Group; vo?: boolean }
export interface SpriteObj { rows: string[]; x0: number; y0: number; mirror?: boolean; colors: Record<string, string> }
export type Marker = 'eyes' | 'brows' | 'nose' | 'mouth';
export type Item = Paint | { sprite: SpriteObj; g?: Group };
export type Layer = (Paint & { g: Group }) | { sprite: SpriteObj; g: Group } | { marker: Marker; g: Group };

export interface Geom { S: number; n: number; sy: number; fem: boolean; L: number; R: number; nl: number; nr: number; body: string; neck: string }
export interface Ctx {
  skin: string; ds: string; dds: string; hc: string; hs: string; hl: string; bc: string; bs: string; ec: string; lc: string;
  oc: string; od: string; ac: string; tc: string; td: string; xc: string; mc: string; cw: number; g: Geom;
}

// ═══ Renk ve yol yardımcıları ═══
const hexToRgb = (h: string): number[] => {
  let s = h.replace('#', '');
  if (s.length === 3) s = s.split('').map((c) => c + c).join('');
  const n = parseInt(s, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const rgbToHex = (a: number[]) => '#' + a.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
export const mix = (a: string, b: string, t: number) => { const A = hexToRgb(a), B = hexToRgb(b); return rgbToHex(A.map((v, i) => v + (B[i] - v) * t)); };
export const shade = (c: string, t: number) => mix(c, '#000000', t);
export const tint = (c: string, t: number) => mix(c, '#ffffff', t);
const warmShade = (c: string, t: number) => mix(c, '#5a2414', t);
const f = (v: number) => Math.round(v * 100) / 100;
const ell = (cx: number, cy: number, rx: number, ry = rx) => `M${f(cx - rx)} ${f(cy)}A${f(rx)} ${f(ry)} 0 1 0 ${f(cx + rx)} ${f(cy)}A${f(rx)} ${f(ry)} 0 1 0 ${f(cx - rx)} ${f(cy)}Z`;
const rr = (x: number, y: number, w: number, h: number, r: number) => `M${f(x + r)} ${f(y)}H${f(x + w - r)}Q${f(x + w)} ${f(y)} ${f(x + w)} ${f(y + r)}V${f(y + h - r)}Q${f(x + w)} ${f(y + h)} ${f(x + w - r)} ${f(y + h)}H${f(x + r)}Q${f(x)} ${f(y + h)} ${f(x)} ${f(y + h - r)}V${f(y + r)}Q${f(x)} ${f(y)} ${f(x + r)} ${f(y)}Z`;
function smoothClosed(pts: number[][]) {
  const n = pts.length; let d = `M${f(pts[0][0])} ${f(pts[0][1])}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
    d += `C${f(p1[0] + (p2[0] - p0[0]) / 6)} ${f(p1[1] + (p2[1] - p0[1]) / 6)} ${f(p2[0] - (p3[0] - p1[0]) / 6)} ${f(p2[1] - (p3[1] - p1[1]) / 6)} ${f(p2[0])} ${f(p2[1])}`;
  }
  return d + 'Z';
}

// ═══ Paletler ═══
export const BG = ['#2F5755', '#dfeae8', '#576A8F', '#ACBAC4', '#EDE9E6', '#6FCF97', '#F8DE22', '#FF88BA', '#612D53', '#E6501B', '#1e293b', '#422006'];
export const SKIN = ['#fff0e1', '#ffe3cc', '#f8d3b4', '#f0c29e', '#e2a982', '#cf916a', '#b97a52', '#9c6243', '#7f4b31', '#613723', '#472818', '#3a1f12'];
export const HAIRC = ['#1c1714', '#3b2a20', '#5a3b26', '#7a4a2a', '#a0662f', '#c8954f', '#e2c27d', '#b0533a', '#8c8c8c', '#dcd6cc', '#2f3a6e', '#c2457a', '#6b2f5c', '#2f6f5e'];
export const EYEC = ['#3b2618', '#6b4423', '#2f6f8f', '#3f7a4a', '#7a8a94', '#2d3e8c', '#8a5a2b', '#1a1a1a'];
export const LIPC = ['#c4706a', '#b25a5a', '#d98a85', '#9e4b4f', '#e07a8a', '#7a3a3e', '#a8574a', '#c98a7a'];
export const OUTC = ['#1e3a5f', '#2F5755', '#7c1d1d', '#4a1d96', '#1a1a2e', '#ec4899', '#f97316', '#0ea5e9', '#84cc16', '#64748b', '#f4f1ec', '#fef3c7', '#111827', '#831843', '#3b5b8c', '#a16207'];
export const ACCENT = ['#ffffff', '#1a1a1a', '#e11d48', '#2563eb', '#16a34a', '#d97706', '#7c3aed', '#fbbf24', '#f472b6', '#0891b2'];
export const ACCC = ['#1a1a1a', '#6b4423', '#c9a227', '#c0c0c0', '#c0392b', '#2563eb', '#ec4899', '#f8f8f8'];
export const MAKEC = ['#b07a9a', '#8a6aa8', '#c98a5a', '#6a8a9a', '#a35a5a', '#d4a04a', '#5a7a5a', '#3a3a4a'];
export const LID = '#2a1d17', WHITE_EYE = '#f7f3ee', PUPIL = '#15100d', MOUTH_IN = '#5a2626', TEETH = '#fbf7f2', TONGUE = '#e57373';
const GOLD = '#e0b23a';

// ═══ Vücut ═══ Baş genişliği ≈ 37. Orta erkekte omuz ≈ 1,6 baş, orta kadında ≈ 1,35 baş.
export interface BodyOpt { id: string; name: string; S: number; n: number; sy: number; fem?: boolean; sex: Sex }
export const BODIES: BodyOpt[] = [
  { id: 'kadin', name: 'Kadın', S: 25, n: 5.4, sy: 87, fem: true, sex: 'k' },
  { id: 'erkek', name: 'Erkek', S: 29.5, n: 7, sy: 84.6, sex: 'e' },
];
// k omuz çarpanı, nk boyun çarpanı, dsy omuz ucu kayması (eksi = daha yüksek ve köşeli), rank tip değişince en yakın karşılık.
export interface BuildOpt { id: string; name: string; sex: Sex; rank: number; k: number; nk: number; dsy: number }
export const BUILDS: BuildOpt[] = [
  { id: 'k-zayif', name: 'Zayıf', sex: 'k', rank: 0, k: 0.86, nk: 0.92, dsy: 0.6 },
  { id: 'k-ince', name: 'İnce', sex: 'k', rank: 1, k: 0.93, nk: 0.96, dsy: 0.3 },
  { id: 'k-orta', name: 'Orta', sex: 'k', rank: 2, k: 1, nk: 1, dsy: 0 },
  { id: 'k-balik', name: 'Balık etli', sex: 'k', rank: 3, k: 1.1, nk: 1.06, dsy: -0.4 },
  { id: 'k-dolgun', name: 'Dolgun', sex: 'k', rank: 4, k: 1.22, nk: 1.14, dsy: 0.4 },
  { id: 'e-ince', name: 'İnce', sex: 'e', rank: 1, k: 0.88, nk: 0.94, dsy: 0.6 },
  { id: 'e-orta', name: 'Orta', sex: 'e', rank: 2, k: 1, nk: 1, dsy: 0 },
  { id: 'e-atletik', name: 'Atletik', sex: 'e', rank: 3, k: 1.1, nk: 1.04, dsy: -1.4 },
  { id: 'e-kasli', name: 'Kaslı', sex: 'e', rank: 4, k: 1.2, nk: 1.22, dsy: -2 },
  { id: 'e-kilolu', name: 'Kilolu', sex: 'e', rank: 4, k: 1.22, nk: 1.16, dsy: 1.2 },
  { id: 'e-iri', name: 'İri', sex: 'e', rank: 5, k: 1.3, nk: 1.22, dsy: -0.6 },
];
function bodyGeom(B: BodyOpt, W: BuildOpt): Geom {
  const S = B.S * W.k, n = B.n * W.nk, sy = B.sy + W.dsy;
  const L = 50 - S, R = 50 + S, nl = 50 - n, nr = 50 + n;
  const body = `M${f(L - 1.5)} 101L${f(L - 1)} ${f(sy + 6)}C${f(L - 0.6)} ${f(sy + 1)} ${f(L + 2.5)} ${f(sy - 2.6)} ${f(L + 8)} ${f(sy - 3.8)}C${f(nl - 7)} 80.6 ${f(nl - 2.5)} 79.6 ${f(nl)} 79L${f(nr)} 79C${f(nr + 2.5)} 79.6 ${f(nr + 7)} 80.6 ${f(R - 8)} ${f(sy - 3.8)}C${f(R - 2.5)} ${f(sy - 2.6)} ${f(R + 0.6)} ${f(sy + 1)} ${f(R + 1)} ${f(sy + 6)}L${f(R + 1.5)} 101Z`;
  const neck = `M${f(nl)} 60L${f(nr)} 60L${f(nr)} 82L${f(nl)} 82Z`;
  return { S, n, sy, fem: !!B.fem, L, R, nl, nr, body, neck };
}

// ═══ Yüz şekilleri ═══ p: [tepe, şakakG, şakakY, elmacıkG, elmacıkY, çeneG, çeneY, çeneUcuG, çeneUcuY, alt]
export interface FaceOpt { id: string; name: string; p: number[]; sex?: Sex }
export const FACES: FaceOpt[] = [
  { id: 'oval', name: 'Oval', p: [20, 15, 25, 18.5, 46, 15.5, 60, 7, 70.5, 72] },
  { id: 'yuvarlak', name: 'Yuvarlak', p: [21, 16.5, 26, 19.5, 47, 17.5, 60, 9, 69, 71] },
  { id: 'kare', name: 'Kare çene', p: [20, 17, 24.5, 18.5, 46, 18, 62, 10, 70, 71.5] },
  { id: 'kalp', name: 'Kalp', p: [20, 17.5, 26, 18.5, 44, 13, 60, 5, 70, 72.5] },
  { id: 'uzun', name: 'Uzun', p: [18, 14.5, 24, 16.5, 46, 14.5, 62, 7, 72, 74] },
  { id: 'dolgun', name: 'Dolgun', p: [21, 17, 26, 20.5, 49, 18.5, 61, 10, 69.5, 71.5] },
  { id: 'elmas', name: 'Elmas', p: [20, 13.5, 26, 19, 46, 14, 61, 6, 70.5, 72.5] },
  { id: 'armut', name: 'Armut', p: [21, 14, 26, 17.5, 46, 18.5, 61, 10.5, 69.5, 71.5] },
  { id: 'ince', name: 'İnce', p: [19, 14, 25, 16, 46, 13.5, 61, 6.5, 71, 73] },
  { id: 'yumusak', name: 'Yumuşak kare', p: [20, 16.5, 25, 18.5, 46, 17.5, 61, 8.5, 70.5, 72] },
];
const headPts = (p: number[]) => { const [t, tw, ty, cw, cy, jw, jy, chw, chy, b] = p; return [[50, t], [50 + tw, ty], [50 + cw, cy], [50 + jw, jy], [50 + chw, chy], [50, b], [50 - chw, chy], [50 - jw, jy], [50 - cw, cy], [50 - tw, ty]]; };

// ═══ Saç ═══ back = başın arkası, front = başın önü; hs gölge, hl parlama
export interface HairOpt { id: string; name: string; sex?: Sex; back?: (c: Ctx) => Item[]; front: (c: Ctx) => Item[] }
const capCrop = 'M32.5 46C29.5 34 31 15 50 14.5C69 15 70.5 34 67.5 46C66.5 40 66 35 63.5 31.5C57 29 43 29 36.5 31.5C34 35 33.5 40 32.5 46Z';
const capSmooth = 'M32 46C29.5 33 31.5 14 50 13.5C68.5 14 70.5 33 68 46C67 39 66 34 63 30.5C57 27.5 43 27.5 37 30.5C34 34 33 39 32 46Z';
const hlTop = (c: Ctx): Paint => ({ d: 'M37 21C40.5 16.5 45 15 50 14.6C45.5 16.8 42 19.6 39.6 23.4Z', fill: c.hl, op: 0.7 });
const longBack = 'M29 38C27 18 38 11 50 11C62 11 73 18 71 38L73 84L27 84Z';
const curtains = 'M30 46C29.2 62 28.4 80 27.4 96L35.4 96C35 82 35 66 34.2 52Z M70 46C70.8 62 71.6 80 72.6 96L64.6 96C65 82 65 66 65.8 52Z';
export const HAIR: HairOpt[] = [
  { id: 'yok', name: 'Saçsız', sex: 'e', front: () => [] },
  { id: 'kirpi', name: 'Kirpi', sex: 'e', front: (c) => [{ d: 'M32 42C30.5 29 35 19.5 50 19C65 19.5 69.5 29 68 42C67 36 65.5 32 62.5 30C56.5 28.4 43.5 28.4 37.5 30C34.5 32 33 36 32 42Z', fill: c.hc, op: 0.88 }] },
  { id: 'kisa', name: 'Kısa', sex: 'e', front: (c) => [{ d: capCrop, fill: c.hc }, { d: 'M36.5 31.5C43 29 57 29 63.5 31.5L63 33C57 31 43 31 37 33Z', fill: c.hs }, hlTop(c)] },
  { id: 'yanayrik', name: 'Yandan ayrık', sex: 'e', front: (c) => [
    { d: 'M32 47C28.5 33 30 12 50 12C70 12 71.5 33 68 47C67 40 66.5 35 64.5 31C58 30 50 33 41 39C37 41 34 43 32 47Z', fill: c.hc },
    { d: 'M58 13.4C57 18 57.4 24 59 30.4L60.6 30.2C59.2 24 58.8 18 59.8 13.6Z', fill: c.hs },
    { d: 'M45 33.5C50 31 56 30.6 62 31.2C56 32.4 50 34.6 44.6 38Z', fill: c.hs, op: 0.6 }, hlTop(c)] },
  { id: 'kabarik', name: 'Kabarık', sex: 'e', front: (c) => [
    { d: 'M32.5 46C29.5 34 29.5 20 37 12.5C43 6.5 58 5.5 64.5 10.5C70.5 15.5 71 32 67.5 46C66.5 40 66 35 63.5 31.5C57 29 43 29 36.5 31.5C34 35 33.5 40 32.5 46Z', fill: c.hc },
    { d: 'M40 25C44 16 52 12 61 13.5C53 15 47 19 43.5 27Z', fill: c.hs },
    { d: 'M41 14C46 9.5 53 8.4 59 9.6C52 10.6 47 12.6 43 16.4Z', fill: c.hl, op: 0.7 }] },
  { id: 'geriye', name: 'Geriye taralı', sex: 'e', front: (c) => [
    { d: 'M32 42C30 27 35 15 50 14.5C65 15 70 27 68 42C67 35 65.5 30 62 27.5C56 25.5 44 25.5 38 27.5C34.5 30 33 35 32 42Z', fill: c.hc },
    { d: 'M40 18Q44 23 42 27M46 16Q50 21 49 26M54 16Q57 21 56.6 26M60 18Q63 22.4 61.6 27', stroke: c.hs, w: 0.8, pw: 2.1 }] },
  { id: 'undercut', name: 'Yanları kısa', sex: 'e', front: (c) => [
    { d: 'M32 44C30.5 34 31.5 27 34 23L66 23C68.5 27 69.5 34 68 44C67 38 66 34 64 31.5L36 31.5C34 34 33 38 32 44Z', fill: c.hc, op: 0.45 },
    { d: 'M34.5 27.5C34 16 41 10.5 51 10.5C61 10.5 67 16 66 27.5C60 25 56 26.4 52 28.6C46 25.8 40 25.6 34.5 27.5Z', fill: c.hc },
    { d: 'M44 14Q50 18 52 27M54 13Q59 17 60 25.6', stroke: c.hs, w: 0.8, pw: 2.1 }] },
  { id: 'perdeli', name: 'Perdeli kâkül', sex: 'e', front: (c) => [
    { d: 'M31.5 46C29 28 35 13.5 50 13.5C65 13.5 71 28 68.5 46C67.5 39 66 35 63 33.5C58 32 53 29 50 25C47 29 42 32 37 33.5C34 35 32.5 39 31.5 46Z', fill: c.hc },
    { d: 'M49.4 14L50.6 14L50.6 25L49.4 25Z', fill: c.hs }, hlTop(c)] },
  { id: 'acikalin', name: 'Açık alın', sex: 'e', front: (c) => [{ d: 'M32.5 44C30 32 32 18 50 17.5C68 18 70 32 67.5 44C66.5 38 65.5 33 63 29.5C60 27 57.5 26 56 24.5C53 26 47 26 44 24.5C42.5 26 40 27 37 29.5C34.5 33 33.5 38 32.5 44Z', fill: c.hc }] },
  { id: 'tepesiacik', name: 'Tepesi açık', sex: 'e', front: (c) => [{ d: 'M31.8 46C30.6 38 31 32 33 28.5L36.5 29.5C35 34 34.8 40 35 46Z M68.2 46C69.4 38 69 32 67 28.5L63.5 29.5C65 34 65.2 40 65 46Z', fill: c.hc }, { d: 'M40 23Q44 20 48 20', stroke: '#ffffff', w: 1, op: 0.35, pw: 2.1, g: 'shade' }] },
  { id: 'samuray', name: 'Erkek topuzu', sex: 'e', back: (c) => [{ d: ell(50, 10, 6, 5), fill: c.hc }],
    front: (c) => [{ d: 'M32 44C30 27 35 15 50 14.5C65 15 70 27 68 44C67 35 65.5 30 62 27.5C56 25.5 44 25.5 38 27.5C34.5 30 33 35 32 44Z', fill: c.hc },
      { d: rr(46.6, 13.2, 6.8, 2, 0.9), fill: c.hs }, { d: 'M42 18Q45 23 43.6 27.4M50 16.4Q52 22 51.4 26.4M57.4 18Q60 22.6 58.8 27.4', stroke: c.hs, w: 0.8, pw: 2.1 }] },
  { id: 'kivircik', name: 'Kıvırcık', front: (c) => [
    { d: [ell(33, 33, 5.5), ell(35, 25, 6), ell(41, 19, 6.5), ell(50, 16.5, 7), ell(59, 19, 6.5), ell(65, 25, 6), ell(67, 33, 5.5), ell(32.6, 40, 4), ell(67.4, 40, 4), 'M33 38C33 26 40 20 50 20C60 20 67 26 67 38C62 32 56 30 50 30C44 30 38 32 33 38Z'].join(''), fill: c.hc },
    { d: [ell(40, 24, 2), ell(52, 20, 2.2), ell(61, 25, 2), ell(46, 27.5, 1.6), ell(57, 28, 1.6), ell(34.5, 33, 1.6), ell(65.5, 33, 1.6)].join(''), fill: c.hs },
    { d: [ell(44, 13.5, 1.6), ell(37, 18, 1.3)].join(''), fill: c.hl, op: 0.7 }] },
  { id: 'afro', name: 'Afro', back: (c) => [{ d: ell(50, 32, 26, 23.5), fill: c.hc }, { d: [ell(30, 22, 1.8), ell(40, 14, 1.8), ell(55, 12, 1.8), ell(68, 20, 1.8), ell(73, 36, 1.8), ell(27, 38, 1.8), ell(62, 13.5, 1.4)].join(''), fill: c.hs }],
    front: (c) => [{ d: 'M31.5 46C30 36 31 30 34 27C42 25 58 25 66 27C69 30 70 36 68.5 46C67 39 66 34 63 31.5C57 29.5 43 29.5 37 31.5C34 34 33 39 31.5 46Z', fill: c.hc }] },
  { id: 'rasta', name: 'Rasta', back: (c) => [
      { d: [rr(25.5, 30, 3.4, 52, 1.7), rr(29.4, 32, 3.4, 54, 1.7), rr(67.2, 32, 3.4, 54, 1.7), rr(71.1, 30, 3.4, 52, 1.7), ell(50, 24, 22, 14)].join(''), fill: c.hc },
      { d: 'M25.5 44H28.9M25.5 58H28.9M25.5 72H28.9M29.4 50H32.8M29.4 66H32.8M67.2 50H70.6M67.2 66H70.6M71.1 44H74.5M71.1 58H74.5M71.1 72H74.5', stroke: c.hs, w: 0.8, pw: 2.1 }],
    front: (c) => [{ d: capSmooth, fill: c.hc }, { d: [rr(30.4, 30, 3.2, 30, 1.6), rr(66.4, 30, 3.2, 30, 1.6)].join(''), fill: c.hc }, { d: 'M38 16Q42 22 40 30M46 14Q49 21 48 29M54 14Q57 21 56 29M62 16Q64 22 62 30', stroke: c.hs, w: 0.8, pw: 2.1 }] },
  { id: 'uzun', name: 'Uzun', back: (c) => [{ d: longBack, fill: c.hc }],
    front: (c) => [{ d: 'M30 50C28 26 36 12 50 12C64 12 72 26 70 50C69 40 66 31 60 27C56 25 52 26 50 30C48 26 44 25 40 27C34 31 31 40 30 50Z', fill: c.hc },
      { d: curtains, fill: c.hc }, { d: 'M49.4 12.4L50.6 12.4L50.6 29L49.4 29Z', fill: c.hs },
      { d: 'M33 56C32.6 68 32.2 82 32 96L33.4 96C33.5 82 33.6 68 34 56Z M67 56C67.4 68 67.8 82 68 96L66.6 96C66.5 82 66.4 68 66 56Z', fill: c.hs }, hlTop(c)] },
  { id: 'pixie', name: 'Pixie', sex: 'k', front: (c) => [
    { d: 'M31.5 44C29.5 27 35 14 50 13.5C65 14 70.5 27 68.5 42C67 36 65 33 61 31.5C55 32.5 48 36 41 38.5C37 40 34 41.5 31.5 44Z', fill: c.hc },
    { d: 'M41 38.5C48 36 55 32.5 61 31.5L60.4 33C55 34 48.6 37.4 42 40Z', fill: c.hs }, hlTop(c)] },
  { id: 'bob', name: 'Küt', sex: 'k', back: (c) => [{ d: 'M28 40C26 20 38 11 50 11C62 11 74 20 72 40L73.5 66C68 68.5 64 67.5 62 64.5L38 64.5C36 67.5 32 68.5 26.5 66Z', fill: c.hc }, { d: 'M70 40L71.6 64.8C69 66 66 66 64 64.5Z', fill: c.hs }],
    front: (c) => [{ d: 'M31 44C29 22 38 12 50 12C62 12 71 22 69 44C68.4 39 67.6 36.5 66.5 35.5C58 34 42 34 33.5 35.5C32.4 36.5 31.6 39 31 44Z', fill: c.hc },
      { d: 'M33.5 35.5C42 34 58 34 66.5 35.5L66.2 37C58 35.7 42 35.7 33.8 37Z', fill: c.hs }, hlTop(c)] },
  { id: 'lob', name: 'Omuz boyu', sex: 'k', back: (c) => [{ d: 'M28.5 40C26.5 20 38 11 50 11C62 11 73.5 20 71.5 40L72.5 76C67 78.5 63 77 61.5 74L38.5 74C37 77 33 78.5 27.5 76Z', fill: c.hc }],
    front: (c) => [{ d: 'M31 50C28.5 30 33 13 50 12.5C68 13 72 30 69 50C68 41 67 35 64 31.5C58 31 51 33 44 38.5C39 42 34.5 45 31 50Z', fill: c.hc },
      { d: 'M44 38.5C51 33 58 31 64 31.5L63.6 33C57.6 32.8 51.4 34.8 45 40Z', fill: c.hs }, hlTop(c)] },
  { id: 'dalgali', name: 'Dalgalı', sex: 'k', back: (c) => [{ d: 'M29 38C27 18 38 11 50 11C62 11 73 18 71 38C73 46 70 52 73 58C75 64 71 70 74 76C68 80 62 76 60 72L40 72C38 76 32 80 26 76C29 70 25 64 27 58C30 52 27 46 29 38Z', fill: c.hc }, { d: 'M71.8 58C73.4 63 71 69 72.6 74.6L71 75C69.8 69.6 72 64 70.4 58.6Z M28.2 58C26.6 63 29 69 27.4 74.6L29 75C30.2 69.6 28 64 29.6 58.6Z', fill: c.hs }],
    front: (c) => [{ d: 'M31 48C28.5 30 33 13 50 12.5C68 13 72 30 69 48C68 41 67 35 64 31.5C58 31 51 33 44 38.5C39 42 34.5 44 31 48Z', fill: c.hc },
      { d: 'M44 38.5C51 33 58 31 64 31.5L63.6 33C57.6 32.8 51.4 34.8 45 40Z', fill: c.hs }, hlTop(c)] },
  { id: 'kakullu', name: 'Kâküllü uzun', sex: 'k', back: (c) => [{ d: longBack, fill: c.hc }],
    front: (c) => [{ d: 'M31 44C29 22 38 12 50 12C62 12 71 22 69 44C68.4 39 67.6 36.5 66.5 35.5C58 34 42 34 33.5 35.5C32.4 36.5 31.6 39 31 44Z', fill: c.hc },
      { d: curtains, fill: c.hc }, { d: 'M33.5 35.5C42 34 58 34 66.5 35.5L66.2 37C58 35.7 42 35.7 33.8 37Z', fill: c.hs }, hlTop(c)] },
  { id: 'uzunkivircik', name: 'Uzun kıvırcık', sex: 'k', back: (c) => [
      { d: [ell(50, 26, 23, 16), ell(28, 40, 6), ell(27, 50, 6), ell(28.5, 60, 6), ell(27.5, 70, 6), ell(29.5, 79, 5.5), ell(72, 40, 6), ell(73, 50, 6), ell(71.5, 60, 6), ell(72.5, 70, 6), ell(70.5, 79, 5.5)].join(''), fill: c.hc },
      { d: [ell(27, 46, 1.7), ell(29, 56, 1.7), ell(26.5, 66, 1.7), ell(29, 75, 1.7), ell(73, 46, 1.7), ell(71, 56, 1.7), ell(73.5, 66, 1.7), ell(71, 75, 1.7)].join(''), fill: c.hs }],
    front: (c) => [{ d: [ell(34, 31, 5), ell(37, 23, 5.5), ell(43.5, 18, 6), ell(51, 16.5, 6.2), ell(58.5, 18.5, 6), ell(64, 24, 5.5), ell(66.5, 31.5, 5), 'M33 38C33 26 40 20 50 20C60 20 67 26 67 38C62 32 56 30 50 30C44 30 38 32 33 38Z'].join(''), fill: c.hc },
      { d: [ell(41, 22, 1.8), ell(52, 19, 2), ell(60, 24, 1.8), ell(36, 30, 1.5), ell(64.5, 30.5, 1.5)].join(''), fill: c.hs }] },
  { id: 'orgu', name: 'Yandan örgü', sex: 'k', front: (c) => {
      const links = Array.from({ length: 7 }, (_, i) => ell(32.6 + i * 0.5, 54 + i * 6.4, 3.4, 3.7)).join('');
      return [{ d: capSmooth, fill: c.hc }, { d: 'M32 46C31.5 50 32 53 33.4 56L36.4 54C35 51 34.6 48.4 35 46Z', fill: c.hc }, { d: links, fill: c.hc },
        { d: Array.from({ length: 6 }, (_, i) => `M${f(30.4 + i * 0.5)} ${f(57.4 + i * 6.4)}Q${f(32.8 + i * 0.5)} ${f(58.8 + i * 6.4)} ${f(35.6 + i * 0.5)} ${f(57.2 + i * 6.4)}`).join(''), stroke: c.hs, w: 0.8, pw: 2.1 },
        { d: rr(33.2, 95.6, 4.2, 2.2, 1), fill: c.ac }, hlTop(c)];
    } },
  { id: 'atkuyrugu', name: 'At kuyruğu', sex: 'k', back: (c) => [{ d: 'M64 25C76 25 81 36 79 50C78 60 75 68 70 73C72 63 72 51 68.5 41Z', fill: c.hc }, { d: 'M72 40C75 48 75 58 72 66L73.4 66C76.5 58 76.4 48 73.4 40Z', fill: c.hs }],
    front: (c) => [{ d: capSmooth, fill: c.hc }, { d: 'M66 26.5L70.4 25.2L71.4 29L67 30.2Z', fill: c.ac }, hlTop(c), { d: 'M43 29.4C47 28.4 53 28.4 57 29.4L56.8 30.6C53 29.8 47 29.8 43.2 30.6Z', fill: c.hs }] },
  { id: 'topuz', name: 'Topuz', sex: 'k', back: (c) => [{ d: ell(50, 10.5, 8.5, 7.5), fill: c.hc }, { d: 'M44 9C46 6 52 5.4 55 7.6C51 7 47 7.6 45 10Z', fill: c.hl, op: 0.6 }],
    front: (c) => [{ d: capSmooth, fill: c.hc }, { d: 'M42.5 15.6L57.5 15.6L57.6 17.2L42.4 17.2Z', fill: c.hs }, hlTop(c)] },
  { id: 'cifttopuz', name: 'Çift topuz', sex: 'k', back: (c) => [{ d: ell(33, 15.5, 6.5) + ell(67, 15.5, 6.5), fill: c.hc }, { d: 'M30 13Q33 11 36 13M64 13Q67 11 70 13', stroke: c.hs, w: 0.8, pw: 2.1 }],
    front: (c) => [{ d: capSmooth, fill: c.hc }, { d: 'M49.4 13.8L50.6 13.8L50.6 28L49.4 28Z', fill: c.hs }] },
  { id: 'yarimtoplu', name: 'Yarım toplu', sex: 'k', back: (c) => [{ d: 'M28.5 40C26.5 20 38 11 50 11C62 11 73.5 20 71.5 40L72.5 76C67 78.5 63 77 61.5 74L38.5 74C37 77 33 78.5 27.5 76Z', fill: c.hc }, { d: ell(50, 11, 5.5, 4.5), fill: c.hc }],
    front: (c) => [{ d: capSmooth, fill: c.hc }, { d: rr(46.6, 12.4, 6.8, 1.8, 0.8), fill: c.ac }, { d: 'M43 29.4C47 28.4 53 28.4 57 29.4L56.8 30.6C53 29.8 47 29.8 43.2 30.6Z', fill: c.hs }, hlTop(c)] },
  { id: 'yantarali', name: 'Yana taralı', sex: 'k', back: (c) => [{ d: longBack, fill: c.hc }],
    front: (c) => [{ d: 'M30 52C27.5 30 33 13 50 12.5C68 13 72 30 70 50C69 41 67.5 35 64.5 31.5C57 30 48 34 40 41C36 44 32.5 48 30 52Z', fill: c.hc },
      { d: 'M70 46C70.8 62 71.6 80 72.6 96L64.6 96C65 82 65 66 65.8 52Z', fill: c.hc },
      { d: 'M40 41C48 34 57 30 64.5 31.5L64 33C57 32.6 49 36 41.4 42.6Z', fill: c.hs }, hlTop(c)] },
];

// ═══ Gözler ═══ vektör + piksel kalıbı (sol göz; sütun 0 dış köşe, sağ göz aynalanır).
// k kapak · w ak · i iris · p bebek · h parlama · s göz kapağı · l kirpik
export interface EyeOpt { id: string; name: string; sex?: Sex; v: (cx: number, cy: number, s: number, c: Ctx) => Paint[]; px: { y0: number; L: string[]; R?: string[] } }
interface EyeOpts { rx?: number; ry?: number; ir?: number; iy?: number; white?: string; lid?: string; lw?: number; noLid?: boolean }
const eyeBase = (cx: number, cy: number, s: number, c: Ctx, o: EyeOpts = {}): Paint[] => {
  const X = (dx: number) => f(cx + s * dx); const rx = o.rx ?? 3.4, ry = o.ry ?? 2.7, ir = o.ir ?? 2.1;
  const white = o.white ?? ell(cx, cy, rx, ry);
  const out: Paint[] = [
    { d: white, fill: WHITE_EYE },
    { d: ell(cx, cy + (o.iy ?? 0.2), ir), fill: c.ec, clip: white },
    { d: ell(cx, cy + (o.iy ?? 0.2), ir * 0.5), fill: PUPIL, clip: white },
    { d: ell(cx - 0.75, cy - 0.6 + (o.iy ?? 0), ir * 0.3), fill: '#ffffff' },
  ];
  if (!o.noLid) out.push({ d: o.lid ?? `M${X(-rx - 0.2)} ${f(cy - 0.3)}Q${f(cx)} ${f(cy - ry - 1.4)} ${X(rx + 0.2)} ${f(cy - 0.3)}`, stroke: LID, w: o.lw ?? 1.1 });
  return out;
};
const closedEye = (cx: number, cy: number): Paint[] => [{ d: `M${f(cx - 3.2)} ${f(cy + 0.7)}Q${f(cx)} ${f(cy - 2.8)} ${f(cx + 3.2)} ${f(cy + 0.7)}`, stroke: LID, w: 1.3 }];
const shapedEye = (top: number[][], bottom: number[][], lidEnd: number[]) => (cx: number, cy: number, s: number, c: Ctx, o: EyeOpts = {}) => {
  const X = (dx: number) => f(cx + s * dx), Y = (dy: number) => f(cy + dy);
  const white = `M${X(top[0][0])} ${Y(top[0][1])}C${X(top[1][0])} ${Y(top[1][1])} ${X(top[2][0])} ${Y(top[2][1])} ${X(top[3][0])} ${Y(top[3][1])}C${X(bottom[0][0])} ${Y(bottom[0][1])} ${X(bottom[1][0])} ${Y(bottom[1][1])} ${X(top[0][0])} ${Y(top[0][1])}Z`;
  const lid = `M${X(top[0][0])} ${Y(top[0][1])}C${X(top[1][0])} ${Y(top[1][1])} ${X(top[2][0])} ${Y(top[2][1])} ${X(lidEnd[0])} ${Y(lidEnd[1])}`;
  return eyeBase(cx, cy, s, c, { white, lid, ...o });
};
export const EYES: EyeOpt[] = [
  { id: 'yuvarlak', name: 'Yuvarlak', v: (cx, cy, s, c) => eyeBase(cx, cy, s, c), px: { y0: 22, L: ['.kkk.', 'whpiw', '.wiw.'] } },
  { id: 'badem', name: 'Badem', v: (cx, cy, s, c) => shapedEye([[-3.8, 0.3], [-2, -2.6], [2.2, -2.8], [3.9, -0.6]], [[2.2, 2.2], [-2, 2.4]], [4.7, -1.6])(cx, cy, s, c, { ir: 1.9, lw: 1.3 }), px: { y0: 22, L: ['kkkk.', 'wwpiw', '.www.'] } },
  { id: 'iri', name: 'İri', v: (cx, cy, s, c) => [...eyeBase(cx, cy, s, c, { rx: 3.8, ry: 3.2, ir: 2.6, lw: 1.2 }), { d: ell(cx + 0.9, cy + 1.1, 0.45), fill: '#ffffff' }], px: { y0: 21, L: ['.kkk.', 'wiphw', 'wiiiw', '.www.'] } },
  { id: 'yorgun', name: 'Yorgun', v: (cx, cy, s, c) => {
      const X = (dx: number) => f(cx + s * dx);
      return [...eyeBase(cx, cy, s, c, { rx: 3.4, ry: 2.4, iy: 0.6, noLid: true }),
        { d: `M${X(-3.9)} ${f(cy + 0.1)}C${X(-2)} ${f(cy - 3.4)} ${X(2)} ${f(cy - 3.4)} ${X(3.9)} ${f(cy + 0.1)}Z`, fill: c.ds },
        { d: `M${X(-3.8)} ${f(cy + 0.1)}Q${f(cx)} ${f(cy - 0.7)} ${X(3.8)} ${f(cy + 0.1)}`, stroke: LID, w: 1.1 }];
    }, px: { y0: 22, L: ['sssss', 'kkkkk', '.wpw.'] } },
  { id: 'cekik', name: 'Çekik', v: (cx, cy, s, c) => shapedEye([[-3.8, 0.4], [-1.5, -1.8], [1.5, -1.9], [3.8, -0.2]], [[1.5, 1.8], [-1.5, 1.9]], [4.2, -0.6])(cx, cy, s, c, { ir: 1.6, iy: 0.1, lw: 1.3 }), px: { y0: 23, L: ['kkkkk', '.wpw.'] } },
  { id: 'kedi', name: 'Kedi gözü', sex: 'k', v: (cx, cy, s, c) => shapedEye([[-3.6, 0.6], [-1.8, -2], [2, -2.6], [4, -1.6]], [[2.6, 1.6], [-1.6, 2.2]], [5.2, -3])(cx, cy, s, c, { ir: 1.9, lw: 1.4 }), px: { y0: 21, L: ['k....', '.kkkk', '.wpiw'] } },
  { id: 'dusuk', name: 'Düşük uçlu', v: (cx, cy, s, c) => shapedEye([[-3.6, -0.6], [-1.6, -2.6], [2, -2.2], [3.8, 0.8]], [[2, 2.2], [-1.8, 2]], [4.2, 1.4])(cx, cy, s, c, { ir: 1.9, lw: 1.2 }), px: { y0: 22, L: ['..kkk', '.kwpw', 'k....'] } },
  { id: 'kisik', name: 'Kısık', v: (cx, cy, s, c) => [...eyeBase(cx, cy, s, c, { rx: 3.4, ry: 1.4, ir: 1.3, iy: 0, lw: 1.4 }), { d: `M${f(cx - 3)} ${f(cy + 2)}Q${f(cx)} ${f(cy + 2.8)} ${f(cx + 3)} ${f(cy + 2)}`, stroke: c.ds, w: 0.8 }], px: { y0: 23, L: ['.kkk.', 'kkpkk'] } },
  { id: 'torbali', name: 'Uykusuz', v: (cx, cy, s, c) => [...eyeBase(cx, cy, s, c), { d: `M${f(cx - 3)} ${f(cy + 3.2)}Q${f(cx)} ${f(cy + 4.8)} ${f(cx + 3)} ${f(cy + 3.2)}`, stroke: c.dds, w: 0.9, op: 0.7 }], px: { y0: 22, L: ['.kkk.', 'whpiw', '.wiw.', '.sss.'] } },
  { id: 'kirpikli', name: 'Kirpikli', sex: 'k', v: (cx, cy, s, c) => {
      const X = (dx: number) => f(cx + s * dx);
      return [...eyeBase(cx, cy, s, c, { lw: 1.2 }), { d: `M${X(3.1)} ${f(cy - 1.6)}L${X(4.6)} ${f(cy - 2.9)}M${X(2)} ${f(cy - 2.6)}L${X(2.9)} ${f(cy - 4.1)}`, stroke: LID, w: 0.9 }];
    }, px: { y0: 21, L: ['l.l..', '.kkk.', 'whpiw', '.wiw.'] } },
  { id: 'gulen', name: 'Gülen', v: (cx, cy) => closedEye(cx, cy), px: { y0: 22, L: ['.kkk.', 'k...k'] } },
  { id: 'kirpan', name: 'Göz kırpan', v: (cx, cy, s, c) => (s < 0 ? eyeBase(cx, cy, s, c) : closedEye(cx, cy)), px: { y0: 22, L: ['.kkk.', 'whpiw', '.wiw.'], R: ['.kkk.', 'k...k', '.....'] } },
];

// ═══ Kaşlar ═══ s = +1 sol kaş (dıştan içe); piksel kalıbında sütun 4 iç taraf
export interface BrowOpt { id: string; name: string; sex?: Sex; v: (cx: number, s: number) => { d: string; w: number }; px: string[]; y0?: number }
export const BROWS: BrowOpt[] = [
  { id: 'dogal', name: 'Doğal', v: (cx, s) => ({ d: `M${f(cx - s * 4)} 42.4Q${f(cx)} 40.6 ${f(cx + s * 4.2)} 42.2`, w: 1.5 }), px: ['.bbb.', 'b...b'] },
  { id: 'ince', name: 'İnce', sex: 'k', v: (cx, s) => ({ d: `M${f(cx - s * 3.8)} 42.2Q${f(cx)} 40.8 ${f(cx + s * 4)} 42`, w: 0.9 }), px: ['.....', '.bbbb'] },
  { id: 'kalin', name: 'Kalın', v: (cx, s) => ({ d: `M${f(cx - s * 4)} 42.4Q${f(cx)} 40.6 ${f(cx + s * 4.2)} 42.2`, w: 2.3 }), px: ['.bbbb', 'bbbbb'] },
  { id: 'kalinduz', name: 'Kalın düz', sex: 'e', v: (cx, s) => ({ d: `M${f(cx - s * 4)} 41.8L${f(cx + s * 4)} 41.6`, w: 2.4 }), px: ['bbbbb', 'bbbbb'] },
  { id: 'kavisli', name: 'Kavisli', sex: 'k', v: (cx, s) => ({ d: `M${f(cx - s * 4)} 42.6Q${f(cx + s * 0.5)} 38.8 ${f(cx + s * 4.3)} 42.4`, w: 1.4 }), px: ['.bbb.', 'b...b'] },
  { id: 'yay', name: 'Yüksek yay', sex: 'k', v: (cx, s) => ({ d: `M${f(cx - s * 4)} 41.6Q${f(cx + s * 0.8)} 37.2 ${f(cx + s * 4)} 41.2`, w: 1.1 }), px: ['.bbb.', 'b...b', '.....'], y0: 18 },
  { id: 'kisa', name: 'Kısa', sex: 'e', v: (cx, s) => ({ d: `M${f(cx - s * 1.6)} 42L${f(cx + s * 2.8)} 41.6`, w: 1.8 }), px: ['.....', '..bbb'] },
  { id: 'catik', name: 'Çatık', v: (cx, s) => ({ d: `M${f(cx - s * 4)} 40.8L${f(cx + s * 4)} 43`, w: 1.7 }), px: ['bbb..', '...bb'] },
  { id: 'kalkik', name: 'Endişeli', v: (cx, s) => ({ d: `M${f(cx - s * 4)} 42.6L${f(cx + s * 4)} 41`, w: 1.4 }), px: ['...bb', 'bbb..'] },
];

// ═══ Burun ═══ piksel kalıbı sütun 22-25
export interface NoseOpt { id: string; name: string; sex?: Sex; v: (c: Ctx) => Paint[]; px: { y0: number; rows: string[] } }
export const NOSES: NoseOpt[] = [
  { id: 'kucuk', name: 'Küçük', v: (c) => [{ d: 'M48 57Q50 58.6 52 57', stroke: c.dds, w: 1.1 }], px: { y0: 27, rows: ['.ss.'] } },
  { id: 'uzun', name: 'Uzun', v: (c) => [{ d: 'M51 47.5L51.6 55.6Q50 57.6 48.2 56.4', stroke: c.dds, w: 1.1 }], px: { y0: 25, rows: ['..s.', '..s.', '.ss.'] } },
  { id: 'genis', name: 'Geniş', v: (c) => [{ d: 'M46.4 56Q47.4 58.6 50 58.1Q52.6 58.6 53.6 56', stroke: c.dds, w: 1.2 }], px: { y0: 26, rows: ['s..s', '.ss.'] } },
  { id: 'kalkik', name: 'Kalkık', v: (c) => [{ d: ell(48.6, 57.2, 0.85, 0.6) + ell(51.4, 57.2, 0.85, 0.6), fill: c.dds }, { d: 'M49 54Q50 55.6 51 54', stroke: c.ds, w: 0.8 }], px: { y0: 27, rows: ['s..s'] } },
  { id: 'kemerli', name: 'Kemerli', v: (c) => [{ d: 'M51 47L52.2 53Q52.8 55.6 51 56.8Q49.6 57.8 48.2 56.6', stroke: c.dds, w: 1.1 }, { d: ell(48.8, 57.2, 0.7, 0.5), fill: c.dds }], px: { y0: 25, rows: ['..s.', '...s', '.ss.'] } },
  { id: 'dugme', name: 'Düğme', v: (c) => [{ d: ell(50, 56.4, 2, 1.4), fill: c.ds, op: 0.6 }, { d: ell(48.9, 57.3, 0.6, 0.45) + ell(51.1, 57.3, 0.6, 0.45), fill: c.dds }], px: { y0: 26, rows: ['.ss.', 's..s'] } },
  { id: 'sivri', name: 'Sivri', v: (c) => [{ d: 'M50.6 49L52.4 56.2L49.2 57.2', stroke: c.dds, w: 1.1 }], px: { y0: 25, rows: ['..s.', '..ss', '.ss.'] } },
  { id: 'kanatli', name: 'Geniş kanatlı', v: (c) => [{ d: 'M46 55.4Q45.6 58 48 58.2M54 55.4Q54.4 58 52 58.2M48.6 58Q50 58.8 51.4 58', stroke: c.dds, w: 1 }], px: { y0: 26, rows: ['s..s', 'ssss'] } },
];

// ═══ Ağız ═══ piksel kalıbı sütun 21-26 · l dudak · d ağız içi · t diş · L koyu dudak · r dil · s gamze
export interface MouthOpt { id: string; name: string; sex?: Sex; v: (c: Ctx) => Paint[]; px: string[] }
export const MOUTHS: MouthOpt[] = [
  { id: 'gulumseme', name: 'Gülümseme', v: (c) => [{ d: 'M44.5 61Q50 65.8 55.5 61', stroke: c.lc, w: 1.6 }], px: ['l....l', '.llll.'] },
  { id: 'hafif', name: 'Hafif', v: (c) => [{ d: 'M46.2 62Q50 63.8 53.8 62', stroke: c.lc, w: 1.4 }], px: ['.l..l.', '..ll..'] },
  { id: 'gamzeli', name: 'Gamzeli', v: (c) => [{ d: 'M44.5 61Q50 65.8 55.5 61', stroke: c.lc, w: 1.6 }, { d: 'M42.8 59.6Q42.2 61 43 62.2M57.2 59.6Q57.8 61 57 62.2', stroke: c.dds, w: 0.8 }], px: ['sl..ls', '.llll.'] },
  { id: 'disli', name: 'Dişli gülüş', v: (c) => {
      const o = 'M44 60.5Q50 61.5 56 60.5Q55 66.6 50 66.7Q45 66.6 44 60.5Z';
      return [{ d: o, fill: MOUTH_IN }, { d: 'M44.8 61Q50 62 55.2 61L55 62.6Q50 63.4 45 62.6Z', fill: TEETH, clip: o }, { d: o, stroke: c.lc, w: 0.9 }];
    }, px: ['lttttl', '.dddd.', '..ll..'] },
  { id: 'kahkaha', name: 'Kahkaha', v: (c) => {
      const o = 'M43.6 60.2Q50 60.8 56.4 60.2Q55.6 68.6 50 68.8Q44.4 68.6 43.6 60.2Z';
      return [{ d: o, fill: MOUTH_IN }, { d: 'M44 60.4Q50 61.2 56 60.4L55.8 62.2Q50 63 44.2 62.2Z', fill: TEETH, clip: o }, { d: ell(50, 67.2, 3.2, 1.8), fill: TONGUE, clip: o }, { d: o, stroke: c.lc, w: 0.9 }];
    }, px: ['lttttl', 'dddddd', '.drrd.', '..ll..'] },
  { id: 'duz', name: 'Düz', v: (c) => [{ d: 'M46 62.4L54 62.4', stroke: c.lc, w: 1.4 }], px: ['......', '.llll.'] },
  { id: 'ciddi', name: 'Ciddi', v: (c) => [{ d: 'M45.6 63Q50 61.8 54.4 63', stroke: c.lc, w: 1.5 }], px: ['......', 'llllll'] },
  { id: 'saskin', name: 'Şaşkın', v: (c) => [{ d: ell(50, 62.6, 2.1, 2.6), fill: MOUTH_IN }, { d: ell(50, 62.6, 2.1, 2.6), stroke: c.lc, w: 1 }], px: ['..ll..', '.lddl.', '..ll..'] },
  { id: 'uzgun', name: 'Üzgün', v: (c) => [{ d: 'M45.5 64Q50 60.6 54.5 64', stroke: c.lc, w: 1.4 }], px: ['.llll.', 'l....l'] },
  { id: 'sirit', name: 'Sırıtış', v: (c) => [{ d: 'M45.5 62.6Q50 63.6 55 61', stroke: c.lc, w: 1.4 }], px: ['.....l', '.llll.'] },
  { id: 'opucuk', name: 'Öpücük', sex: 'k', v: (c) => [{ d: ell(50.6, 62.4, 2, 1.8), fill: c.lc }, { d: 'M49.4 62.4L51.8 62.4', stroke: shade(c.lc, 0.3), w: 0.6 }], px: ['..ll..', '..LL..'] },
  { id: 'dolgun', name: 'Dolgun dudak', sex: 'k', v: (c) => [
      { d: 'M45 62Q47.5 59.8 50 61Q52.5 59.8 55 62Q50 62.9 45 62Z', fill: c.lc },
      { d: 'M45.4 62.2Q50 66.4 54.6 62.2Q50 63.2 45.4 62.2Z', fill: shade(c.lc, 0.12) }], px: ['.llll.', '.LLLL.'] },
];

// ═══ Sakal (yalnızca erkek) ═══
export interface BeardOpt { id: string; name: string; v: (c: Ctx) => Item[] }
const MUST = 'M43 60C46 57 49 58 50 59.2C51 58 54 57 57 60C55 61.2 52 60.8 50 60.8C48 60.8 45 61.2 43 60Z';
export const BEARDS: BeardOpt[] = [
  { id: 'yok', name: 'Yok', v: () => [] },
  { id: 'kirli', name: 'Kirli sakal', v: (c) => [{ d: 'M31.5 50C32 60 37 70.5 50 72.8C63 70.5 68 60 68.5 50C66.5 58 62 63 56 64.6C53 62.4 47 62.4 44 64.6C38 63 33.5 58 31.5 50Z', fill: c.bc, op: 0.32, g: 'skin' }] },
  { id: 'biyik', name: 'Bıyık', v: (c) => [{ d: MUST, fill: c.bc }] },
  { id: 'pala', name: 'Pala bıyık', v: (c) => [{ d: 'M42 61C44 57.6 48.5 57.8 50 59.2C51.5 57.8 56 57.6 58 61C59 62.2 60 61.8 60.4 60.4C60.6 63 58.6 64 56.8 62.4C54.6 61 52 61 50 61.2C48 61 45.4 61 43.2 62.4C41.4 64 39.4 63 39.6 60.4C40 61.8 41 62.2 42 61Z', fill: c.bc }] },
  { id: 'keci', name: 'Keçi sakal', v: (c) => [{ d: MUST, fill: c.bc }, { d: 'M45.6 65C47 64 53 64 54.4 65L54 70.2C52.4 72.6 47.6 72.6 46 70.2Z', fill: c.bc }] },
  { id: 'favori', name: 'Favori', v: (c) => [{ d: 'M31.4 38L34.6 38L34.8 54C33.8 55.2 32.4 55.2 31.8 54Z M68.6 38L65.4 38L65.2 54C66.2 55.2 67.6 55.2 68.2 54Z', fill: c.bc }] },
  { id: 'cene', name: 'Çene sakalı', v: (c) => [{ d: 'M31.5 46C32 59 38 71 50 73.4C62 71 68 59 68.5 46L66.6 46.4C66 58.4 60.5 68.8 50 70.8C39.5 68.8 34 58.4 33.4 46.4Z', fill: c.bc }] },
  { id: 'kisasakal', name: 'Kısa sakal', v: (c) => [{ d: 'M32 48C31.5 61 38 73.5 50 75C62 73.5 68.5 61 68 48C66 55.5 62.5 60.5 57.5 63C55.5 61 44.5 61 42.5 63C37.5 60.5 34 55.5 32 48Z', fill: c.bc, op: 0.9 }, { d: MUST, fill: c.bc }] },
  { id: 'tam', name: 'Tam sakal', v: (c) => [
      { d: 'M31 46C30 62 37 77 50 78.5C63 77 70 62 69 46C67 54 64 60 58 63.2C56 61 44 61 42 63.2C36 60 33 54 31 46Z', fill: c.bc },
      { d: 'M43 60C46 57 49 58 50 59.2C51 58 54 57 57 60C55 61.6 52 61.2 50 61.2C48 61.2 45 61.6 43 60Z', fill: c.bc },
      { d: 'M40 70C44 74.5 56 74.5 60 70C57 76.5 43 76.5 40 70Z', fill: c.bs }] },
  { id: 'uzunsakal', name: 'Uzun sakal', v: (c) => [
      { d: 'M31 46C30 64 36 84 50 90C64 84 70 64 69 46C67 54 64 60 58 63.2C56 61 44 61 42 63.2C36 60 33 54 31 46Z', fill: c.bc },
      { d: MUST, fill: c.bc }, { d: 'M44 70Q46 80 48 87M56 70Q54 80 52 87M50 72L50 88', stroke: c.bs, w: 0.8, pw: 2.1 }] },
];

// ═══ Makyaj (yalnızca kadın) ═══ pre = gözlerden önce, post = gözlerden sonra
export interface MakeupOpt { id: string; name: string; pre?: (c: Ctx) => Item[]; post?: (c: Ctx) => Item[] }
const eyeShadow = (c: Ctx): Item[] => [-1, 1].map((s) => { const cx = 50 + s * 8; return { d: `M${f(cx - 4.2)} 47.8Q${f(cx)} 42.2 ${f(cx + 4.2)} 47.8Q${f(cx)} 45 ${f(cx - 4.2)} 47.8Z`, fill: c.mc, op: 0.5 }; });
const liner = (): Item[] => [...[-1, 1].map((s): Item => { const cx = 50 + s * 8, X = (dx: number) => f(cx + s * dx); return { d: `M${X(-3.4)} 47.6Q${f(cx)} 44.4 ${X(3.6)} 47.2L${X(5.6)} 45.2`, stroke: LID, w: 1.4, vo: true }; }),
  { sprite: { rows: ['k'], x0: 17, y0: 21, mirror: true, colors: { k: LID } } }];
const blushStrong = (): Item[] => [{ d: ell(40, 57.4, 4.2, 2.6) + ell(60, 57.4, 4.2, 2.6), fill: '#f0607a', op: 0.32 }];
export const MAKEUP: MakeupOpt[] = [
  { id: 'yok', name: 'Yok' },
  { id: 'allik', name: 'Allık', pre: blushStrong },
  { id: 'far', name: 'Far', pre: eyeShadow },
  { id: 'eyeliner', name: 'Eyeliner', post: liner },
  { id: 'farliner', name: 'Far + eyeliner', pre: eyeShadow, post: liner },
  { id: 'tam', name: 'Tam makyaj', pre: (c) => [...eyeShadow(c), ...blushStrong()], post: liner },
];

// ═══ Kıyafet ═══ g = vücut ölçüsü; yaka oyukları ten rengiyle çizilip gövdeye kırpılır
export interface OutfitOpt { id: string; name: string; sex?: Sex; open?: boolean; back?: (g: Geom, c: Ctx) => Item[]; front: (g: Geom, c: Ctx) => Item[] }
const crewCut = (g: Geom, c: Ctx): Item[] => [{ d: `M${f(g.nl)} 78.8Q50 84.6 ${f(g.nr)} 78.8Z`, fill: c.skin, clip: g.body, g: 'skin' }, { d: `M${f(g.nl - 0.6)} 79.2Q50 85.4 ${f(g.nr + 0.6)} 79.2`, stroke: c.od, w: 1.3, pw: 2.2, clip: g.body }];
const vCut = (g: Geom, c: Ctx, depth: number, color = c.skin, grp: Group = 'skin'): Paint => ({ d: `M${f(g.nl - 1)} 78.8L50 ${depth}L${f(g.nr + 1)} 78.8Z`, fill: color, clip: g.body, g: grp });
const seams = (g: Geom, c: Ctx): Paint => ({ d: `M${f(g.L + 6.5)} ${f(g.sy - 1)}Q${f(g.L + 8.5)} 92 ${f(g.L + 7.5)} 101M${f(g.R - 6.5)} ${f(g.sy - 1)}Q${f(g.R - 8.5)} 92 ${f(g.R - 7.5)} 101`, stroke: c.od, w: 0.8, op: 0.6, clip: g.body });
const lapels = (g: Geom, fill: string, bottom = 99): Paint => ({ d: `M${f(g.nl - 1)} 79L50 ${bottom}L45.5 101L${f(g.nl - 8.5)} 85L${f(g.nl - 3.6)} 80.2Z M${f(g.nr + 1)} 79L50 ${bottom}L54.5 101L${f(g.nr + 8.5)} 85L${f(g.nr + 3.6)} 80.2Z`, fill, clip: g.body });
const shirtCollar = (g: Geom, fill: string, depth = 87): Paint => ({ d: `M${f(g.nl - 0.6)} 78.2L50 ${depth}L46.8 ${depth + 2.6}L${f(g.nl - 4.4)} 81.2Z M${f(g.nr + 0.6)} 78.2L50 ${depth}L53.2 ${depth + 2.6}L${f(g.nr + 4.4)} 81.2Z`, fill });
export const OUTFITS: OutfitOpt[] = [
  { id: 'tisort', name: 'Tişört', front: (g, c) => [{ d: g.body, fill: c.oc }, ...crewCut(g, c), seams(g, c)] },
  { id: 'polo', name: 'Polo', sex: 'e', front: (g, c) => [{ d: g.body, fill: c.oc }, vCut(g, c, 86), shirtCollar(g, c.od, 85.4), { d: 'M50 86V95', stroke: c.od, w: 0.8, pw: 2.1 }, { d: ell(50, 89, 0.7) + ell(50, 92.4, 0.7), fill: c.ac }, seams(g, c)] },
  { id: 'gomlek', name: 'Gömlek + kravat', sex: 'e', front: (g, c) => [{ d: g.body, fill: c.oc }, vCut(g, c, 87), shirtCollar(g, tint(c.oc, 0.3)),
      { d: 'M48.6 87.5L51.4 87.5L52.6 89.5L51.8 101L48.2 101L47.4 89.5Z', fill: c.ac }, { d: 'M48.4 86.4L51.6 86.4L51 89.4L49 89.4Z', fill: shade(c.ac, 0.2) }] },
  { id: 'takim', name: 'Takım elbise', sex: 'e', open: true, front: (g, c) => [{ d: g.body, fill: c.oc }, vCut(g, c, 99, '#f4f1ec', 'outfit'), { d: 'M48.6 86.5L51.4 86.5L52.4 88.5L51.6 101L48.4 101L47.6 88.5Z', fill: c.ac },
      { d: 'M48.4 85.2L51.6 85.2L51 88.4L49 88.4Z', fill: shade(c.ac, 0.2) }, lapels(g, c.od)] },
  { id: 'yelek', name: 'Yelek', sex: 'e', open: true, front: (g, c) => [{ d: g.body, fill: '#f1efe9' }, vCut(g, c, 86), shirtCollar(g, '#ffffff', 85.4), { d: 'M48.8 86.4L51.2 86.4L51.8 101H48.2Z', fill: c.ac },
      { d: `M${f(50 - g.S * 0.66)} 101C${f(50 - g.S * 0.66)} 92 ${f(g.nl - 4)} 84.5 ${f(g.nl - 1.2)} 80.6L50 94.5L${f(g.nr + 1.2)} 80.6C${f(g.nr + 4)} 84.5 ${f(50 + g.S * 0.66)} 92 ${f(50 + g.S * 0.66)} 101Z`, fill: c.oc },
      { d: ell(50, 96.8, 0.75) + ell(50, 99.8, 0.75), fill: c.od }] },
  { id: 'oduncu', name: 'Oduncu gömleği', sex: 'e', front: (g, c) => [{ d: g.body, fill: c.oc },
      { d: [44, 56, 32, 68, 20, 80].map((x) => `M${x - 1.6} 70H${x + 1.6}V101H${x - 1.6}Z`).join('') + 'M0 86H100V88.4H0Z M0 95H100V97.4H0Z', fill: c.od, op: 0.55, clip: g.body },
      vCut(g, c, 90, c.ac, 'outfit'), shirtCollar(g, c.od, 88)] },
  { id: 'ceket', name: 'Ceket', open: true, front: (g, c) => [{ d: g.body, fill: c.oc }, vCut(g, c, 99, '#f4f1ec', 'outfit'), lapels(g, c.od), { d: `M${f(g.L + 9)} 91L${f(g.L + 14)} 90L${f(g.L + 14.4)} 92L${f(g.L + 9.4)} 93Z`, fill: c.ac }] },
  { id: 'kotceket', name: 'Kot ceket', open: true, front: (g, c) => [{ d: g.body, fill: c.oc }, vCut(g, c, 92, c.ac, 'outfit'), shirtCollar(g, c.od, 90),
      { d: `M${f(g.L + 9)} 89H${f(g.L + 16)}V94H${f(g.L + 9)}Z M${f(g.R - 16)} 89H${f(g.R - 9)}V94H${f(g.R - 16)}Z`, fill: c.od, op: 0.7, clip: g.body },
      { d: 'M50 92V101', stroke: c.od, w: 0.9, pw: 2.1 }, seams(g, c)] },
  { id: 'hirka', name: 'Hırka', open: true, front: (g, c) => [{ d: g.body, fill: c.oc }, { d: `M${f(g.nl - 1.5)} 79Q50 84 ${f(g.nr + 1.5)} 79L55.5 101L44.5 101Z`, fill: c.ac, clip: g.body },
      { d: `M${f(g.nl - 1.5)} 79L44.5 101M${f(g.nr + 1.5)} 79L55.5 101`, stroke: c.od, w: 1.4, pw: 2.2 }, { d: ell(43.6, 91, 0.7) + ell(43, 96, 0.7), fill: c.od }, seams(g, c)] },
  { id: 'kapusonlu', name: 'Kapüşonlu', back: (g, c) => [{ d: `M${f(g.nl - 9)} 84C${f(g.nl - 11)} 72 ${f(g.nl - 3)} 67.5 50 67.5C${f(g.nr + 3)} 67.5 ${f(g.nr + 11)} 72 ${f(g.nr + 9)} 84Z`, fill: c.od }],
    front: (g, c) => [{ d: g.body, fill: c.oc }, vCut(g, c, 89.5), { d: `M${f(g.nl - 2.5)} 79.4L50 91L${f(g.nr + 2.5)} 79.4`, stroke: c.od, w: 2.2, pw: 2.4, clip: g.body },
      { d: 'M46.5 89L46 97M53.5 89L54 97', stroke: c.ac, w: 1.1, pw: 2.2 }, { d: `M${f(50 - g.S * 0.45)} 101L${f(50 - g.S * 0.38)} 95.5L${f(50 + g.S * 0.38)} 95.5L${f(50 + g.S * 0.45)} 101Z`, fill: c.od, clip: g.body }] },
  { id: 'sweat', name: 'Baskılı sweat', front: (g, c) => [{ d: g.body, fill: c.oc }, ...crewCut(g, c), { d: ell(50, 94, 4.4), fill: c.ac }, { d: ell(50, 94, 2), fill: c.oc }, seams(g, c)] },
  { id: 'kolej', name: 'Kolej ceketi', front: (g, c) => [{ d: g.body, fill: c.oc },
      { d: `M0 70H${f(g.L + 7.5)}V101H0Z M${f(g.R - 7.5)} 70H100V101H${f(g.R - 7.5)}Z`, fill: c.ac, clip: g.body }, ...crewCut(g, c),
      { d: `M${f(g.L + 10.5)} 96V90L${f(g.L + 14)} 96V90`, stroke: c.ac, w: 1.3, pw: 2.2 }] },
  { id: 'kazak', name: 'Çizgili kazak', front: (g, c) => [{ d: g.body, fill: c.oc }, ...crewCut(g, c), { d: 'M0 88H100V90.4H0Z M0 93.4H100V96.4H0Z', fill: c.ac, clip: g.body }] },
  { id: 'balikci', name: 'Balıkçı yaka', front: (g, c) => [{ d: g.body, fill: c.oc }, { d: `M${f(g.nl - 0.6)} 70L${f(g.nr + 0.6)} 70L${f(g.nr + 1.4)} 80.6Q50 83.6 ${f(g.nl - 1.4)} 80.6Z`, fill: c.od },
      { d: `M${f(g.nl)} 74L${f(g.nr)} 74M${f(g.nl - 0.4)} 77.4L${f(g.nr + 0.4)} 77.4`, stroke: shade(c.oc, 0.32), w: 0.6, pw: 2.1 }] },
  { id: 'atlet', name: 'Atlet', open: true, front: (g, c) => [{ d: `M${f(50 - g.S * 0.62)} 101C${f(50 - g.S * 0.62)} 93 ${f(g.nl - 3.5)} 86 ${f(g.nl - 2.6)} 80.2L${f(g.nl - 0.4)} 80.2Q50 89 ${f(g.nr + 0.4)} 80.2L${f(g.nr + 2.6)} 80.2C${f(g.nr + 3.5)} 86 ${f(50 + g.S * 0.62)} 93 ${f(50 + g.S * 0.62)} 101Z`, fill: c.oc }] },
  { id: 'onluk', name: 'Lab önlüğü', open: true, front: (g, c) => [{ d: g.body, fill: '#f3f4f1' }, vCut(g, c, 96, c.oc, 'outfit'), lapels(g, '#dcdfd8', 96),
      { d: `M${f(g.R - 15)} 88H${f(g.R - 6)}V95H${f(g.R - 15)}Z`, fill: '#e4e6e1', clip: g.body }, { d: `M${f(g.R - 12.5)} 85.4L${f(g.R - 12.5)} 90`, stroke: c.ac, w: 1.2, pw: 2.2 }] },
  { id: 'bluz', name: 'Bluz', sex: 'k', front: (g, c) => [{ d: g.body, fill: c.oc }, { d: `M${f(g.nl - 5)} 80.4Q50 91 ${f(g.nr + 5)} 80.4Z`, fill: c.skin, clip: g.body, g: 'skin' }, { d: `M${f(g.nl - 5)} 80.4Q50 91 ${f(g.nr + 5)} 80.4`, stroke: c.ac, w: 1.8, pw: 2.4, clip: g.body }] },
  { id: 'fiyonklu', name: 'Fiyonklu bluz', sex: 'k', front: (g, c) => [{ d: g.body, fill: c.oc }, vCut(g, c, 84), { d: 'M50 82.6L45.4 80.2L45.6 85.2L50 83.4Z M50 82.6L54.6 80.2L54.4 85.2L50 83.4Z', fill: c.ac },
      { d: 'M49 83.4L47.4 89.4L49.4 89Z M51 83.4L52.6 89.4L50.6 89Z', fill: c.ac }, { d: ell(50, 83, 1.2), fill: shade(c.ac, 0.2) }, seams(g, c)] },
  { id: 'tunik', name: 'Tunik', sex: 'k', front: (g, c) => [{ d: g.body, fill: c.oc }, { d: `M${f(g.nl - 1.5)} 78.8Q50 85.6 ${f(g.nr + 1.5)} 78.8Z`, fill: c.skin, clip: g.body, g: 'skin' }, { d: 'M48.6 81.6L50 88L51.4 81.6Z', fill: c.skin, g: 'skin' },
      { d: `M${f(g.nl - 2)} 79.4Q50 86.6 ${f(g.nr + 2)} 79.4`, stroke: c.ac, w: 1.4, pw: 2.2, clip: g.body }, { d: 'M48.8 88.6H51.2V101H48.8Z', fill: c.ac, op: 0.8 }, seams(g, c)] },
  { id: 'elbise', name: 'Elbise', sex: 'k', front: (g, c) => [{ d: g.body, fill: c.oc }, { d: `M${f(g.nl - 3)} 78H${f(g.nr + 3)}V87H${f(g.nl - 3)}Z`, fill: c.skin, clip: g.body, g: 'skin' },
      { d: `M${f(g.nl - 3)} 79.6V87H${f(g.nr + 3)}V79.6`, stroke: c.ac, w: 1.4, pw: 2.2, clip: g.body }] },
];

// ═══ Şapka ve örtü ═══ back = yüzün arkası, front = en üst
export interface HatOpt { id: string; name: string; sex?: Sex; hidesHair?: boolean; hidesEars?: boolean; back?: (c: Ctx) => Item[]; front?: (c: Ctx) => Item[] }
const HIJAB_BACK = 'M50 11C68 11 75.5 25 75 44C74.6 58 70.6 68 63.6 75.6C61.4 79.4 59.6 82.4 58 84.4L42 84.4C40.4 82.4 38.6 79.4 36.4 75.6C29.4 68 25.4 58 25 44C24.5 25 32 11 50 11Z';
const HIJAB_FRONT = 'M50 15.5C64 15.5 71.5 26 71.5 42C71.5 54 69 64 63.5 71L61.5 69.8C66 62 68 53 68 44C68 30 61 22 50 22C39 22 32 30 32 44C32 53 34 62 38.5 69.8L36.5 71C31 64 28.5 54 28.5 42C28.5 26 36 15.5 50 15.5Z';
export const HATS: HatOpt[] = [
  { id: 'yok', name: 'Yok' },
  { id: 'basortusu', name: 'Başörtüsü', sex: 'k', hidesHair: true, hidesEars: true,
    back: (c) => [{ d: HIJAB_BACK, fill: c.tc }, { d: 'M63.6 75.6C61.4 79.4 59.6 82.4 58 84.4L54 84.4C57 81 60 77.6 62 73.6Z', fill: c.td }],
    front: (c) => [{ d: HIJAB_FRONT, fill: c.td }] },
  { id: 'baglamali', name: 'Bağlamalı başörtüsü', sex: 'k', hidesHair: true, hidesEars: true,
    back: (c) => [{ d: HIJAB_BACK, fill: c.tc }, { d: 'M38 74.6C34.4 77.6 32.8 81.2 33.4 85C36.4 83.6 39 81.6 41.8 80.2Z', fill: c.td }, { d: ell(38.6, 76.2, 2.4, 2), fill: c.td }],
    front: (c) => [{ d: HIJAB_FRONT, fill: c.td }, { d: 'M34 26Q44 20.5 56 21.6', stroke: tint(c.tc, 0.2), w: 0.9, op: 0.7, pw: 2.1 }] },
  { id: 'turban', name: 'Türban', sex: 'e', hidesHair: true, front: (c) => [{ d: 'M29 38C27.5 18 38 9 50 9C62 9 72.5 18 71 38C66 33 58 30.5 50 30.5C42 30.5 34 33 29 38Z', fill: c.tc }, { d: ell(50, 12, 7, 5.5), fill: c.td }, { d: 'M33 30Q44 18 62 16M36 34Q48 24 66 25', stroke: c.td, w: 0.9, pw: 2.1 }] },
  { id: 'bere', name: 'Bere', front: (c) => [{ d: 'M29.5 36C28.5 17 38 9.5 50 9.5C62 9.5 71.5 17 70.5 36Z', fill: c.tc }, { d: 'M28.8 31C40 29 60 29 71.2 31L71 37.5C60 35.5 40 35.5 29 37.5Z', fill: c.td }, { d: ell(50, 8.6, 4.2, 3.8), fill: tint(c.tc, 0.25) }] },
  { id: 'kep', name: 'Kep', front: (c) => [{ d: 'M30 34C29.5 17 39 10.5 50 10.5C61 10.5 70.5 17 70 34Z', fill: c.tc }, { d: 'M50 11L50 33', stroke: c.td, w: 0.7, pw: 2.1 }, { d: ell(50, 10.8, 1.6, 1), fill: c.td }, { d: 'M27 33.5C38 29.5 62 29.5 73 33.5C73.5 37.5 66 39 50 38.5C34 39 26.5 37.5 27 33.5Z', fill: c.td }] },
  { id: 'terskep', name: 'Ters kep', front: (c) => [{ d: 'M30 34C29.5 17 39 10.5 50 10.5C61 10.5 70.5 17 70 34C64 32 36 32 30 34Z', fill: c.tc }, { d: 'M50 11L50 32', stroke: c.td, w: 0.7, pw: 2.1 }, { d: rr(45, 28.6, 10, 3.6, 1.6), fill: c.td }] },
  { id: 'kova', name: 'Kova şapka', front: (c) => [{ d: 'M33 30C33 18 40 13 50 13C60 13 67 18 67 30Z', fill: c.tc }, { d: 'M27 36C30 28 70 28 73 36C73.6 39 68 38.6 50 37.4C32 38.6 26.4 39 27 36Z', fill: c.td }] },
  { id: 'fotr', name: 'Fötr', front: (c) => [{ d: 'M17 33.5C26 28.5 74 28.5 83 33.5C76 37.5 24 37.5 17 33.5Z', fill: c.tc }, { d: 'M33 32C32.5 18 39 12 50 14.5C61 12 67.5 18 67 32Z', fill: c.tc }, { d: 'M33 27L67 27L67 31.5C58 32.5 42 32.5 33 31.5Z', fill: c.td }, { d: 'M44 15.2Q50 19 56 15.2', stroke: c.td, w: 0.8, pw: 2.1 }] },
  { id: 'bandana', name: 'Bandana', front: (c) => [{ d: 'M30 31C30 18 39.5 14 50 14C60.5 14 70 18 70 31C60 28 40 28 30 31Z', fill: c.tc }, { d: 'M69 25L78 20.5L76.5 27L80 31L71 30Z', fill: c.td }, { d: [ell(40, 21, 1.1), ell(50, 18.5, 1.1), ell(60, 21, 1.1), ell(45, 25.5, 1.1), ell(55, 25.5, 1.1)].join(''), fill: '#ffffff', op: 0.85 }] },
  { id: 'bant', name: 'Saç bandı', sex: 'k', front: (c) => [{ d: 'M30.6 30C38 25 62 25 69.4 30L69 33.2C61 28.6 39 28.6 31 33.2Z', fill: c.tc }] },
  { id: 'fiyonk', name: 'Fiyonk', sex: 'k', front: (c) => [{ d: 'M62 17L55.6 12.8L55.2 21.2Z M62 17L68.4 12.8L68.8 21.2Z', fill: c.tc }, { d: ell(62, 17, 1.7), fill: c.td }] },
  { id: 'beret', name: 'Fransız beresi', sex: 'k', front: (c) => [{ d: 'M28.5 28C26 18 38 10.5 52 11C66 11.5 75 18 70.5 26.5C64 24 40 24 28.5 28Z', fill: c.tc }, { d: ell(51, 10.6, 1.3, 1), fill: c.td }, { d: 'M29.4 26.6C40 23.4 62 23.4 70.2 25.6', stroke: c.td, w: 0.9, pw: 2.1 }] },
  { id: 'kasket', name: 'Kasket', sex: 'e', front: (c) => [{ d: 'M29.5 32C29 20 38 13.5 51 13.5C63 13.5 71.5 19 71 29C66 31 38 33 29.5 32Z', fill: c.tc }, { d: 'M30 30.6C40 28.6 58 28 70.6 28.4C71.6 30.2 70 32.4 66 33.2C54 34.6 38 34.6 30 33Z', fill: c.td }] },
  { id: 'kulaklik', name: 'Kulaklık', hidesEars: true, front: (c) => [{ d: 'M30 47C27 13 73 13 70 47', stroke: c.tc, w: 3.2, pw: 4.2 }, { d: ell(29.5, 50, 3.8, 6.2) + ell(70.5, 50, 3.8, 6.2), fill: c.td }, { d: ell(31.6, 50, 1.4, 4.4) + ell(68.4, 50, 1.4, 4.4), fill: tint(c.td, 0.18) }] },
  { id: 'mezuniyet', name: 'Mezuniyet', front: (c) => [{ d: 'M35 22L65 22L65.5 31C58 29 42 29 34.5 31Z', fill: c.td }, { d: 'M22 19L50 9.5L78 19L50 28.5Z', fill: c.tc }, { d: ell(50, 19, 1.3, 0.9), fill: GOLD },
      { d: 'M50 19L69 22.5L69.5 31', stroke: GOLD, w: 0.9, pw: 2.1 }, { d: 'M68.2 31L70.8 31L71.5 36.4L67.5 36.4Z', fill: GOLD }] },
];

// ═══ Aksesuar ═══
export interface AccOpt { id: string; name: string; sex?: Sex; v: (c: Ctx) => Item[] }
export const ACCS: AccOpt[] = [
  { id: 'yok', name: 'Yok', v: () => [] },
  { id: 'yuvarlak', name: 'Yuvarlak gözlük', v: (c) => [{ d: ell(42, 48, 5, 4.8) + ell(58, 48, 5, 4.8), stroke: c.xc, w: 1.1, pw: 2.2 }, { d: 'M47 47.3Q50 45.8 53 47.3M37 47L32 46M63 47L68 46', stroke: c.xc, w: 1.1, pw: 2.2 }] },
  { id: 'kare', name: 'Kare gözlük', v: (c) => [{ d: rr(36, 43.5, 12, 9, 2.2) + rr(52, 43.5, 12, 9, 2.2), stroke: c.xc, w: 1.3, pw: 2.2 }, { d: 'M48 46.5L52 46.5M36 46.5L32 45.6M64 46.5L68 45.6', stroke: c.xc, w: 1.3, pw: 2.2 }] },
  { id: 'kedigozluk', name: 'Kedi gözlük', sex: 'k', v: (c) => [{ d: 'M35.6 44.6Q41.6 42.4 48 44.2L47.4 49.6Q42 52.8 37.4 50Z M64.4 44.6Q58.4 42.4 52 44.2L52.6 49.6Q58 52.8 62.6 50Z', stroke: c.xc, w: 1.3, pw: 2.2 }, { d: 'M35.6 44.6L34 42.6M64.4 44.6L66 42.6M48 45.6Q50 44.6 52 45.6', stroke: c.xc, w: 1.3, pw: 2.2 }] },
  { id: 'yarim', name: 'Yarım çerçeve', v: (c) => [{ d: 'M36.4 44.4H47.6M52.4 44.4H63.6M47.6 45Q50 44 52.4 45', stroke: c.xc, w: 1.8, pw: 2.3 }, { d: 'M36.6 45Q36.6 51.4 42 51.4Q47.4 51.4 47.4 45M52.6 45Q52.6 51.4 58 51.4Q63.4 51.4 63.4 45', stroke: c.xc, w: 0.6, op: 0.5, pw: 2.1 }] },
  { id: 'gunes', name: 'Güneş gözlüğü', v: (c) => [{ d: rr(35.5, 43.6, 13, 8.6, 3) + rr(51.5, 43.6, 13, 8.6, 3), fill: '#1d2226' }, { d: 'M35 44.2L65 44.2M35.6 46L32 45.2M64.4 46L68 45.2', stroke: c.xc, w: 1.4, pw: 2.2 }, { d: 'M38.4 46.4L42 46.4M54.4 46.4L58 46.4', stroke: '#ffffff', w: 0.8, op: 0.35, pw: 2.1 }] },
  { id: 'kupe', name: 'Küpe', v: (c) => [{ d: ell(50 - c.cw - 0.9, 56.6, 1.6) + ell(50 + c.cw + 0.9, 56.6, 1.6), fill: c.xc }] },
  { id: 'halka', name: 'Halka küpe', sex: 'k', v: (c) => [{ d: ell(50 - c.cw - 0.6, 58.6, 2.2) + ell(50 + c.cw + 0.6, 58.6, 2.2), stroke: c.xc, w: 0.9, pw: 2.1 }] },
  { id: 'hizma', name: 'Hızma', sex: 'k', v: (c) => [{ d: 'M53.2 57A1.4 1.4 0 1 1 51.6 58.5', stroke: c.xc, w: 0.8, pw: 2.1 }] },
  { id: 'kolye', name: 'Kolye', sex: 'k', v: (c) => [{ d: `M${f(c.g.nl - 1)} 80.4Q50 88.4 ${f(c.g.nr + 1)} 80.4`, stroke: c.xc, w: 0.8, pw: 2.1 }, { d: ell(50, 86.8, 1.3), fill: c.xc }] },
  { id: 'zincir', name: 'Zincir kolye', sex: 'e', v: (c) => [{ d: `M${f(c.g.nl - 1.6)} 80.6Q50 90 ${f(c.g.nr + 1.6)} 80.6`, stroke: c.xc, w: 1.4, pw: 2.2 }] },
  { id: 'cil', name: 'Çil', v: (c) => [{ d: [ell(38, 55, 0.75), ell(40.6, 53.6, 0.75), ell(41.4, 56.4, 0.75), ell(43.2, 54.4, 0.75), ell(62, 55, 0.75), ell(59.4, 53.6, 0.75), ell(58.6, 56.4, 0.75), ell(56.8, 54.4, 0.75)].join(''), fill: '#a8643f', op: 0.6, vo: true },
      { sprite: { rows: ['.f.f', 'f...'], x0: 17, y0: 26, mirror: true, colors: { f: mix(c.skin, '#8a4a2a', 0.55) } } }] },
  { id: 'ben', name: 'Ben', v: () => [{ d: ell(57.6, 59.8, 0.75), fill: '#4a2a1e', vo: true }, { sprite: { rows: ['m'], x0: 28, y0: 28, colors: { m: '#4a2a1e' } } }] },
];

// ═══ Vücut tipine göre seçenekler ve varsayılanlar ═══
interface Opt { id: string; sex?: Sex }
export const okFor = (item: Opt, sx: Sex) => !item.sex || item.sex === sx;
const byId = <T extends Opt>(list: T[], id: string | undefined): T | undefined => list.find((x) => x.id === id);
export const sexOf = (c: Pick<AvatarV2, 'body'>): Sex => (c.body === 'kadin' ? 'k' : 'e');

export const DEFAULTS: Record<Sex, AvatarV2> = {
  e: { v: 2, style: 'normal', body: 'erkek', build: 'e-orta', face: 'oval', skin: SKIN[3], bg: BG[0], hair: 'kisa', hairColor: HAIRC[1], eyes: 'yuvarlak', eyeColor: EYEC[0], brows: 'dogal', nose: 'kucuk', mouth: 'gulumseme', lip: LIPC[0],
    beard: 'yok', beardColor: HAIRC[1], makeup: 'yok', makeupColor: MAKEC[0], outfit: 'tisort', outfitColor: OUTC[0], accent: ACCENT[0], hat: 'yok', hatColor: OUTC[12], acc: 'yok', accColor: ACCC[0] },
  k: { v: 2, style: 'normal', body: 'kadin', build: 'k-orta', face: 'oval', skin: SKIN[3], bg: BG[0], hair: 'uzun', hairColor: HAIRC[1], eyes: 'yuvarlak', eyeColor: EYEC[0], brows: 'dogal', nose: 'kucuk', mouth: 'gulumseme', lip: LIPC[0],
    beard: 'yok', beardColor: HAIRC[1], makeup: 'yok', makeupColor: MAKEC[0], outfit: 'bluz', outfitColor: OUTC[0], accent: ACCENT[0], hat: 'yok', hatColor: OUTC[12], acc: 'yok', accColor: ACCC[0] },
};

const SEXED: [keyof AvatarV2, Opt[]][] = [['hair', HAIR], ['eyes', EYES], ['brows', BROWS], ['mouth', MOUTHS], ['outfit', OUTFITS], ['hat', HATS], ['acc', ACCS]];
const PLAIN: [keyof AvatarV2, Opt[]][] = [['face', FACES], ['nose', NOSES], ['beard', BEARDS], ['makeup', MAKEUP]];

// Eksik ya da bilinmeyen alanları tamamlar; vücut tipine uymayan seçimleri o tipin
// varsayılanına çeker. Genişlik öbür tipe aitse en yakın karşılığa geçer. Kadında
// sakal, erkekte makyaj sıfırlanır. Kayıt okunurken ve tip değişince çağrılır.
export function normalize(input: Partial<AvatarV2> | null | undefined): AvatarV2 {
  const body = input?.body === 'kadin' ? 'kadin' : 'erkek';
  const sx: Sex = body === 'kadin' ? 'k' : 'e';
  const def = DEFAULTS[sx];
  const out: AvatarV2 = { ...def, ...(input || {}), v: 2, body } as AvatarV2;
  if (out.style !== 'piksel') out.style = 'normal';
  for (const k of ['skin', 'bg', 'hairColor', 'eyeColor', 'lip', 'beardColor', 'makeupColor', 'outfitColor', 'accent', 'hatColor', 'accColor'] as const) {
    if (typeof out[k] !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(out[k])) out[k] = def[k];
  }
  const build = byId(BUILDS, out.build);
  if (!build || build.sex !== sx) {
    const r = build ? build.rank : 2; let best: BuildOpt | undefined;
    for (const b of BUILDS) if (b.sex === sx && (!best || Math.abs(b.rank - r) < Math.abs(best.rank - r))) best = b;
    out.build = best!.id;
  }
  for (const [k, list] of SEXED) { const it = byId(list, out[k] as string); if (!it || !okFor(it, sx)) (out as unknown as Record<string, string>)[k] = def[k] as string; }
  for (const [k, list] of PLAIN) if (!byId(list, out[k] as string)) (out as unknown as Record<string, string>)[k] = def[k] as string;
  if (sx === 'k') out.beard = 'yok'; else out.makeup = 'yok';
  return out;
}

// Rastgele avatar: şapka %25, aksesuar %30, erkekte sakal %45, kadında makyaj %50.
export function randomConfig(rand: () => number = Math.random, style: Style = 'normal'): AvatarV2 {
  const pick = <T>(a: T[]) => a[Math.floor(rand() * a.length)];
  const sx: Sex = rand() < 0.5 ? 'k' : 'e';
  const ok = <T extends Opt>(list: T[]) => list.filter((x) => okFor(x, sx));
  const some = <T extends Opt>(list: T[], p: number) => (rand() < p ? pick(ok(list).filter((x) => x.id !== 'yok')).id : 'yok');
  return normalize({
    style, body: sx === 'k' ? 'kadin' : 'erkek', build: pick(BUILDS.filter((b) => b.sex === sx)).id, face: pick(FACES).id, skin: pick(SKIN), bg: pick(BG),
    hair: pick(ok(HAIR)).id, hairColor: pick(HAIRC), eyes: pick(ok(EYES)).id, eyeColor: pick(EYEC), brows: pick(ok(BROWS)).id, nose: pick(NOSES).id,
    mouth: pick(ok(MOUTHS)).id, lip: pick(LIPC), beard: sx === 'e' ? some(BEARDS, 0.45) : 'yok', beardColor: pick(HAIRC),
    makeup: sx === 'k' ? some(MAKEUP, 0.5) : 'yok', makeupColor: pick(MAKEC), outfit: pick(ok(OUTFITS)).id, outfitColor: pick(OUTC), accent: pick(ACCENT),
    hat: some(HATS, 0.25), hatColor: pick(OUTC), acc: some(ACCS, 0.3), accColor: pick(ACCC),
  });
}

// ═══ Tarifi katmanlara çevir ═══
// Sıra: zemin → kapüşon → arka saç → omuz → boyun → kıyafet → başörtüsü → kulak → baş →
// gölge/allık/makyaj → sakal → burun → ağız → göz → eyeliner → kaş → ön saç → şapka → aksesuar
export interface Art { layers: Layer[]; ctx: Ctx; browColor: string; cfg: AvatarV2 }
export function art(input: Partial<AvatarV2> | null | undefined): Art {
  const cfg = normalize(input);
  const face = byId(FACES, cfg.face)!, hair = byId(HAIR, cfg.hair)!, hat = byId(HATS, cfg.hat)!, out = byId(OUTFITS, cfg.outfit)!;
  const p = face.p, cw = p[3], g = bodyGeom(byId(BODIES, cfg.body)!, byId(BUILDS, cfg.build)!);
  const c: Ctx = {
    skin: cfg.skin, ds: warmShade(cfg.skin, 0.16), dds: warmShade(cfg.skin, 0.3),
    hc: cfg.hairColor, hs: shade(cfg.hairColor, 0.25), hl: tint(cfg.hairColor, 0.3),
    bc: cfg.beardColor, bs: shade(cfg.beardColor, 0.22), ec: cfg.eyeColor, lc: cfg.lip,
    oc: cfg.outfitColor, od: shade(cfg.outfitColor, 0.2), ac: cfg.accent,
    tc: cfg.hatColor, td: shade(cfg.hatColor, 0.22), xc: cfg.accColor, mc: cfg.makeupColor, cw, g,
  };
  const L: Layer[] = [];
  const add = (grp: Group, items: Item[]) => { for (const it of items) L.push({ ...it, g: it.g || grp } as Layer); };
  const head = smoothClosed(headPts(p));
  add('bg', [{ d: 'M0 0H100V100H0Z', fill: cfg.bg }]);
  if (out.back) add('outfit', out.back(g, c));
  if (hair.back && !hat.hidesHair) add('hair', hair.back(c));
  add('skin', [{ d: g.body, fill: c.skin }, { d: g.neck, fill: c.skin }, { d: ell(50, p[9] - 1, g.n + 6, 7.5), fill: c.ds, clip: g.neck, g: 'shade' }]);
  add('outfit', out.front(g, c));
  if (g.fem && !out.open) add('outfit', [{ d: `M${f(50 - g.S * 0.62)} 97.6Q${f(50 - g.S * 0.32)} 100.8 50 98.8Q${f(50 + g.S * 0.32)} 100.8 ${f(50 + g.S * 0.62)} 97.6`, stroke: c.od, w: 0.9, op: 0.35, pw: 2.1, clip: g.body }]);
  if (hat.back) add('hat', hat.back(c));
  if (!hat.hidesEars) for (const s of [-1, 1]) add('skin', [{ d: ell(50 + s * (cw - 0.6), 50.5, 3, 4.6), fill: c.skin }, { d: ell(50 + s * (cw + 0.5), 50.5, 1.3, 2.6), fill: c.ds, g: 'shade' }]);
  add('skin', [{ d: head, fill: c.skin }]);
  add('shade', [{ d: ell(50 + cw + 7, p[4] + 4, 9.5, 30), fill: c.ds, op: 0.55, clip: head }, { d: ell(40.5, 57, 3.6, 2.2) + ell(59.5, 57, 3.6, 2.2), fill: '#ff6f6f', op: 0.2 }]);
  const mk = byId(MAKEUP, cfg.makeup)!;
  if (mk.pre) add('shade', mk.pre(c));
  add('hair', byId(BEARDS, cfg.beard)!.v(c));
  const feat = (items: Paint[]) => add('feat', items.map((x) => ({ ...x, vo: true })));
  L.push({ marker: 'nose', g: 'feat' }); feat(byId(NOSES, cfg.nose)!.v(c));
  L.push({ marker: 'mouth', g: 'feat' }); feat(byId(MOUTHS, cfg.mouth)!.v(c));
  L.push({ marker: 'eyes', g: 'feat' });
  const eyes = byId(EYES, cfg.eyes)!;
  for (const s of [-1, 1]) feat(eyes.v(50 + s * 8, 48, s, c));
  if (mk.post) add('feat', mk.post(c));
  L.push({ marker: 'brows', g: 'feat' });
  const browColor = shade(cfg.hair === 'yok' ? cfg.beardColor : cfg.hairColor, 0.15);
  const brows = byId(BROWS, cfg.brows)!;
  for (const s of [-1, 1]) { const b = brows.v(50 + s * 8, -s); feat([{ d: b.d, stroke: browColor, w: b.w }]); }
  if (!hat.hidesHair) add('hair', hair.front(c));
  if (hat.front) add('hat', hat.front(c));
  add('acc', byId(ACCS, cfg.acc)!.v(c));
  return { layers: L, ctx: c, browColor, cfg };
}

// ═══ Normal çizim ═══ Platformdan bağımsız: web <path>, mobil react-native-svg <Path> basar.
// `nodes`: ardışık aynı boyalı yollar tek düğüme birleştirilebileceği için tahmini düğüm sayısı.
export interface VectorPath { d: string; fill?: string; stroke?: string; w?: number; op?: number; clip?: string }
export function vectorPaths(input: Partial<AvatarV2> | null | undefined): { paths: VectorPath[]; nodes: number } {
  const paths: VectorPath[] = []; let nodes = 0, prev = '';
  for (const l of art(input).layers) {
    if (!('d' in l)) continue;
    const vp: VectorPath = { d: l.d };
    if (l.fill) vp.fill = l.fill; else { vp.stroke = l.stroke; vp.w = l.w; }
    if (l.op != null && l.op < 1) vp.op = l.op;
    if (l.clip) vp.clip = l.clip;
    paths.push(vp);
    const key = `${vp.fill}|${vp.stroke}|${vp.w}|${vp.op}`;
    if (vp.clip) nodes += 2; else if (key !== prev) nodes++;
    prev = vp.clip ? '' : key;
  }
  return { paths, nodes };
}

// Listeleme için: vücut tipine açık seçenekler.
export const optionsFor = <T extends Opt>(list: T[], sx: Sex) => list.filter((x) => okFor(x, sx));
