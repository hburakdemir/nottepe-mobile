#!/usr/bin/env node
// Kampüs haritası veri hattı — mobil ve web'in TEK kaynağı.
//
//   node scripts/campus-map/build.mjs            # önbellekten üret
//   node scripts/campus-map/build.mjs --refresh  # Overpass'tan yeniden çek
//
// Çıktı: src/data/campusMap/<kampüs>.json (mobil) ve web istemcisinin
// src/data/campusMap/<kampüs>.json'u (NOTTEPE_WEB_CLIENT ile değiştirilebilir;
// varsayılan ../fs/nottepe/nottepe/client). İki taraf AYNI dosyayı alıyor —
// elle düzenleme yok, her şey pois.source.mjs + OSM'den türüyor.
//
// Neden çalışma anında değil de burada hesaplanıyor: yürüme rotası (Dijkstra)
// ve 130 güzergâhının kesilmesi bir kez yapılınca uygulama tamamen çevrimdışı
// çalışıyor ve cihazın JS thread'ine hiç yük binmiyor (bkz. AGENTS.md'deki
// JS-thread gerilemesi; harita ekranı ona bir kalem daha eklememeli).
//
// Koordinatlar METRE: her kampüs kendi sınır kutusunun kuzeybatı köşesine göre
// düz (equirectangular) projeksiyonla x→doğu, y→güney. Kampüs ölçeğinde
// (≤ 3 km) bozulma santimetre düzeyinde; ölçek çubuğu ve mesafeler doğrudan
// birim okunuyor. Sokak modu (MapLibre) için `projection` ile geri çevrilir.

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CAMPUSES, CATEGORIES } from './pois.source.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '../..');
const CACHE_DIR = path.join(HERE, 'cache');
const MOBILE_OUT = path.join(REPO, 'src/data/campusMap');
const WEB_CLIENT = process.env.NOTTEPE_WEB_CLIENT ?? path.resolve(REPO, '../fs/nottepe/nottepe/client');
const WEB_OUT = path.join(WEB_CLIENT, 'src/data/campusMap');
const REFRESH = process.argv.includes('--refresh');

// Ana sunucu sık sık 504/429 veriyor; denemeler aynalar arasında dönüyor.
const OVERPASS = ['https://overpass-api.de/api/interpreter', 'https://overpass.private.coffee/api/interpreter', 'https://maps.mail.ru/osm/tools/overpass/api/interpreter'];
// Overpass User-Agent'sız isteği 406 ile reddediyor.
const UA = 'nottepe-campus-map/1.0 (+https://nottepe.com)';

const WALK_M_PER_MIN = 75;
// Sadeleştirme toleransları (metre).
const EPS = { bld: 0.5, area: 1.0, line: 0.8, route: 0.5, shape: 0.3 };
// Sınır kutusu dışında bu kadar metreye kadar çizgi devam ediyor (kenarda
// yolların aniden kesilmemesi için).
const CLIP_MARGIN = 120;

// ————————————————————————————————————————————— Overpass

async function overpass(name, query) {
  // Önbellek sorgu metnine bağlı: pois.source.mjs değişince eski yanıt okunmasın.
  const hash = crypto.createHash('sha1').update(query).digest('hex').slice(0, 8);
  const file = path.join(CACHE_DIR, `${name}-${hash}.json`);
  if (!REFRESH && fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'));
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  for (let attempt = 1; attempt <= 6; attempt++) {
    const url = OVERPASS[(attempt - 1) % OVERPASS.length];
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'data=' + encodeURIComponent(query),
    });
    const text = await res.text();
    if (res.ok && text.trimStart().startsWith('{')) {
      fs.writeFileSync(file, text);
      console.log(`  ↓ ${name} (${(text.length / 1024).toFixed(0)} KB)`);
      return JSON.parse(text);
    }
    console.warn(`  ! ${name}: ${new URL(url).host} HTTP ${res.status}, ${attempt}. deneme`);
    await new Promise((r) => setTimeout(r, 5000 * attempt));
  }
  throw new Error(`Overpass isteği başarısız: ${name}`);
}

