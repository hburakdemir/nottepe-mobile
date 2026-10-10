import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Platform, Pressable, StatusBar, Text, View, useWindowDimensions } from 'react-native';
import type { View as RNView } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useThemeColors } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';

// ═══════════════════════════════════════════════════════════════════════════
// İLK KULLANIM REHBERİ — ekranı karartıp bir öğeyi vurgulayan, altında/üstünde
// kısa bir açıklama gösteren adım adım tur.
//
// Parçalar:
//   • `useCoachTarget(id)` → öğeye verilen `ref`. Öğe kendini bir kimlikle
//     kaydediyor; tur başlarken konumu `measureInWindow` ile o an ölçülüyor
//     (onLayout değil: sekme kayması, başlığın gizlenmesi gibi sonradan
//     değişen konumlar yanlış yere ok çizdirirdi).
//   • `useCoachTour(tourId, steps, active)` → ekran odaktayken ve tur daha önce
//     görülmemişse turu başlatıyor. Görüldü bilgisi cihazda (AsyncStorage);
//     YALNIZCA tur bitince ya da atlanınca yazılıyor — yarıda kapanan uygulama
//     bir sonraki açılışta turu baştan gösterir.
//   • `mandatory` adım "Atla" düğmesi göstermiyor; yalnızca "Anladım" ile geçiliyor.
//   • KVKK/bölüm kapısı (`needsOnboardingGate`) açıkken HİÇBİR tur başlamıyor.
//     Kapı da tur da RN `Modal`. Android ikisini üst üste çiziyordu (tur,
//     doldurulmamış kapının üstünde). iOS'ta ise tur, kapıyı sunmakta olan kök
//     view controller'dan sunulmaya çalışılıyor; UIKit bunu reddediyor ama
//     RCTModalHostViewComponentView `_isPresented`'ı yine de YES yapıyor, yani
//     tur kapı kapandıktan sonra da hiç görünmüyordu; iPhone'da kapıyı
//     onaylayınca ekranın dokunuşa yanıt vermediği de bildirildi (2026-10-10).
//
// Ölçülemeyen (ekranda olmayan, boyutu 0) hedefin adımı sessizce atlanıyor.
// ═══════════════════════════════════════════════════════════════════════════

export interface CoachStep {
  target: string;
  title: string;
  text: string;
  /** "Atla" yok; kullanıcı bu adımı "Anladım" ile geçmek zorunda. */
  mandatory?: boolean;
}

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface ActiveTour {
  id: string;
  steps: (CoachStep & { rect: Rect })[];
}

interface CoachContextValue {
  register: (id: string, node: RNView | null) => void;
  start: (id: string, steps: CoachStep[]) => void;
  isRunning: () => boolean;
  /** Kapı açıkken true — tur başlatılmıyor (bkz. dosya başı). */
  paused: boolean;
}

const CoachContext = createContext<CoachContextValue | null>(null);

const STORAGE_PREFIX = 'coach:v1:';
const HOLE_PADDING = 6;
const BUBBLE_GAP = 12;
const SIDE_GUTTER = 16;

function measureRaw(node: RNView): Promise<Rect | null> {
  return new Promise((resolve) => {
    try {
      node.measureInWindow((x, y, width, height) => {
        resolve(width > 0 && height > 0 ? { x, y, width, height } : null);
      });
    } catch {
      resolve(null);
    }
  });
}

// Hedefin konumu, ekranın sol üst köşesindeki referans noktasına (`origin`)
// GÖRE. Katman `statusBarTranslucent` bir Modal, sıfırı ekranın en üstü;
// uygulama da edge-to-edge, yani referans da ekranın en üstünde.
//
// Android'de `measureInWindow`'un sıfırı ekranın üstü DEĞİL ve sabit de değil.
// Eskiden buraya `StatusBar.currentHeight` ekleniyordu; Pixel 7 / API 35'te
// (2026-10-10) çubuk 51.8 dp iken ölçümün sıfırı ekranın 28.2 dp altındaydı,
// yani çerçeve 23.6 dp AŞAĞI kayıyordu. Tur KVKK kapısı açıkken ölçüldüğünde
// ise doğru çıkıyordu — sıfır, üstte başka pencere olup olmamasına göre de
// değişiyor. Referans aynı yoldan ölçüldüğü için fark her durumda doğru.
async function measure(node: RNView, origin: Rect | null): Promise<Rect | null> {
  const rect = await measureRaw(node);
  if (!rect) return null;
  const dy = origin ? origin.y : Platform.OS === 'android' ? -(StatusBar.currentHeight ?? 0) : 0;
  const dx = origin ? origin.x : 0;
  return { x: rect.x - dx, y: rect.y - dy, width: rect.width, height: rect.height };
}

