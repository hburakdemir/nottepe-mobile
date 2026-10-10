// Kampüs haritası verisi ve yardımcıları. Veri dosyaları
// scripts/campus-map/build.mjs'in çıktısı (src/data/campusMap/*.json) — web
// istemcisi AYNI dosyaları kullanıyor. Yardımcılar web'deki
// components/campusMap/campusMapUtils.js'in portu.

export type Pt = [number, number];

export interface CampusPoi {
  id: string;
  name: string;
  short?: string;
  cat: string;
  x: number;
  y: number;
  lat: number;
  lon: number;
  /** Binanın ana hatları (M/L/Z path), yoksa yalnızca nokta. */
  shape?: string;
}

export interface TransitPlace {
  name: string;
  x: number;
  y: number;
  /** İstasyonsa hat adı (M2, M1, A1). */
  rail?: string;
  stop?: boolean;
}

export interface TransitStop extends TransitPlace {
  busM?: number;
  busMin?: number;
  /** İstasyondan bu durağa otobüs güzergâhı, düz [x0, y0, x1, y1, …]. */
  busPts?: number[];
}

export interface RouteLeg {
  kind: 'bus' | 'walk';
  line?: string;
  from: TransitPlace;
  to: TransitPlace;
  m: number;
  min: number;
  /** Otobüs bacağında güzergâh `transit.stops[stop].busPts`'te. */
  stop?: number;
  pts?: number[];
}

export interface CampusRoute {
  legs: RouteLeg[];
  m: number;
  min: number;
}

export interface CampusData {
  key: string;
  name: string;
  size: { w: number; h: number };
  layers: Partial<Record<'campus' | 'green' | 'water' | 'pitch' | 'foot' | 'minor' | 'major' | 'rail' | 'subway' | 'corridor' | 'busLine' | 'bld', string>>;
  categories: string[];
  pois: CampusPoi[];
  transit: {
    kind: string;
    options: { id: string; label: string }[];
    stations: TransitPlace[];
    stops: TransitStop[];
    line?: { ref: string; tripMin: number };
  };
  /** poiId → seçenek id'si (metro/stop, m1/ankaray) → rota. */
  routes: Record<string, Record<string, CampusRoute>>;
}

export const CAMPUSES = [
  { id: 'beytepe', label: 'Beytepe' },
  { id: 'sihhiye', label: 'Sıhhiye' },
] as const;
export type CampusKey = (typeof CAMPUSES)[number]['id'];

// ~350 KB JSON: ekran açılmadan ayrıştırılmasın diye `require` fonksiyonun
// içinde (Metro modülü paketliyor ama ilk çağrıya kadar çalıştırmıyor).
const cache: Partial<Record<CampusKey, CampusData>> = {};
export function loadCampus(key: CampusKey): CampusData {
  if (!cache[key]) {
    cache[key] = (key === 'beytepe' ? require('../../data/campusMap/beytepe.json') : require('../../data/campusMap/sihhiye.json')) as CampusData;
  }
  return cache[key]!;
}

// Harita renkleri — web'deki MAP_PALETTE ile birebir.
export const MAP_PALETTE = {
  light: {
    land: '#EEF0F2',
    campus: 'rgba(47,87,85,0.05)',
    green: '#D9E6DF',
    water: '#CFE0EA',
    pitch: '#E2ECE6',
    pitchLine: '#C3D5CA',
    foot: '#C4CAD2',
    minor: '#FFFFFF',
    minorCase: '#DDE1E6',
    major: '#FFFFFF',
    majorCase: '#CFD5DC',
    rail: '#A3AAB5',
    subway: '#A3AAB5',
    busLine: 'rgba(47,87,85,0.35)',
    bld: '#FBFBFC',
    bldLine: '#CDD2D9',
    accent: '#2F5755',
    onAccent: '#FFFFFF',
    walk: '#B45309',
    halo: '#FFFFFF',
    pin: '#374151',
    label: '#111827',
    muted: '#6B7280',
  },
  dark: {
    land: '#1B2026',
    campus: 'rgba(90,150,144,0.06)',
    green: '#1C2D2E',
    water: '#1A2C38',
    pitch: '#1F302F',
    pitchLine: '#2B4643',
    foot: '#3E4752',
    minor: '#2E353F',
    minorCase: '#20262D',
    major: '#3B434E',
    majorCase: '#20262D',
    rail: '#56606C',
    subway: '#56606C',
    busLine: 'rgba(90,150,144,0.40)',
    bld: '#262C34',
    bldLine: '#3C444F',
    accent: '#5A9690',
    onAccent: '#11161C',
    walk: '#FB923C',
    halo: '#1B2026',
    pin: '#C9BBA4',
    label: '#DFD0B8',
    muted: '#9CA3AF',
  },
};
export type MapPalette = (typeof MAP_PALETTE)['light'];

// Veri dosyasındaki rotalar düz [x0, y0, x1, y1, …] dizisi.
export function pairs(flat: number[]): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < flat.length; i += 2) out.push([flat[i], flat[i + 1]]);
  return out;
}

// "M1 2L3 4Z M…" → halkalar (yalnızca build.mjs'in ürettiği M/L/Z biçimi).
export function parseRings(d: string): Pt[][] {
  return d
    .split('M')
    .filter(Boolean)
    .map((s) =>
      s
        .replace(/Z/g, '')
        .split('L')
        .map((p) => p.trim().split(/\s+/).map(Number) as Pt)
    );
}

export const fmtDistance = (m: number) => (m >= 1000 ? `${(m / 1000).toFixed(1).replace('.', ',')} km` : `${Math.round(m)} m`);

export const turkishLower = (s: string) => s.toLocaleLowerCase('tr');

export function boundsOf(points: Pt[]) {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const [x, y] of points) {
    if (x < x0) x0 = x;
    if (y < y0) y0 = y;
    if (x > x1) x1 = x;
    if (y > y1) y1 = y;
  }
  return { x0, y0, x1, y1 };
}

// Rota bacaklarının ekranda çizilecek noktaları (otobüs parçası durak başına
// bir kez saklanıyor; bkz. build.mjs).
export function legPoints(data: CampusData, leg: RouteLeg): Pt[] {
  if (leg.kind === 'bus') return pairs(data.transit.stops[leg.stop!].busPts ?? []);
  return pairs(leg.pts ?? []);
}

// Yürüme aşamasının kadrajı: çizgi + hedef binanın tamamı. Çizgi binanın
// bir köşesinde bittiği için yalnız ona göre kadrajlamak binayı kenardan
// taşırıyordu.
export function walkFrame(data: CampusData, route: CampusRoute, poiId: string): Pt[] {
  const pts = legPoints(data, route.legs[route.legs.length - 1]);
  const dest = data.pois.find((p) => p.id === poiId);
  if (!dest) return pts;
  return [...pts, [dest.x, dest.y], ...(dest.shape ? parseRings(dest.shape).flat() : [])];
}

export const placeLabel = (pl: TransitPlace) => (pl.rail ? `${pl.name} · ${pl.rail}` : `${pl.name} durağı`);