const bboxStr = (b) => `${b.s},${b.w},${b.n},${b.e}`;

// ————————————————————————————————————————————— Geometri

function makeProjection(b) {
  const lat0 = (b.s + b.n) / 2;
  const kx = Math.cos((lat0 * Math.PI) / 180) * 111320;
  const ky = 110540;
  return {
    kx,
    ky,
    west: b.w,
    north: b.n,
    width: (b.e - b.w) * kx,
    height: (b.n - b.s) * ky,
    P: (lat, lon) => [(lon - b.w) * kx, (b.n - lat) * ky],
  };
}

const r1 = (v) => Math.round(v * 10) / 10;
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const polyLen = (pts) => pts.reduce((s, p, i) => (i ? s + dist(pts[i - 1], p) : 0), 0);

function douglasPeucker(pts, eps) {
  if (pts.length < 3) return pts.slice();
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    const [x1, y1] = pts[a];
    const [x2, y2] = pts[b];
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy);
    let idx = -1;
    let max = 0;
    for (let i = a + 1; i < b; i++) {
      const [x, y] = pts[i];
      const d = len === 0 ? Math.hypot(x - x1, y - y1) : Math.abs(dy * x - dx * y + x2 * y1 - y2 * x1) / len;
      if (d > max) {
        max = d;
        idx = i;
      }
    }
    if (max > eps && idx > 0) {
      keep[idx] = 1;
      stack.push([a, idx], [idx, b]);
    }
  }
  return pts.filter((_, i) => keep[i]);
}

// Kapalı halka: ilk=son noktada DP çizgiyi tek noktaya çökertir. Halkayı
// başlangıca en uzak noktadan ikiye bölüp iki yarıyı ayrı sadeleştiriyoruz.
function simplifyRing(ring, eps) {
  const open = dist(ring[0], ring[ring.length - 1]) < 1e-9 ? ring.slice(0, -1) : ring.slice();
  if (open.length < 4) return open;
  let far = 0;
  for (let i = 1; i < open.length; i++) if (dist(open[i], open[0]) > dist(open[far], open[0])) far = i;
  const a = douglasPeucker(open.slice(0, far + 1), eps);
  const b = douglasPeucker([...open.slice(far), open[0]], eps);
  return [...a.slice(0, -1), ...b.slice(0, -1)];
}

const fmtPts = (pts) => pts.map(([x, y]) => `${r1(x)} ${r1(y)}`).join('L');
const linePath = (pts) => 'M' + fmtPts(pts);
const ringPath = (pts) => 'M' + fmtPts(pts) + 'Z';

function insideBox(p, w, h, m) {
  return p[0] >= -m && p[1] >= -m && p[0] <= w + m && p[1] <= h + m;
}

// Çizgiyi genişletilmiş kutunun içinde kalan parçalara böl.
function clipLine(pts, proj) {
  const inside = pts.map((p) => insideBox(p, proj.width, proj.height, CLIP_MARGIN));
  const runs = [];
  let cur = [];
  for (let i = 0; i < pts.length; i++) {
    if (inside[i] || inside[i - 1] || inside[i + 1]) cur.push(pts[i]);
    else if (cur.length) {
      runs.push(cur);
      cur = [];
    }
  }
  if (cur.length) runs.push(cur);
  return runs.filter((r) => r.length >= 2);
}

// Multipolygon üyelerini uç uca ekleyip kapalı halkalar kur.
function assembleRings(lines) {
  const pool = lines.map((l) => l.slice());
  const rings = [];
  const same = (a, b) => a[0] === b[0] && a[1] === b[1];
  while (pool.length) {
    let ring = pool.shift();
    let grew = true;
    while (!same(ring[0], ring[ring.length - 1]) && grew) {
      grew = false;
      for (let i = 0; i < pool.length; i++) {
        const l = pool[i];
        const end = ring[ring.length - 1];
        if (same(l[0], end)) ring = ring.concat(l.slice(1));
        else if (same(l[l.length - 1], end)) ring = ring.concat(l.slice(0, -1).reverse());
        else continue;
        pool.splice(i, 1);
        grew = true;
        break;
      }
    }
    if (ring.length >= 4) rings.push(ring);
  }
  return rings;
}

