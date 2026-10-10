import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Svg, { G, Path, Rect, type GProps } from 'react-native-svg';
import Animated, {
  Easing,
  FadeIn,
  cancelAnimation,
  runOnJS,
  useAnimatedProps,
  useAnimatedReaction,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Maximize2, Minimize2, Minus, Plus } from 'lucide-react-native';
import {
  boundsOf,
  legPoints,
  pairs,
  placeLabel,
  walkFrame as walkFrameOf,
  type CampusData,
  type CampusPoi,
  type CampusRoute,
  type MapPalette,
  type Pt,
  type TransitPlace,
} from './campusMapData';

// Çizim modu — web'deki VectorCampusMap.jsx'in portu.
//
// KAMERA UI THREAD'İNDE. SVG ekran boyutunda; dünya katmanlarının hepsi tek
// bir <G> altında ve kamera o grubun `matrix`'i (Reanimated animatedProps).
// Pinler, rozetler ve etiketler ayrı bir RN katmanında: kap kamerayla
// ölçekleniyor, her pin `1/s` ile ters ölçekleniyor, yani ekranda sabit boyda
// kalıyor (web'deki `--inv`). Jest ve uçuş sırasında React render'ı YOK —
// yalnızca etiket kademesi (lod) değişince bir render. Bu uygulamada JS
// thread'i zaten dolu (bkz. diagnostics.ts), kaydırmanın oradan geçmemesi şart.
//
// Dünya katmanını bir View transform'uyla büyütmek (web'deki gibi) burada
// olmuyor: iOS SVG'yi görünüm boyutunda bir bitmap'e çiziyor, 1623×2985 dp'lik
// bir görünüm 3x ekranda ~170 MB ve yakınlaşınca bulanık.

const MAX_SCALE = 5; // px / metre
const SELECT_SCALE = 1.4; // bir yere uçarken hedef yakınlık
const WALK_MAX_SCALE = 2; // yürüme aşamasında en fazla bu kadar yaklaş
const FLY_MS = 950;
// Rota sahnesi: önce başlangıca yaklaş, sonra otobüs noktasını takip et
// (yolda biraz uzaklaşıp durağa yaklaşırken geri gel), en son yürüme.
const START_SCALE = 1.1;
const RIDE_MIN_SCALE = 0.42;
const START_MS = 900;
const RIDE_MS = 3200;
const WALK_MS = 1500;
const WALK_FOLLOW_SCALE = 1.3;
// Telefonda kart haritanın altında; sağdaki pay yakınlaştırma düğmeleri için.
const INSETS = { top: 24, right: 64, bottom: 40, left: 24 };
const NICE_METERS = [10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000];
const FLY_EASING = Easing.bezier(0.22, 0.8, 0.24, 1);
const TAP_RADIUS = 22;

// Etiket önceliği: sığmayan etiket gizleniyor, önce bunlar yerleşiyor.
const CAT_RANK: Record<string, number> = { Kütüphane: 0, Yemek: 1, Fakülte: 2, Sağlık: 2, Yurt: 3, Kültür: 4, Spor: 5, İdari: 6, Hizmet: 7 };

interface Cam {
  s: number;
  tx: number;
  ty: number;
}

const clampN = (v: number, a: number, b: number) => {
  'worklet';
  return Math.min(b, Math.max(a, v));
};

// Bir çizgi üzerinde uzunlukla orantılı konum. Kümülatif uzunluklar bir kez
// JS'te hesaplanıp paylaşılan değere konuyor; kare başına iş UI thread'inde.
interface Tracer {
  pts: Pt[];
  cum: number[];
  total: number;
}

function makeTracer(pts: Pt[]): Tracer {
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  return { pts, cum, total: cum[cum.length - 1] || 1 };
}

function traceIndex(t: Tracer, L: number) {
  'worklet';
  let i = 1;
  while (i < t.cum.length - 1 && t.cum[i] < L) i++;
  return i;
}

function traceAt(t: Tracer, k: number): Pt {
  'worklet';
  if (t.pts.length < 2) return t.pts[0] ?? [0, 0];
  const L = k * t.total;
  const i = traceIndex(t, L);
  const seg = t.cum[i] - t.cum[i - 1] || 1;
  const f = Math.min(1, Math.max(0, (L - t.cum[i - 1]) / seg));
  return [t.pts[i - 1][0] + (t.pts[i][0] - t.pts[i - 1][0]) * f, t.pts[i - 1][1] + (t.pts[i][1] - t.pts[i - 1][1]) * f];
}

