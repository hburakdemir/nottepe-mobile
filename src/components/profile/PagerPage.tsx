import React, { useMemo } from 'react';
import { View } from 'react-native';
import Animated, { runOnJS, useAnimatedScrollHandler, type SharedValue } from 'react-native-reanimated';
import { TAB_BAR_SAFE_PADDING } from '../layout/tabBarMetrics';
import type { TabKey } from './profileCommon';

// Profil pager'ındaki "basit" sekmelerin (checklist / AKTS / program / takip /
// forum) ortak kabuğu: bir `Animated.ScrollView` + kayan başlığı besleyen
// scroll worklet'i.
//
// NEDEN AYRI BİR KABUK — asıl mesele tekrar değil, worklet'in ÖMRÜ:
//
// Beş sekmenin `useAnimatedScrollHandler`'ı ProfileScreen'in gövdesinde tek tek
// duruyordu. Reanimated bu hook'un bağımlılıklarını worklet'in closure'ından
// topluyor; bağımlılık değişince worklet UI thread'inde YENİDEN inşa ediliyor.
// Ekranın 29 state'i tek bileşende olduğu için bu, alakasız her güncellemede
// olabiliyordu. Handler artık sayfanın kendi bileşeninde kuruluyor ve yalnızca
// `scrollY` / `onRememberOffset` / `tabKey`'e bakıyor — üçü de stabil referans,
// yani worklet sayfa mount olduğunda BİR KEZ kuruluyor.
//
// Stil ikiye ayrılmış durumda ve bu bilinçli: yatay dolgu ile boşluk STATİK,
// o yüzden `contentContainerClassName` (Animated.ScrollView artık NativeWind'e
// kayıtlı, bkz. lib/nativewindInterop.ts). `paddingTop` ise bir `onLayout`
// ÖLÇÜMÜ (`headerHeight`) — derleme zamanında bilinemeyeceği için sınıf
// olamaz, `style` kalmak zorunda.
/** Beş "basit" sekmenin ortak prop kümesi. Hepsi stabil referans (ya ilkel, ya
 *  shared value, ya `useCallback`'li) — sekme bileşenlerinin `React.memo`'su bu
 *  sayede iş görüyor. */
export type ProfileTabProps = {
  /** Sayfa görünür mü — görünmeyen sayfa içeriğini hiç çizmiyor (kap duruyor). */
  active: boolean;
  width: number;
  headerHeight: number;
  scrollY: SharedValue<number>;
  onRememberOffset: (key: TabKey, y: number) => void;
};

export default function PagerPage({
  tabKey,
  width,
  headerHeight,
  scrollY,
  onRememberOffset,
  children,
}: {
  tabKey: TabKey;
  width: number;
  headerHeight: number;
  scrollY: SharedValue<number>;
  /** Her sekme KENDİ dikey konumunu hatırlıyor — sekme değişince başlık o
   *  konuma senkronlanıyor, önceki sekmede kaldığı yerde donuk kalmıyor. */
  onRememberOffset: (key: TabKey, y: number) => void;
  children?: React.ReactNode;
}) {
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
    onEndDrag: (event) => runOnJS(onRememberOffset)(tabKey, event.contentOffset.y),
    onMomentumEnd: (event) => runOnJS(onRememberOffset)(tabKey, event.contentOffset.y),
  });

  const pageStyle = useMemo(() => ({ width }), [width]);
  // `headerTotalHeight` kadar dolgu içeriği şeridin TAM altına yapıştırıyordu
  // (ör. Program sekmesindeki "Düzenle" butonu şeride bitişik duruyordu);
  // sekme şeridiyle içerik arasında sabit bir nefes payı bırakılıyor.
  const contentStyle = useMemo(
    () => ({ paddingTop: headerHeight + 14, paddingBottom: TAB_BAR_SAFE_PADDING }),
    [headerHeight]
  );

  return (
    <Animated.ScrollView
      style={pageStyle}
      showsVerticalScrollIndicator={false}
      contentContainerClassName="px-4 gap-2.5"
      contentContainerStyle={contentStyle}
      onScroll={scrollHandler}
      scrollEventThrottle={32}
    >
      {children}
    </Animated.ScrollView>
  );
}

/** Henüz mount edilmemiş sekmelerin yerini tutan boş sayfa — pager'ın
 *  geometrisi bozulmasın, `scrollTo(idx * width)` çalışmaya devam etsin diye. */
export function PagerPlaceholder({ width }: { width: number }) {
  const style = useMemo(() => ({ width }), [width]);
  return <View style={style} />;
}