function ringArea(r) {
  let a = 0;
  for (let i = 0; i < r.length; i++) {
    const [x1, y1] = r[i];
    const [x2, y2] = r[(i + 1) % r.length];
    a += x1 * y2 - x2 * y1;
  }
  return a / 2;
}

function ringCentroid(r) {
  const A = ringArea(r);
  if (Math.abs(A) < 1e-6) {
    const n = r.length;
    return [r.reduce((s, p) => s + p[0], 0) / n, r.reduce((s, p) => s + p[1], 0) / n];
  }
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < r.length; i++) {
    const [x1, y1] = r[i];
    const [x2, y2] = r[(i + 1) % r.length];
    const f = x1 * y2 - x2 * y1;
    cx += (x1 + x2) * f;
    cy += (y1 + y2) * f;
  }
  return [cx / (6 * A), cy / (6 * A)];
}

// Bir öğeyi (way/relation) projeksiyonlu halkalara çevir. Way kapalı değilse null.
function elementRings(el, proj) {
  const toPts = (geom) => geom.map((g) => [g.lat, g.lon]);
  if (el.type === 'way' && el.geometry) {
    const g = toPts(el.geometry);
    const closed = g.length >= 4 && g[0][0] === g[g.length - 1][0] && g[0][1] === g[g.length - 1][1];
    if (!closed) return null;
    return { outer: [g.map((p) => proj.P(...p))], inner: [] };
  }
  if (el.type === 'relation' && el.members) {
    const by = (role) => el.members.filter((m) => m.type === 'way' && m.geometry && (m.role || 'outer') === role).map((m) => toPts(m.geometry));
    const outer = assembleRings(by('outer')).map((r) => r.map((p) => proj.P(...p)));
    const inner = assembleRings(by('inner')).map((r) => r.map((p) => proj.P(...p)));
    return outer.length ? { outer, inner } : null;
  }
  return null;
}

// ————————————————————————————————————————————— Katman sınıflandırması

const MAJOR = new Set(['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'motorway_link', 'trunk_link', 'primary_link', 'secondary_link', 'tertiary_link']);
const MINOR = new Set(['residential', 'service', 'unclassified', 'living_street', 'pedestrian', 'track', 'road']);
const FOOT = new Set(['footway', 'path', 'steps', 'cycleway', 'bridleway', 'corridor']);
const GREEN_LANDUSE = new Set(['grass', 'forest', 'meadow', 'recreation_ground', 'village_green', 'orchard', 'cemetery']);
const GREEN_LEISURE = new Set(['park', 'garden', 'nature_reserve']);
const GREEN_NATURAL = new Set(['wood', 'scrub', 'grassland', 'heath']);
const PITCH_LEISURE = new Set(['pitch', 'track', 'sports_centre', 'stadium']);

// Yürüme grafiğine giren yollar; ana caddelerde kaldırım olsa da patikayı
// tercih etsin diye hafif ceza.
const WALK = new Map([
  ...[...FOOT].map((k) => [k, 1]),
  ...[...MINOR].map((k) => [k, 1]),
  ...['tertiary', 'secondary', 'tertiary_link', 'secondary_link'].map((k) => [k, 1.15]),
  ...['primary', 'primary_link'].map((k) => [k, 1.3]),
]);

function classifyArea(t) {
  if (t.building || t['building:part']) return 'bld';
  if (t.amenity === 'university' && /hacettepe/i.test(t.name ?? '')) return 'campus';
  if (PITCH_LEISURE.has(t.leisure)) return 'pitch';
  if (t.natural === 'water' || t.water) return 'water';
  if (GREEN_LEISURE.has(t.leisure) || GREEN_LANDUSE.has(t.landuse) || GREEN_NATURAL.has(t.natural)) return 'green';
  return null;
}

function classifyLine(t) {
  if (t.highway && t.area !== 'yes') {
    if (MAJOR.has(t.highway)) return 'major';
    if (MINOR.has(t.highway)) return 'minor';
    if (FOOT.has(t.highway)) return 'foot';
  }
  if (t.railway === 'subway') return 'subway';
  if (t.railway === 'rail' || t.railway === 'light_rail') return 'rail';
  return null;
}

// ————————————————————————————————————————————— Yürüme grafiği

class MinHeap {
  constructor() {
    this.a = [];
  }
  push(k, v) {
    const a = this.a;
    a.push([k, v]);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (a[p][0] <= a[i][0]) break;
      [a[p], a[i]] = [a[i], a[p]];
      i = p;
    }
  }
  pop() {
    const a = this.a;
    const top = a[0];
    const last = a.pop();
    if (a.length) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < a.length && a[l][0] < a[m][0]) m = l;
        if (r < a.length && a[r][0] < a[m][0]) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i], a[m]];
        i = m;
      }
    }
    return top;
  }
  get size() {
    return this.a.length;
  }
}