// Çizginin baştan `k` kadarı. Web strokeDashoffset + pathLength=1 ile
// çiziyordu; react-native-svg'de pathLength yok, kısmi path daha basit ve
// yürüme çizgisinin noktalı deseni de bozulmuyor.
function partialPath(t: Tracer, k: number): string {
  'worklet';
  if (t.pts.length === 0) return 'M0 0';
  let d = `M${t.pts[0][0]} ${t.pts[0][1]}`;
  if (k <= 0 || t.pts.length < 2) return d;
  const L = k * t.total;
  const i = traceIndex(t, L);
  for (let j = 1; j < i; j++) d += `L${t.pts[j][0]} ${t.pts[j][1]}`;
  const tip = traceAt(t, k);
  return d + `L${tip[0]} ${tip[1]}`;
}

// Açgözlü etiket yerleşimi (dünya koordinatında, verilen ölçek için): önce
// bütün pin noktaları engel, sonra etiketler öncelik sırasıyla sağa
// yerleşmeye çalışıyor; çakışan atlanıyor.
interface LabelItem {
  key: string;
  x: number;
  y: number;
  text: string;
  size: number;
  dx: number;
  force?: boolean;
}
function placeLabels(items: LabelItem[], dots: Pt[], s: number) {
  const boxes = dots.map(([x, y]) => ({ x0: x - 7 / s, x1: x + 7 / s, y0: y - 7 / s, y1: y + 7 / s }));
  const shown = new Set<string>();
  for (const it of items) {
    const w = (it.text.length * it.size * 0.58 + 6) / s;
    const h = (it.size + 6) / s;
    const box = { x0: it.x + it.dx / s, x1: it.x + it.dx / s + w, y0: it.y - h / 2, y1: it.y + h / 2 };
    if (!it.force && boxes.some((b) => b.x0 < box.x1 && box.x0 < b.x1 && b.y0 < box.y1 && box.y0 < b.y1)) continue;
    boxes.push(box);
    shown.add(it.key);
  }
  return shown;
}

const AnimatedG = Animated.createAnimatedComponent(G);
const AnimatedPath = Animated.createAnimatedComponent(Path);