async function markSeen(id: string) {
  try {
    await AsyncStorage.setItem(STORAGE_PREFIX + id, '1');
  } catch {
    // Yazılamazsa tur bir dahaki sefere yine görünür; zararsız.
  }
}

async function wasSeen(id: string): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(STORAGE_PREFIX + id)) === '1';
  } catch {
    // Okunamıyorsa göstermemek daha az rahatsız edici.
    return true;
  }
}

export function CoachProvider({ children }: { children: React.ReactNode }) {
  const { needsOnboardingGate: paused } = useAuth();
  const targets = useRef(new Map<string, RNView>());
  const originRef = useRef<RNView>(null);
  const [tour, setTour] = useState<ActiveTour | null>(null);
  const [index, setIndex] = useState(0);
  const running = useRef(false);

  const register = useCallback((id: string, node: RNView | null) => {
    if (node) targets.current.set(id, node);
    else targets.current.delete(id);
  }, []);

  const start = useCallback(async (id: string, steps: CoachStep[]) => {
    if (running.current) return;
    running.current = true;
    const origin = originRef.current ? await measureRaw(originRef.current) : null;
    const measured: ActiveTour['steps'] = [];
    for (const step of steps) {
      const node = targets.current.get(step.target);
      const rect = node ? await measure(node, origin) : null;
      if (rect) measured.push({ ...step, rect });
    }
    if (measured.length === 0) {
      running.current = false;
      return;
    }
    setIndex(0);
    setTour({ id, steps: measured });
  }, []);

  const finish = useCallback(() => {
    if (tour) void markSeen(tour.id);
    setTour(null);
    running.current = false;
  }, [tour]);

  const next = useCallback(() => {
    if (!tour) return;
    if (index + 1 >= tour.steps.length) finish();
    else setIndex(index + 1);
  }, [tour, index, finish]);

  // Atla: kalan adımlardan zorunlu olan varsa ona atlanıyor, yoksa tur bitiyor.
  const skip = useCallback(() => {
    if (!tour) return;
    const mandatoryAt = tour.steps.findIndex((s, i) => i > index && s.mandatory);
    if (mandatoryAt >= 0) setIndex(mandatoryAt);
    else finish();
  }, [tour, index, finish]);

  const value = useMemo<CoachContextValue>(
    () => ({ register, start, isRunning: () => running.current, paused }),
    [register, start, paused]
  );

  const step = tour?.steps[index];

  return (
    <CoachContext.Provider value={value}>
      {children}
      {/* Ölçüm referansı (bkz. `measure`). Boyutu 0 olursa `measureRaw` onu
          yok sayar, `collapsable={false}` Android'in onu ağaçtan atmaması için. */}
      <View
        ref={originRef}
        collapsable={false}
        pointerEvents="none"
        style={{ position: 'absolute', top: 0, left: 0, width: 1, height: 1 }}
      />
      {tour && step && (
        <CoachOverlay
          step={step}
          position={index + 1}
          total={tour.steps.length}
          onNext={next}
          onSkip={skip}
        />
      )}
    </CoachContext.Provider>
  );
}