function buildWalkGraph(elements, proj) {
  const xy = new Map(); // osm node id → [x, y]
  const adj = new Map(); // id → [[id, cost, len]]
  const link = (a, b, f) => {
    const len = dist(xy.get(a), xy.get(b));
    if (!adj.has(a)) adj.set(a, []);
    if (!adj.has(b)) adj.set(b, []);
    adj.get(a).push([b, len * f, len]);
    adj.get(b).push([a, len * f, len]);
  };
  for (const el of elements) {
    if (el.type !== 'way' || !el.nodes || !el.geometry) continue;
    const t = el.tags ?? {};
    const f = WALK.get(t.highway);
    if (!f || t.area === 'yes') continue;
    if (['no', 'private'].includes(t.access) && t.foot !== 'yes') continue;
    if (t.foot === 'no') continue;
    el.nodes.forEach((id, i) => xy.set(id, proj.P(el.geometry[i].lat, el.geometry[i].lon)));
    for (let i = 1; i < el.nodes.length; i++) link(el.nodes[i - 1], el.nodes[i], f);
  }
  // En büyük bağlı bileşen dışındaki kopuk parçalar (bina içi koridorlar,
  // haritalanmamış bağlantılar) rotayı "ulaşılamaz" düğüme bağlamasın.
  const comp = new Map();
  let best = null;
  let bestSize = 0;
  for (const id of adj.keys()) {
    if (comp.has(id)) continue;
    const stack = [id];
    comp.set(id, id);
    let size = 0;
    while (stack.length) {
      const u = stack.pop();
      size++;
      for (const [v] of adj.get(u)) if (!comp.has(v)) comp.set(v, id), stack.push(v);
    }
    if (size > bestSize) (bestSize = size), (best = id);
  }
  const main = [...adj.keys()].filter((id) => comp.get(id) === best).sort((a, b) => a - b);
  return { xy, adj, main };
}

function nearestNode(graph, p) {
  let bestId = null;
  let bestD = Infinity;
  for (const id of graph.main) {
    const d = dist(graph.xy.get(id), p);
    if (d < bestD) (bestD = d), (bestId = id);
  }
  return { id: bestId, d: bestD };
}

function dijkstra(graph, src) {
  const cost = new Map([[src, 0]]);
  const prev = new Map();
  const h = new MinHeap();
  h.push(0, src);
  while (h.size) {
    const [c, u] = h.pop();
    if (c > cost.get(u)) continue;
    for (const [v, w] of graph.adj.get(u)) {
      const nc = c + w;
      if (nc < (cost.get(v) ?? Infinity)) {
        cost.set(v, nc);
        prev.set(v, u);
        h.push(nc, v);
      }
    }
  }
  return { cost, prev };
}