const LINE = { fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

const Layers = memo(function Layers({ L, c }: { L: CampusData['layers']; c: MapPalette }) {
  return (
    <>
      {!!L.campus && <Path d={L.campus} fill={c.campus} />}
      {!!L.green && <Path d={L.green} fill={c.green} />}
      {!!L.water && <Path d={L.water} fill={c.water} />}
      {!!L.pitch && <Path d={L.pitch} fill={c.pitch} stroke={c.pitchLine} strokeWidth={0.8} />}
      {!!L.corridor && <Path d={L.corridor} {...LINE} stroke={c.majorCase} strokeWidth={11} />}
      {!!L.corridor && <Path d={L.corridor} {...LINE} stroke={c.major} strokeWidth={8} />}
      {!!L.subway && <Path d={L.subway} fill="none" stroke={c.subway} strokeWidth={4} strokeDasharray={[14, 8]} />}
      {!!L.rail && <Path d={L.rail} fill="none" stroke={c.rail} strokeWidth={2.5} strokeDasharray={[10, 6]} />}
      {!!L.foot && <Path d={L.foot} {...LINE} stroke={c.foot} strokeWidth={1.4} strokeDasharray={[3, 2.5]} />}
      {!!L.minor && <Path d={L.minor} {...LINE} stroke={c.minorCase} strokeWidth={6.5} />}
      {!!L.minor && <Path d={L.minor} {...LINE} stroke={c.minor} strokeWidth={4.5} />}
      {!!L.major && <Path d={L.major} {...LINE} stroke={c.majorCase} strokeWidth={11} />}
      {!!L.major && <Path d={L.major} {...LINE} stroke={c.major} strokeWidth={8} />}
      {!!L.busLine && <Path d={L.busLine} {...LINE} stroke={c.busLine} strokeWidth={2.2} strokeDasharray={[8, 5]} />}
      {!!L.bld && <Path d={L.bld} fill={c.bld} stroke={c.bldLine} strokeWidth={0.6} strokeLinejoin="round" fillRule="evenodd" />}
    </>
  );
});

// Dünya katmanında sabit ekran boyunda duran nokta: kap `s` ile büyüyor,
// bu `1/s` ile küçülüyor.
function Anchor({ x, y, inv, z = 1, children }: { x: number; y: number; inv: SharedValue<number>; z?: number; children: React.ReactNode }) {
  const st = useAnimatedStyle(() => ({ transform: [{ scale: inv.value }] }));
  return <Animated.View style={[styles.anchor, { left: x, top: y, zIndex: z }, st]}>{children}</Animated.View>;
}

const Pin = memo(function Pin({ poi, selected, label, c, inv }: { poi: CampusPoi; selected: boolean; label: string | null; c: MapPalette; inv: SharedValue<number> }) {
  return (
    <Anchor x={poi.x} y={poi.y} inv={inv} z={selected ? 3 : 1}>
      <View style={[selected ? styles.dotSel : styles.dot, { backgroundColor: selected ? c.accent : c.pin, borderColor: c.halo }]} />
      {!!label && (
        <View style={[styles.labelBox, selected && styles.labelBoxSel]}>
          <Text numberOfLines={1} style={[styles.label, selected && styles.labelSel, { color: c.label, textShadowColor: c.halo }]}>
            {label}
          </Text>
        </View>
      )}
    </Anchor>
  );
});

function BusGlyph({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round">
      <Rect x="5" y="3" width="14" height="14" rx="2" />
      <Path d="M5 10h14M8 21v-4M16 21v-4" />
    </Svg>
  );
}

function Badge({ place, kind, c, label, inv }: { place: TransitPlace; kind: 'rail' | 'stop' | 'stop-sm'; c: MapPalette; label: string | null; inv: SharedValue<number> }) {
  const rail = kind === 'rail';
  const small = kind === 'stop-sm';
  return (
    <Anchor x={place.x} y={place.y} inv={inv} z={2}>
      <View style={[small ? styles.badgeSm : styles.badge, { backgroundColor: rail ? c.label : c.accent, borderColor: c.halo }]}>
        {rail ? <Text style={[styles.badgeText, { color: c.halo }]}>M</Text> : <BusGlyph size={small ? 9 : 12} color={c.onAccent} />}
      </View>
      {!!label && (
        <View style={[styles.labelBox, { left: 16 }]}>
          <Text numberOfLines={1} style={[styles.label, { color: c.label, textShadowColor: c.halo }]}>
            {label}
          </Text>
        </View>
      )}
    </Anchor>
  );
}

// Rota üzerinde ilerleyen nokta (otobüs / yürüyen).
function Mover({ tracer, k, inv, color, halo, size }: { tracer: SharedValue<Tracer | null>; k: SharedValue<number>; inv: SharedValue<number>; color: string; halo: string; size: number }) {
  const st = useAnimatedStyle(() => {
    const t = tracer.value;
    const tip = t ? traceAt(t, k.value) : [0, 0];
    return { transform: [{ translateX: tip[0] }, { translateY: tip[1] }, { scale: inv.value }] };
  });
  return (
    <Animated.View style={[styles.anchor, { zIndex: 4 }, st]}>
      <View style={{ position: 'absolute', left: -size / 2 - 2.5, top: -size / 2 - 2.5, width: size + 5, height: size + 5, borderRadius: (size + 5) / 2, borderWidth: 2.5, borderColor: halo, backgroundColor: color }} />
    </Animated.View>
  );
}

function MapButton({ label, onPress, divider, c, children }: { label: string; onPress: () => void; divider?: boolean; c: MapPalette; children: React.ReactNode }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      // Düz stil: NativeWind'in Pressable sarmalayıcısı fonksiyon `style`'ı yutuyor
      // (düğmeler 40 yerine ~17 dp genişlikte çiziliyordu).
      style={[styles.mapBtn, divider && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.bldLine }]}
      android_ripple={{ color: c.bldLine }}
    >
      {children}
    </Pressable>
  );
}

interface Props {
  data: CampusData;
  palette: MapPalette;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  category: string;
  route: CampusRoute | null;
  routeKey: string;
  reducedMotion: boolean;
  /** Verilirse kontrol grubunun sonunda tam ekran düğmesi çıkar. */
  fullscreen?: boolean;
  onToggleFullscreen?: () => void;
  /** Tam ekranda sistem çubuklarının payı — kontroller, ölçek ve atıf onların içinde dursun. */
  safeTop?: number;
  safeBottom?: number;
  /** Haritanın altını kaplayan yüzen kartın alttan yüksekliği (tam ekran). Uçuş
   * ve rota kadrajı kartın üstünde kalan alana göre yapılıyor. */
  bottomObstruction?: number;
}

