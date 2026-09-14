import React, { createContext, useContext, useEffect } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming, type SharedValue } from 'react-native-reanimated';
import { useTheme } from '../context/ThemeContext';

// Yükleme sırasında dönen çark yerine, GELECEK İÇERİĞİN ŞEKLİNİ gösteren gri
// bloklar. Çark "bir şey oluyor" der ama ne kadar sürecek ya da ne geleceği
// hakkında hiçbir şey söylemez; iskelet sayfanın yerleşimini önceden çizdiği
// için içerik geldiğinde ekran ZIPLAMAZ — algılanan hız farkının asıl kaynağı
// budur (madde 5).
//
// NABIZ TEK YERDEN SÜRÜLÜYOR. Her `Skeleton` kendi `useSharedValue`'sini
// kurarsa, 12 bloklu bir ekranda 12 ayrı worklet UI thread'inde aynı anda
// döner. Testçilerde eski Android cihazlar da var, o yüzden nabız `SkeletonGroup`
// içinde BİR kez kuruluyor ve context ile paylaşılıyor: blok sayısı ne olursa
// olsun tek animasyon. Grup dışında kalan bir `Skeleton` da çalışır, sadece
// sabit durur — bilerek, çünkü çökmek yerine sessizce bozulmamalı.
const PulseContext = createContext<SharedValue<number> | null>(null);

const MIN_OPACITY = 0.45;
const PULSE_MS = 750;

export function SkeletonGroup({ children }: { children: React.ReactNode }) {
  const pulse = useSharedValue(MIN_OPACITY);

  useEffect(() => {
    // `-1` = sonsuz, `true` = ters yönde geri dön (yanıp sönme yerine nefes
    // alma). Grup söküldüğünde animasyon da shared value ile birlikte gider.
    pulse.value = withRepeat(withTiming(1, { duration: PULSE_MS }), -1, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <PulseContext.Provider value={pulse}>{children}</PulseContext.Provider>;
}

export function Skeleton({
  width,
  height = 14,
  radius = 6,
  style,
}: {
  width?: number | `${number}%`;
  height?: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  const pulse = useContext(PulseContext);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: pulse ? pulse.value : 1 }));

  const base: ViewStyle = { width, height, borderRadius: radius, backgroundColor: colors.inset };

  // Gruba bağlı değilse Reanimated'a hiç girmiyoruz: düz `View` yeterli.
  if (!pulse) return <View style={[base, style]} />;

  return <Animated.View style={[base, animatedStyle, style]} />;
}