// Bir başlangıç noktasından POI'ye yürüme rotası. Hedef: POI şeklinin
// köşelerinden (bina kapısının yaklaşığı) grafiğe en ucuz bağlanan nokta.
function walkRoute(graph, tree, startPt, startNode, poi) {
  const targets = poi.ring ?? [[poi.x, poi.y]];
  let best = null;
  for (const v of targets) {
    const n = nearestNode(graph, v);
    const c = tree.cost.get(n.id);
    if (c === undefined) continue;
    const total = c + n.d;
    if (!best || total < best.total) best = { total, node: n.id, v };
  }
  if (!best) return null;
  const chain = [best.node];
  while (chain[chain.length - 1] !== startNode) chain.push(tree.prev.get(chain[chain.length - 1]));
  const pts = [startPt, ...chain.reverse().map((id) => graph.xy.get(id)), best.v];
  return { pts, m: polyLen(pts) };
}

// ————————————————————————————————————————————— Otobüs güzergâhı

function chainRoute(rel, proj) {
  const ways = rel.members.filter((m) => m.type === 'way' && m.geometry).map((m) => m.geometry.map((g) => proj.P(g.lat, g.lon)));
  const near = (a, b) => dist(a, b) < 1;
  let line = ways[0].slice();
  if (near(line[0], ways[1][0]) || near(line[0], ways[1][ways[1].length - 1])) line.reverse();
  for (const w of ways.slice(1)) {
    const end = line[line.length - 1];
    if (dist(end, w[0]) <= dist(end, w[w.length - 1])) line = line.concat(w.slice(1));
    else line = line.concat(w.slice().reverse().slice(1));
  }
  return line;
}

// `from` indeksinden itibaren p'ye en yakın segment üzerindeki izdüşüm.
function projectOnLine(line, p, from = 0) {
  let best = null;
  for (let i = from; i < line.length - 1; i++) {
    const [ax, ay] = line[i];
    const [bx, by] = line[i + 1];
    const dx = bx - ax;
    const dy = by - ay;
    const l2 = dx * dx + dy * dy || 1e-9;
    const t = Math.max(0, Math.min(1, ((p[0] - ax) * dx + (p[1] - ay) * dy) / l2));
    const q = [ax + t * dx, ay + t * dy];
    const d = dist(q, p);
    if (!best || d < best.d - 1e-6) best = { i, q, d };
  }
  return best;
}

const sliceLine = (line, a, b) => [a.q, ...line.slice(a.i + 1, b.i + 1), b.q];

// ————————————————————————————————————————————— Kampüs