export default function VectorCampusMap({
  data,
  palette: c,
  selectedId,
  onSelect,
  category,
  route,
  routeKey,
  reducedMotion,
  fullscreen = false,
  onToggleFullscreen,
  safeTop = 0,
  safeBottom = 0,
  bottomObstruction = 0,
}: Props) {
  const W = data.size.w;
  const H = data.size.h;
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [bucket, setBucket] = useState(0);
  const [phase, setPhase] = useState<'none' | 'start' | 'bus' | 'walk' | 'done'>('none');
  const [scaleText, setScaleText] = useState('');

  // Kamera
  const s = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const inv = useDerivedValue(() => 1 / s.value);
  const sizeSV = useSharedValue({ w: 0, h: 0 });
  const minS = useSharedValue(0.05);
  const gestureStart = useSharedValue<Cam>({ s: 1, tx: 0, ty: 0 });
  const focalStart = useSharedValue({ x: 0, y: 0 });
  // Kullanıcı rota sırasında haritayı tutarsa kamera takibi bırakılıyor.
  const userMoved = useSharedValue(false);

  // Rota
  const busTr = useSharedValue<Tracer | null>(null);
  const walkTr = useSharedValue<Tracer | null>(null);
  const busK = useSharedValue(0);
  const walkK = useSharedValue(0);
  const follow = useSharedValue<0 | 1 | 2>(0); // 0 yok, 1 otobüs, 2 yürüme
  const rideScale = useSharedValue(START_SCALE);
  const walkScale = useSharedValue(WALK_FOLLOW_SCALE);
  // Kadrajın üst/alt payı: tam ekranda sistem çubukları ve yüzen kart.
  const padTop = useSharedValue(INSETS.top);
  const padBottom = useSharedValue(INSETS.bottom);
  useEffect(() => {
    padTop.value = INSETS.top + safeTop;
    padBottom.value = Math.max(INSETS.bottom + safeBottom, bottomObstruction + 16);
  }, [safeTop, safeBottom, bottomObstruction, padTop, padBottom]);

  // Kameranın kaçabileceği alan: kampüs kutusu + metroya kadar uzanan
  // güzergâh ve istasyonlar (rota uçuşu kutunun dışına çıkıyor).
  const content = useMemo(() => {
    const pts: Pt[] = [
      [0, 0],
      [W, H],
      ...data.transit.stations.map((st): Pt => [st.x, st.y]),
      ...data.transit.stops.flatMap((st) => (st.busPts ? pairs(st.busPts) : [])),
    ];
    return boundsOf(pts);
  }, [data, W, H]);

  const applyW = useCallback(
    (next: Cam, ms = 0) => {
      'worklet';
      const { w, h } = sizeSV.value;
      const sc = clampN(next.s, minS.value, MAX_SCALE);
      const m = 60;
      const nx = clampN(next.tx, m - content.x1 * sc, w - m - content.x0 * sc);
      const ny = clampN(next.ty, m - content.y1 * sc, h - m - content.y0 * sc);
      if (ms > 0) {
        const cfg = { duration: ms, easing: FLY_EASING };
        s.value = withTiming(sc, cfg);
        tx.value = withTiming(nx, cfg);
        ty.value = withTiming(ny, cfg);
      } else {
        s.value = sc;
        tx.value = nx;
        ty.value = ny;
      }
    },
    [content, s, tx, ty, sizeSV, minS]
  );

  const zoomAtW = useCallback(
    (x: number, y: number, k: number, ms = 0) => {
      'worklet';
      const s0 = s.value;
      const sc = clampN(s0 * k, minS.value, MAX_SCALE);
      const wx = (x - tx.value) / s0;
      const wy = (y - ty.value) / s0;
      applyW({ s: sc, tx: x - wx * sc, ty: y - wy * sc }, ms);
    },
    [applyW, s, tx, ty, minS]
  );

  const centerOnW = useCallback(
    (p: Pt, scale: number, ms = 0) => {
      'worklet';
      const { w, h } = sizeSV.value;
      const cx = INSETS.left + (w - INSETS.left - INSETS.right) / 2;
      const cy = padTop.value + (h - padTop.value - padBottom.value) / 2;
      applyW({ s: scale, tx: cx - p[0] * scale, ty: cy - p[1] * scale }, ms);
    },
    [applyW, sizeSV, padTop, padBottom]
  );

  const fitPoints = useCallback(
    (pts: Pt[], ms: number, maxScale = MAX_SCALE) => {
      const { w, h } = sizeSV.value;
      const b = boundsOf(pts);
      const bw = Math.max(b.x1 - b.x0, 40);
      const bh = Math.max(b.y1 - b.y0, 40);
      const aw = Math.max(w - INSETS.left - INSETS.right, 80);
      const ah = Math.max(h - padTop.value - padBottom.value, 80);
      const sc = clampN(Math.min(aw / bw, ah / bh), minS.value, maxScale);
      applyW(
        { s: sc, tx: INSETS.left + aw / 2 - ((b.x0 + b.x1) / 2) * sc, ty: padTop.value + ah / 2 - ((b.y0 + b.y1) / 2) * sc },
        reducedMotion ? 0 : ms
      );
    },
    [applyW, sizeSV, minS, reducedMotion, padTop, padBottom]
  );

  const fitCampus = useCallback(
    (ms: number) =>
      fitPoints(
        [
          [0, 0],
          [W, H],
        ],
        ms
      ),
    [fitPoints, W, H]
  );

  // — Boyut ve ilk yerleşim
  const onLayout = useCallback(
    (e: LayoutChangeEvent) => {
      const { width, height } = e.nativeEvent.layout;
      const prev = sizeSV.value;
      sizeSV.value = { w: width, h: height };
      minS.value = Math.min(width / (content.x1 - content.x0), height / (content.y1 - content.y0)) * 0.9;
      if (!prev.w) {
        const sc = Math.min(width / W, height / H);
        s.value = sc;
        tx.value = (width - W * sc) / 2;
        ty.value = (height - H * sc) / 2;
      } else {
        // Yeniden boyutlanmada merkez sabit kalsın.
        applyW({ s: s.value, tx: tx.value + (width - prev.w) / 2, ty: ty.value + (height - prev.h) / 2 });
      }
      setSize({ w: width, h: height });
    },
    [applyW, content, W, H, s, tx, ty, sizeSV, minS]
  );

  // — Ölçek kademesi (etiketler) ve ölçek çubuğu yalnızca değişince JS'e iniyor.
  useAnimatedReaction(
    () => Math.round(Math.log2(s.value) * 2),
    (b, prev) => {
      if (b !== prev) runOnJS(setBucket)(b);
    }
  );
  const scaleMeters = useDerivedValue(() => {
    const target = 90 / s.value;
    let m = NICE_METERS[0];
    for (const n of NICE_METERS) if (n <= target) m = n;
    return m;
  });
  useAnimatedReaction(
    () => scaleMeters.value,
    (m, prev) => {
      if (m !== prev) runOnJS(setScaleText)(m >= 1000 ? `${m / 1000} km` : `${m} m`);
    }
  );
  const scaleBarStyle = useAnimatedStyle(() => ({ width: Math.round(scaleMeters.value * s.value) }));

  // — Dokunma: pinlere isabet testi JS'te (pinler dokunulabilir RN öğesi değil;
  // harita jestleriyle çakışmasınlar diye).
  const poiById = useMemo(() => new Map(data.pois.map((p) => [p.id, p])), [data]);
  const selected = selectedId ? (poiById.get(selectedId) ?? null) : null;

  const visiblePois = useMemo(() => {
    if (route) return selected ? [selected] : [];
    return data.pois.filter((p) => !category || p.cat === category || p.id === selectedId);
  }, [data, category, selectedId, route, selected]);

  const handleTap = useCallback(
    (x: number, y: number) => {
      if (route) return;
      const sc = s.value;
      let best: CampusPoi | null = null;
      let bestD = TAP_RADIUS;
      for (const p of visiblePois) {
        const d = Math.hypot(p.x * sc + tx.value - x, p.y * sc + ty.value - y);
        if (d < bestD) {
          best = p;
          bestD = d;
        }
      }
      if (best) onSelect(best.id);
      else if (selectedId) onSelect(null);
    },
    [route, visiblePois, selectedId, onSelect, s, tx, ty]
  );

  const gesture = useMemo(() => {
    const pan = Gesture.Pan()
      .maxPointers(1)
      .onStart(() => {
        gestureStart.value = { s: s.value, tx: tx.value, ty: ty.value };
        userMoved.value = true;
      })
      .onUpdate((e) => {
        const c0 = gestureStart.value;
        applyW({ s: c0.s, tx: c0.tx + e.translationX, ty: c0.ty + e.translationY });
      });
    const pinch = Gesture.Pinch()
      .onStart((e) => {
        gestureStart.value = { s: s.value, tx: tx.value, ty: ty.value };
        focalStart.value = { x: e.focalX, y: e.focalY };
        userMoved.value = true;
      })
      .onUpdate((e) => {
        const c0 = gestureStart.value;
        const sc = clampN(c0.s * e.scale, minS.value, MAX_SCALE);
        const wx = (focalStart.value.x - c0.tx) / c0.s;
        const wy = (focalStart.value.y - c0.ty) / c0.s;
        applyW({ s: sc, tx: e.focalX - wx * sc, ty: e.focalY - wy * sc });
      });
    const doubleTap = Gesture.Tap()
      .numberOfTaps(2)
      .maxDuration(280)
      .onEnd((e, ok) => {
        if (ok) zoomAtW(e.x, e.y, 2, 320);
      });
    const singleTap = Gesture.Tap()
      .maxDuration(260)
      .onEnd((e, ok) => {
        if (ok) runOnJS(handleTap)(e.x, e.y);
      });
    return Gesture.Simultaneous(pinch, pan, Gesture.Exclusive(doubleTap, singleTap));
  }, [applyW, zoomAtW, handleTap, s, tx, ty, minS, gestureStart, focalStart, userMoved]);

  // — Seçime uçuş (rota yokken). Tam ekranda kart seçimle birlikte açılıyor ve
  // yüksekliği bir kare sonra ölçülüyor; o gelince pin kartın üstüne yeniden
  // ortalanıyor (yoksa kartın arkasında kalıyordu).
  useEffect(() => {
    if (!selected || route || !sizeSV.value.w) return;
    centerOnW([selected.x, selected.y], clampN(Math.max(s.value, SELECT_SCALE), minS.value, MAX_SCALE), reducedMotion ? 0 : 750);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, route, bottomObstruction]);

  // — Rota sahnesi: başlangıca yönel → otobüsü takip et → durakta in, yürü
  const busLeg = route?.legs.find((l) => l.kind === 'bus') ?? null;
  const walkLeg = route ? route.legs[route.legs.length - 1] : null;
  const busPts = useMemo(() => (busLeg ? legPoints(data, busLeg) : null), [data, busLeg]);
  const walkPts = useMemo(() => (walkLeg ? legPoints(data, walkLeg) : null), [data, walkLeg]);
  const walkFrame = useMemo(() => (route && selectedId ? walkFrameOf(data, route, selectedId) : null), [data, route, selectedId]);

  useAnimatedReaction(
    () => busK.value,
    (k) => {
      if (follow.value !== 1 || userMoved.value || !busTr.value) return;
      // Yolun ortasında uzaklaş, uçlarda yakın kal (flyTo yayı).
      const sc = rideScale.value - (rideScale.value - RIDE_MIN_SCALE) * Math.sin(Math.PI * k);
      centerOnW(traceAt(busTr.value, k), sc);
    }
  );
  useAnimatedReaction(
    () => walkK.value,
    (k) => {
      if (follow.value !== 2 || userMoved.value || !walkTr.value) return;
      centerOnW(traceAt(walkTr.value, k), walkScale.value);
    }
  );

  useEffect(() => {
    setPhase('none');
    follow.value = 0;
    cancelAnimation(busK);
    cancelAnimation(walkK);
    busK.value = 0;
    walkK.value = 0;
    busTr.value = busPts ? makeTracer(busPts) : null;
    walkTr.value = walkPts ? makeTracer(walkPts) : null;
    if (!route || !walkPts || !walkFrame) return undefined;
    if (reducedMotion) {
      busK.value = 1;
      walkK.value = 1;
      fitPoints(walkFrame, 0, WALK_MAX_SCALE);
      setPhase('done');
      return undefined;
    }
    let alive = true;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const later = (fn: () => void, ms: number) => timers.push(setTimeout(() => alive && fn(), ms));
    userMoved.value = false;
    const startScale = clampN(START_SCALE, minS.value, MAX_SCALE);
    rideScale.value = startScale;
    walkScale.value = clampN(WALK_FOLLOW_SCALE, minS.value, MAX_SCALE);
    const walkM = walkLeg!.m;

    const afterWalk = () => {
      follow.value = 0;
      setPhase('done');
      // Takipten sonra tüm yürüme yolunu göster.
      if (!userMoved.value) later(() => fitPoints(walkFrame, FLY_MS, WALK_MAX_SCALE), 300);
    };
    const walkStage = () => {
      setPhase('walk');
      if (!userMoved.value) centerOnW(walkPts[0], walkScale.value, FLY_MS);
      later(() => {
        follow.value = 2;
        // Sabit hız: yavaşlayıp hızlanan nokta takip eden kamerayı sarsıyor.
        walkK.value = withTiming(1, { duration: Math.min(4200, WALK_MS + walkM * 1.6), easing: Easing.linear }, (fin) => {
          if (fin) runOnJS(afterWalk)();
        });
      }, FLY_MS);
    };
    const afterBus = () => {
      follow.value = 0;
      later(walkStage, 250);
    };

    // 1) Başlangıca yönel: metro istasyonu ya da yürünecek durak.
    const origin = route.legs[0].from;
    setPhase('start');
    centerOnW([origin.x, origin.y], startScale, START_MS);
    if (busPts) {
      // 2) Otobüsü takip et.
      later(() => {
        setPhase('bus');
        follow.value = 1;
        busK.value = withTiming(1, { duration: RIDE_MS, easing: Easing.inOut(Easing.cubic) }, (fin) => {
          if (fin) runOnJS(afterBus)();
        });
      }, START_MS + 200);
    } else {
      later(walkStage, START_MS + 200);
    }
    return () => {
      alive = false;
      timers.forEach(clearTimeout);
      follow.value = 0;
      cancelAnimation(busK);
      cancelAnimation(walkK);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeKey]);

  const labeled = useMemo(() => {
    const sc = 2 ** (bucket / 2);
    const items: LabelItem[] = [];
    if (selected) items.push({ key: selected.id, x: selected.x, y: selected.y, text: selected.short ?? selected.name, size: 13, dx: 15, force: true });
    if (!route) {
      data.transit.stations.forEach((st) => items.push({ key: `st:${st.name}`, x: st.x, y: st.y, text: placeLabel(st), size: 11.5, dx: 16 }));
      visiblePois
        .filter((p) => p !== selected)
        .map((p, i) => ({ p, r: (CAT_RANK[p.cat] ?? 9) * 1000 + i }))
        .sort((a, b) => a.r - b.r)
        .forEach(({ p }) => items.push({ key: p.id, x: p.x, y: p.y, text: p.short ?? p.name, size: 11.5, dx: 11 }));
      data.transit.stops.forEach((st) => items.push({ key: `sp:${st.name}`, x: st.x, y: st.y, text: placeLabel(st), size: 11.5, dx: 12 }));
    }
    const dots: Pt[] = [...visiblePois.map((p): Pt => [p.x, p.y]), ...(route ? [] : data.transit.stops.map((st): Pt => [st.x, st.y]))];
    return placeLabels(items, dots, sc);
  }, [bucket, data, visiblePois, selected, route]);

  // — Animasyonlu SVG özellikleri (kamera + rota çizgileri, sabit ekran kalınlığı)
  // `matrix` RNSVGGroup'un native özelliği (GroupNativeComponent.ts) ama GProps
  // tiplerinde yok — JS tarafı onu transform özelliklerinden kendisi üretiyor.
  const camProps = useAnimatedProps(() => ({ matrix: [s.value, 0, 0, s.value, tx.value, ty.value] }) as Partial<GProps>);
  const busCaseProps = useAnimatedProps(() => ({ d: busTr.value ? partialPath(busTr.value, busK.value) : 'M0 0', strokeWidth: 9.5 / s.value }));
  const busProps = useAnimatedProps(() => ({ d: busTr.value ? partialPath(busTr.value, busK.value) : 'M0 0', strokeWidth: 5.5 / s.value }));
  const walkCaseProps = useAnimatedProps(() => ({ d: walkTr.value ? partialPath(walkTr.value, walkK.value) : 'M0 0', strokeWidth: 8 / s.value }));
  const walkProps = useAnimatedProps(() => ({
    d: walkTr.value ? partialPath(walkTr.value, walkK.value) : 'M0 0',
    strokeWidth: 4.2 / s.value,
    strokeDasharray: [0.1, 9 / s.value],
  }));
  const worldStyle = useAnimatedStyle(() => ({ transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: s.value }] }));

  const showBus = !!busLeg && (phase === 'bus' || phase === 'walk' || phase === 'done');
  const showWalk = phase === 'walk' || phase === 'done';
  const origin = route ? route.legs[0].from : null;

  return (
    <Animated.View entering={reducedMotion ? undefined : FadeIn.duration(350)} style={[styles.root, { backgroundColor: c.land }]} onLayout={onLayout}>
      <GestureDetector gesture={gesture}>
        <View style={StyleSheet.absoluteFill} collapsable={false}>
          {size.w > 0 && (
            <Svg width={size.w} height={size.h} pointerEvents="none">
              <AnimatedG animatedProps={camProps}>
                <Layers L={data.layers} c={c} />
                {!!selected?.shape && (
                  <Path d={selected.shape} fill={c.accent} fillOpacity={0.32} stroke={c.accent} strokeWidth={1.6} strokeLinejoin="round" fillRule="evenodd" />
                )}
                {showBus && (
                  <>
                    <AnimatedPath animatedProps={busCaseProps} d="M0 0" {...LINE} stroke={c.halo} strokeWidth={9.5} />
                    <AnimatedPath animatedProps={busProps} d="M0 0" {...LINE} stroke={c.accent} strokeWidth={5.5} />
                  </>
                )}
                {showWalk && (
                  <>
                    <AnimatedPath animatedProps={walkCaseProps} d="M0 0" {...LINE} stroke={c.halo} strokeWidth={8} />
                    <AnimatedPath animatedProps={walkProps} d="M0 0" {...LINE} stroke={c.walk} strokeWidth={4.2} strokeDasharray={[0.1, 9]} />
                  </>
                )}
              </AnimatedG>
            </Svg>
          )}

          <Animated.View pointerEvents="none" style={[styles.world, worldStyle]}>
            {!route &&
              data.transit.stations.map((st) => (
                <Badge key={`st-${st.name}`} place={st} kind="rail" c={c} inv={inv} label={labeled.has(`st:${st.name}`) ? placeLabel(st) : null} />
              ))}
            {!route &&
              data.transit.stops.map((st) => (
                <Badge key={`sp-${st.name}`} place={st} kind="stop-sm" c={c} inv={inv} label={labeled.has(`sp:${st.name}`) ? placeLabel(st) : null} />
              ))}
            {visiblePois.map((p) => (
              <Pin
                key={p.id}
                poi={p}
                selected={p.id === selectedId}
                label={labeled.has(p.id) ? (p.short ?? p.name) : null}
                c={c}
                inv={inv}
              />
            ))}
            {route && origin && phase !== 'none' && (
              <>
                <Badge place={origin} kind={origin.rail ? 'rail' : 'stop'} c={c} inv={inv} label={placeLabel(origin)} />
                {busLeg && <Badge place={busLeg.to} kind="stop" c={c} inv={inv} label={placeLabel(busLeg.to)} />}
              </>
            )}
            {phase === 'bus' && <Mover tracer={busTr} k={busK} inv={inv} color={c.accent} halo={c.halo} size={14} />}
            {phase === 'walk' && <Mover tracer={walkTr} k={walkK} inv={inv} color={c.walk} halo={c.halo} size={12} />}
          </Animated.View>
        </View>
      </GestureDetector>

      {/* — Arayüz katmanı (dünya dışında, ölçeklenmez) — */}
      <View style={[styles.controls, { top: 12 + safeTop, backgroundColor: c.halo, borderColor: c.bldLine }]}>
        <MapButton label="Yakınlaştır" c={c} onPress={() => zoomAtW(size.w / 2, size.h / 2, 1.8, 300)}>
          <Plus size={18} color={c.label} />
        </MapButton>
        <MapButton label="Uzaklaştır" c={c} divider onPress={() => zoomAtW(size.w / 2, size.h / 2, 1 / 1.8, 300)}>
          <Minus size={18} color={c.label} />
        </MapButton>
        <MapButton label="Tüm kampüsü göster" c={c} divider onPress={() => fitCampus(700)}>
          <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={c.label} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <Path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
          </Svg>
        </MapButton>
        {/* Çapraz oklar: "tüm kampüs"ün köşe ikonuyla karışmasın. */}
        {onToggleFullscreen && (
          <MapButton label={fullscreen ? 'Tam ekrandan çık' : 'Tam ekran'} c={c} divider onPress={onToggleFullscreen}>
            {fullscreen ? <Minimize2 size={17} color={c.label} /> : <Maximize2 size={17} color={c.label} />}
          </MapButton>
        )}
      </View>
      <View pointerEvents="none" style={[styles.scale, { bottom: 10 + safeBottom }]}>
        <Animated.View style={[{ height: 5, borderWidth: 1.5, borderTopWidth: 0, borderColor: c.label }, scaleBarStyle]} />
        <Text style={[styles.scaleText, { color: c.label }]}>{scaleText}</Text>
      </View>
      {/* ODbL atfı zorunlu. */}
      <Pressable style={[styles.attrib, { bottom: 8 + safeBottom }]} hitSlop={6} onPress={() => Linking.openURL('https://www.openstreetmap.org/copyright')}>
        <Text style={[styles.attribText, { color: c.muted }]}>© OpenStreetMap katkıcıları</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, overflow: 'hidden' },
  world: { position: 'absolute', left: 0, top: 0, width: 0, height: 0 },
  anchor: { position: 'absolute', width: 0, height: 0 },
  // Web: 10 px nokta + 2 px hale (box-shadow); burada hale kenarlık.
  dot: { position: 'absolute', left: -7, top: -7, width: 14, height: 14, borderRadius: 7, borderWidth: 2 },
  dotSel: { position: 'absolute', left: -12, top: -12, width: 24, height: 24, borderRadius: 12, borderWidth: 3 },
  // Mutlak konumlu metin genişliğini kaptan alıyor; kap 0 genişlikte olduğu
  // için kutuya sabit bir genişlik veriliyor, yoksa harf harf kırılır.
  labelBox: { position: 'absolute', left: 11, top: -9, width: 260 },
  labelBoxSel: { left: 15, top: -10 },
  label: { fontSize: 11.5, fontWeight: '600', letterSpacing: 0.1, textShadowRadius: 3, textShadowOffset: { width: 0, height: 0 } },
  labelSel: { fontSize: 13 },
  badge: { position: 'absolute', left: -13, top: -13, width: 26, height: 26, borderRadius: 8, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  badgeSm: { position: 'absolute', left: -10, top: -10, width: 20, height: 20, borderRadius: 7, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  badgeText: { fontSize: 12, fontWeight: '700' },
  controls: {
    position: 'absolute',
    top: 12,
    right: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  mapBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  scale: { position: 'absolute', left: 12, bottom: 10, gap: 3 },
  scaleText: { fontSize: 10, letterSpacing: 0.4 },
  attrib: { position: 'absolute', right: 10, bottom: 8 },
  attribText: { fontSize: 10 },
});