function CoachOverlay({
  step,
  position,
  total,
  onNext,
  onSkip,
}: {
  step: CoachStep & { rect: Rect };
  position: number;
  total: number;
  onNext: () => void;
  onSkip: () => void;
}) {
  const colors = useThemeColors();
  const { height: screenH } = useWindowDimensions();
  const [bubbleH, setBubbleH] = useState(0);

  const hole = {
    x: step.rect.x - HOLE_PADDING,
    y: step.rect.y - HOLE_PADDING,
    width: step.rect.width + HOLE_PADDING * 2,
    height: step.rect.height + HOLE_PADDING * 2,
  };
  // Hedef ekranın alt yarısındaysa (ör. sekme çubuğu) balon üstte.
  const above = hole.y + hole.height / 2 > screenH / 2;
  const bubbleTop = above ? Math.max(SIDE_GUTTER, hole.y - BUBBLE_GAP - bubbleH) : hole.y + hole.height + BUBBLE_GAP;
  const dim = 'rgba(0,0,0,0.72)';
  const isLast = position === total;

  return (
    // Geri tuşu (Android) turu kapatmıyor: zorunlu adım atlanabilir olmasın.
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={() => {}}>
      <View style={{ flex: 1 }}>
        {/* Delik dışındaki dört karartma şeridi. Dokunuşlar yutuluyor ki
            arkadaki ekrana basılmasın. */}
        <Pressable style={{ position: 'absolute', left: 0, right: 0, top: 0, height: Math.max(0, hole.y), backgroundColor: dim }} />
        <Pressable
          style={{ position: 'absolute', left: 0, right: 0, top: hole.y + hole.height, bottom: 0, backgroundColor: dim }}
        />
        <Pressable
          style={{ position: 'absolute', left: 0, width: Math.max(0, hole.x), top: hole.y, height: hole.height, backgroundColor: dim }}
        />
        <Pressable
          style={{
            position: 'absolute',
            left: hole.x + hole.width,
            right: 0,
            top: hole.y,
            height: hole.height,
            backgroundColor: dim,
          }}
        />
        {/* Deliğin kendisi de dokunuşu yutuyor: tur sırasında hedefe basmak
            gezinmeyi başlatıp turu yarıda bırakırdı. */}
        <Pressable
          style={{
            position: 'absolute',
            left: hole.x,
            top: hole.y,
            width: hole.width,
            height: hole.height,
            borderRadius: 12,
            borderWidth: 2,
            borderColor: '#fff',
          }}
        />

        <View
          onLayout={(e) => setBubbleH(e.nativeEvent.layout.height)}
          style={{
            position: 'absolute',
            left: SIDE_GUTTER,
            right: SIDE_GUTTER,
            top: bubbleTop,
            maxWidth: 420,
            alignSelf: 'center',
            opacity: bubbleH > 0 || !above ? 1 : 0,
            backgroundColor: colors.surface,
            borderRadius: 16,
            padding: 16,
          }}
        >
          <Text style={{ color: colors.ink, fontSize: 16, fontWeight: '800' }}>{step.title}</Text>
          <Text style={{ color: colors.ink2, fontSize: 14, lineHeight: 20, marginTop: 6 }}>{step.text}</Text>

          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 14 }}>
            {total > 1 && (
              <Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: '600' }}>
                {position}/{total}
              </Text>
            )}
            <View style={{ flex: 1 }} />
            {!step.mandatory && !isLast && (
              <Pressable onPress={onSkip} hitSlop={10} style={{ paddingHorizontal: 12, paddingVertical: 8 }}>
                <Text style={{ color: colors.muted, fontSize: 14, fontWeight: '700' }}>Atla</Text>
              </Pressable>
            )}
            <Pressable
              onPress={onNext}
              style={{ backgroundColor: colors.accent, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 9 }}
            >
              <Text style={{ color: '#fff', fontSize: 14, fontWeight: '800' }}>
                {step.mandatory ? 'Anladım' : isLast ? 'Tamam' : 'İleri'}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

/** Rehberin vurgulayacağı öğeye verilen ref. `enabled` false iken kayıt yapılmaz. */
export function useCoachTarget(id: string, enabled = true) {
  const ctx = useContext(CoachContext);
  return useCallback(
    (node: RNView | null) => {
      if (!ctx || !enabled) return;
      ctx.register(id, node);
    },
    [ctx, id, enabled]
  );
}

/**
 * `active` true olduğunda (tipik olarak ekran odakta) tur daha önce
 * görülmemişse kısa bir gecikmeyle başlıyor. Gecikme, ekranın geçiş
 * animasyonunun bitmesi ve hedeflerin yerine oturması için. Kapı kapandığında
 * da aynı gecikme işliyor: kapının iOS'taki fade kapanışı (~0.3 sn) bitmeden
 * turun Modal'ı sunulursa UIKit onu da reddeder.
 */
export function useCoachTour(tourId: string, steps: CoachStep[], active: boolean) {
  const ctx = useContext(CoachContext);
  const paused = ctx?.paused ?? false;
  const stepsRef = useRef(steps);
  stepsRef.current = steps;

  useEffect(() => {
    if (!ctx || !active || paused) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      if (cancelled || ctx.isRunning()) return;
      if (await wasSeen(tourId)) return;
      if (!cancelled) ctx.start(tourId, stepsRef.current);
    }, 700);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [ctx, active, paused, tourId]);
}