async function buildCampus(c) {
  console.log(`\n${c.name}`);
  const proj = makeProjection(c.bbox);
  const B = bboxStr(c.bbox);
  const base = await overpass(
    `${c.key}-base`,
    `[out:json][timeout:180];(way["building"](${B});relation["building"](${B});way["highway"](${B});way["leisure"](${B});relation["leisure"](${B});way["landuse"](${B});way["natural"](${B});way["railway"~"^(rail|subway|light_rail)$"](${B});way["amenity"="university"](${B});relation["amenity"="university"](${B}););out body geom;`,
  );

  const refs = new Set(c.pois.map((p) => p.osm));
  const tr = c.transit;
  if (tr.kind === 'bus') {
    refs.add(tr.line.board.osm);
    refs.add(tr.line.tripFrom);
    tr.line.alight.forEach((s) => refs.add(s.osm));
  } else tr.origins.forEach((o) => refs.add(o.osm));
  const ids = { node: [], way: [], relation: [] };
  for (const r of refs) {
    const [type, id] = r.split('/');
    ids[type].push(id);
  }
  const refQuery = Object.entries(ids)
    .filter(([, v]) => v.length)
    .map(([t, v]) => `${t === 'relation' ? 'rel' : t}(id:${v.sort().join(',')});`)
    .join('');
  const refData = await overpass(`${c.key}-refs`, `[out:json][timeout:120];(${refQuery});out body geom;`);
  const byRef = new Map(refData.elements.map((e) => [`${e.type}/${e.id}`, e]));
  const missing = [...refs].filter((r) => !byRef.has(r));
  if (missing.length) throw new Error(`OSM'de bulunamayan referans(lar): ${missing.join(', ')}`);
  const refPoint = (r) => {
    const e = byRef.get(r);
    if (e.type === 'node') return proj.P(e.lat, e.lon);
    const rings = elementRings(e, proj);
    if (rings) return ringCentroid(rings.outer[0]);
    const g = e.geometry ?? e.members.flatMap((m) => m.geometry ?? []);
    return proj.P(g.reduce((s, p) => s + p.lat, 0) / g.length, g.reduce((s, p) => s + p.lon, 0) / g.length);
  };

  // — Katmanlar
  const L = { campus: [], green: [], water: [], pitch: [], foot: [], minor: [], major: [], rail: [], subway: [], corridor: [], busLine: [], bld: [] };
  const sortedEls = base.elements.slice().sort((a, b) => (a.type === b.type ? a.id - b.id : a.type < b.type ? -1 : 1));
  for (const el of sortedEls) {
    const t = el.tags ?? {};
    const area = classifyArea(t);
    if (area) {
      const rings = elementRings(el, proj);
      if (rings) {
        const all = [...rings.outer, ...rings.inner];
        if (!all.some((r) => r.some((p) => insideBox(p, proj.width, proj.height, CLIP_MARGIN)))) continue;
        const eps = area === 'bld' ? EPS.bld : EPS.area;
        for (const r of all) {
          const s = simplifyRing(r, eps);
          if (s.length >= 3) L[area].push(ringPath(s));
        }
        continue;
      }
    }
    const line = classifyLine(t);
    if (line && el.type === 'way' && el.geometry) {
      const pts = el.geometry.map((g) => proj.P(g.lat, g.lon));
      for (const run of clipLine(pts, proj)) L[line].push(linePath(douglasPeucker(run, EPS.line)));
    }
  }

  if (c.corridor) {
    const cor = await overpass(
      `${c.key}-corridor`,
      `[out:json][timeout:120];(way["highway"~"^(motorway|trunk|primary|secondary|tertiary)(_link)?$"](${bboxStr(c.corridor)});way["railway"="subway"](${bboxStr(c.corridor)}););out body geom;`,
    );
    for (const el of cor.elements.slice().sort((a, b) => a.id - b.id)) {
      const pts = douglasPeucker(el.geometry.map((g) => proj.P(g.lat, g.lon)), EPS.line * 2);
      // Kampüs kutusunun içindeki parçalar zaten ana katmanlarda.
      if (pts.every((p) => insideBox(p, proj.width, proj.height, 0))) continue;
      (el.tags.railway === 'subway' ? L.subway : L.corridor).push(linePath(pts));
    }
  }

  // — Noktalar
  const pois = c.pois.map((src) => {
    if (!CATEGORIES.includes(src.cat)) throw new Error(`Bilinmeyen kategori: ${src.cat} (${src.id})`);
    const el = byRef.get(src.osm);
    const out = { id: src.id, name: src.name, ...(src.short ? { short: src.short } : {}), cat: src.cat };
    let ring = null;
    let shape = null;
    let pt;
    const rings = el.type === 'node' ? null : elementRings(el, proj);
    if (rings) {
      const largest = rings.outer.slice().sort((a, b) => Math.abs(ringArea(b)) - Math.abs(ringArea(a)))[0];
      ring = simplifyRing(largest, EPS.shape);
      pt = ringCentroid(largest);
      shape = [...rings.outer, ...rings.inner].map((r) => ringPath(simplifyRing(r, EPS.shape))).join('');
    } else pt = refPoint(src.osm);
    out.x = r1(pt[0]);
    out.y = r1(pt[1]);
    out.lat = Math.round((c.bbox.n - pt[1] / proj.ky) * 1e6) / 1e6;
    out.lon = Math.round((c.bbox.w + pt[0] / proj.kx) * 1e6) / 1e6;
    if (shape) out.shape = shape;
    return { out, ring, x: pt[0], y: pt[1] };
  });

  // — Rotalar
  const graph = buildWalkGraph(base.elements, proj);
  console.log(`  yürüme grafiği: ${graph.main.length} düğüm (ana bileşen)`);
  const routes = {};
  const encode = (pts) => douglasPeucker(pts, EPS.route).flatMap(([x, y]) => [r1(x), r1(y)]);
  const walkLeg = (from, to, w) => ({
    kind: 'walk',
    from,
    to,
    m: Math.round(w.m),
    min: Math.max(1, Math.round(w.m / WALK_M_PER_MIN)),
    pts: encode(w.pts),
  });
  const place = (name, p, extra = {}) => ({ name, x: r1(p[0]), y: r1(p[1]), ...extra });
  const transit = { kind: tr.kind, options: [], stations: [], stops: [] };

  if (tr.kind === 'bus') {
    const rel = (await overpass(`${c.key}-line-${tr.line.ref}`, `[out:json][timeout:120];rel(${tr.line.relation});out body geom;`)).elements[0];
    const line = chainRoute(rel, proj);
    const tripFrom = projectOnLine(line, refPoint(tr.line.tripFrom));
    const board = projectOnLine(line, refPoint(tr.line.board.osm), tripFrom.i);
    const cum = (a, b) => polyLen(sliceLine(line, a, b));
    const minPerM = tr.line.tripMin / cum(tripFrom, board);
    L.busLine.push(linePath(douglasPeucker(line, EPS.line)));
    const boardPlace = place(tr.line.board.name, refPoint(tr.line.board.osm), { rail: tr.line.board.rail });
    transit.stations.push(boardPlace);
    transit.line = { ref: tr.line.ref, name: tr.line.name, tripMin: tr.line.tripMin };
    transit.options = tr.options;

    const stops = tr.line.alight.map((s) => {
      const p = refPoint(s.osm);
      const onLine = projectOnLine(line, p, board.i);
      const busPts = sliceLine(line, board, onLine);
      const busM = polyLen(busPts);
      const start = nearestNode(graph, p);
      return { s, p, busPts, busM, busMin: Math.max(1, Math.round(busM * minPerM)), start, tree: dijkstra(graph, start.id) };
    });
    // Otobüs parçası durak başına BİR kez saklanıyor; bacaklar `stop` indeksiyle
    // ona işaret ediyor (POI başına kopyalamak dosyayı ~2,5 katına çıkarıyordu).
    transit.stops = stops.map((st) => ({ ...place(st.s.name, st.p), busM: Math.round(st.busM), busMin: st.busMin, busPts: encode(st.busPts) }));

    for (const poi of pois) {
      const cands = stops.map((st) => ({ st, w: walkRoute(graph, st.tree, st.p, st.start.id, poi) })).filter((x) => x.w);
      if (!cands.length) throw new Error(`Rota bulunamadı: ${poi.out.id}`);
      const walkMin = (w) => Math.max(1, Math.round(w.m / WALK_M_PER_MIN));
      const byWalk = cands.slice().sort((a, b) => a.w.m - b.w.m)[0];
      const byTotal = cands.slice().sort((a, b) => a.st.busMin + walkMin(a.w) - (b.st.busMin + walkMin(b.w)) || a.w.m - b.w.m)[0];
      const dest = place(poi.out.name, [poi.x, poi.y]);
      const stopPlace = (st) => place(st.s.name, st.p, { stop: true });
      const metroLegs = [
        { kind: 'bus', line: tr.line.ref, from: boardPlace, to: stopPlace(byTotal.st), m: Math.round(byTotal.st.busM), min: byTotal.st.busMin, stop: stops.indexOf(byTotal.st) },
        walkLeg(stopPlace(byTotal.st), dest, byTotal.w),
      ];
      const stopLegs = [walkLeg(stopPlace(byWalk.st), dest, byWalk.w)];
      const sum = (legs) => ({ legs, m: legs.reduce((s, l) => s + l.m, 0), min: legs.reduce((s, l) => s + l.min, 0) });
      routes[poi.out.id] = { metro: sum(metroLegs), stop: sum(stopLegs) };
    }
  } else {
    transit.options = tr.origins.map((o) => ({ id: o.id, label: o.label }));
    const origins = tr.origins.map((o) => {
      const p = refPoint(o.osm);
      const start = nearestNode(graph, p);
      return { o, p, start, tree: dijkstra(graph, start.id), place: place(o.name, p, { rail: o.rail }) };
    });
    transit.stations = origins.map((x) => x.place);
    for (const poi of pois) {
      const dest = place(poi.out.name, [poi.x, poi.y]);
      routes[poi.out.id] = {};
      for (const og of origins) {
        const w = walkRoute(graph, og.tree, og.p, og.start.id, poi);
        if (!w) throw new Error(`Rota bulunamadı: ${poi.out.id} ← ${og.o.id}`);
        const leg = walkLeg(og.place, dest, w);
        routes[poi.out.id][og.o.id] = { legs: [leg], m: leg.m, min: leg.min };
      }
    }
  }

  const layers = Object.fromEntries(Object.entries(L).map(([k, v]) => [k, v.join('')]));
  const osmBase = base.osm3s?.timestamp_osm_base ?? null;
  const data = {
    v: 1,
    key: c.key,
    name: c.name,
    source: { name: 'OpenStreetMap', license: 'ODbL', osmBase },
    projection: { west: c.bbox.w, north: c.bbox.n, kx: Math.round(proj.kx * 1000) / 1000, ky: proj.ky },
    size: { w: Math.round(proj.width), h: Math.round(proj.height) },
    layers,
    categories: CATEGORIES.filter((k) => pois.some((p) => p.out.cat === k)),
    pois: pois.map((p) => p.out),
    transit,
    routes,
  };

  console.log(`  boyut: ${data.size.w}×${data.size.h} m · ${pois.length} nokta · OSM ${osmBase}`);
  for (const [k, v] of Object.entries(layers)) if (v) console.log(`  ${k.padEnd(9)} ${(v.length / 1024).toFixed(1).padStart(6)} KB  (${L[k].length} parça)`);
  for (const p of pois) {
    const r = routes[p.out.id];
    const desc = Object.entries(r)
      .map(([k, v]) => `${k}: ${v.legs.map((l) => `${l.kind === 'bus' ? '130' : 'yürü'} ${l.m}m`).join(' + ')} ≈${v.min}dk (${v.legs[v.legs.length - 1].from.name})`)
      .join(' | ');
    console.log(`    ${p.out.name.padEnd(40)} ${desc}`);
  }
  return data;
}

// ————————————————————————————————————————————— Ana akış

const results = [];
for (const c of CAMPUSES) results.push(await buildCampus(c));

for (const dir of [MOBILE_OUT, WEB_OUT]) {
  if (dir === WEB_OUT && !fs.existsSync(WEB_CLIENT)) {
    console.warn(`\n! Web istemcisi bulunamadı (${WEB_CLIENT}) — yalnızca mobil yazıldı.`);
    continue;
  }
  fs.mkdirSync(dir, { recursive: true });
  for (const d of results) {
    const file = path.join(dir, `${d.key}.json`);
    fs.writeFileSync(file, JSON.stringify(d) + '\n');
    console.log(`→ ${path.relative(path.resolve(REPO, '..'), file)} (${(fs.statSync(file).size / 1024).toFixed(0)} KB)`);
  }
}
