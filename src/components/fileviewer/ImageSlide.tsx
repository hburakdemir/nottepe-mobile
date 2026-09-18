import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { VIEWER_BG } from './viewerTokens';

interface Props {
  uri: string;
  width: number;
  height: number;
  /** Pager'ın o an gösterdiği slayt mı — değilse yakınlaştırma sıfırlanıyor. */
  active: boolean;
  /** Yakınlaştırma durumu değiştiğinde: pager bu sırada kilitleniyor. */
  onZoomChange: (zoomed: boolean) => void;
  /** Cihaz bu formatı çözemedi (ör. Android'de HEIC) — üst katman devralır. */
  onError: () => void;
}

const MIN_SCALE = 1;
const MAX_SCALE = 4;
const DOUBLE_TAP_SCALE = 2.5;

function clamp(value: number, min: number, max: number) {
  'worklet';
  return Math.min(Math.max(value, min), max);
}

// Uzak URL doğrudan veriliyor, fileCache'ten GEÇMİYOR.
//
// expo-image'in kendi disk önbelleği (`cachePolicy="memory-disk"`) zaten aynı
// işi yapıyor; ikinci bir önbellek katmanı hem diski iki kez harcar hem de
// resmi göstermek için gereksiz bir indirme-bekleme adımı ekler. fileCache
// resimler için yalnızca paylaş butonuna basıldığında devreye giriyor.
export default function ImageSlide({ uri, width, height, active, onZoomChange, onError }: Props) {
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const savedTx = useSharedValue(0);
  const savedTy = useSharedValue(0);
  // Kilidi UI thread'inde tutuyoruz ki her karede JS'e köprü kurmayalım.
  const lockedShared = useSharedValue(false);

  const [zoomed, setZoomed] = useState(false);

  const applyLock = useCallback(
    (next: boolean) => {
      setZoomed(next);
      onZoomChange(next);
    },
    [onZoomChange]
  );

  // Kilit YALNIZCA geçişte JS'e bildiriliyor. Pinch sırasında onUpdate saniyede
  // 60 kez çalışıyor; her birinde runOnJS çağırmak köprüyü doldurup jesti
  // takmaya başlıyordu.
  const syncLock = useCallback(
    (next: boolean) => {
      'worklet';
      if (lockedShared.value === next) return;
      lockedShared.value = next;
      runOnJS(applyLock)(next);
    },
    [applyLock, lockedShared]
  );

  const reset = useCallback(() => {
    'worklet';
    scale.value = withTiming(1);
    tx.value = withTiming(0);
    ty.value = withTiming(0);
    savedScale.value = 1;
    savedTx.value = 0;
    savedTy.value = 0;
    syncLock(false);
  }, [scale, tx, ty, savedScale, savedTx, savedTy, syncLock]);

  // Slayt değişince yakınlaştırma sıfırlanıyor: kullanıcı yakınlaştırdığı bir
  // fotoğraftan çıkıp geri döndüğünde onu yine yakınlaştırılmış bulmak, hangi
  // kısmına baktığını hatırlamadığı için kafa karıştırıcı.
  useEffect(() => {
    if (!active) reset();
  }, [active, reset]);

  // Kaydırma sınırı, resmin değil KAPSAYICININ ölçüsünden hesaplanıyor.
  // contentFit="contain" ile resim harf kutusuna oturduğunda bu, gerçekte
  // olduğundan biraz geniş bir gezinme alanı bırakıyor (boşluğa doğru birkaç
  // piksel). Resmin gerçek çizim dikdörtgenini ölçmenin karşılığı bu küçük
  // sapmayı düzeltmek olurdu; sınırın hiç olmaması ise resmi ekrandan
  // kaçırmak demek, asıl kaçınılan o.
  const maxOffset = useCallback(
    (axis: 'x' | 'y', currentScale: number) => {
      'worklet';
      const size = axis === 'x' ? width : height;
      return Math.max((size * (currentScale - 1)) / 2, 0);
    },
    [width, height]
  );

  const pinch = Gesture.Pinch()
    .onUpdate((e) => {
      // Alt sınırı 0.8'e kadar açıyoruz ki kullanıcı "küçültme" hissini alsın;
      // bırakınca 1'e geri yaylanıyor.
      scale.value = clamp(savedScale.value * e.scale, 0.8, MAX_SCALE);
      syncLock(scale.value > 1.01);
    })
    .onEnd(() => {
      if (scale.value < MIN_SCALE) {
        reset();
        return;
      }
      savedScale.value = scale.value;
      tx.value = clamp(tx.value, -maxOffset('x', scale.value), maxOffset('x', scale.value));
      ty.value = clamp(ty.value, -maxOffset('y', scale.value), maxOffset('y', scale.value));
      savedTx.value = tx.value;
      savedTy.value = ty.value;
    });

  // `.enabled(zoomed)`: normal ölçekte yatay hareket DIŞ pager'ın, yalnızca
  // yakınlaştırılmışken bu slaytın. React state'inden sürüldüğü için bir kare
  // gecikiyor, ama kullanıcı o anda pinch'i zaten bitirmiş oluyor.
  const pan = Gesture.Pan()
    .enabled(zoomed)
    .averageTouches(true)
    .onUpdate((e) => {
      tx.value = clamp(
        savedTx.value + e.translationX,
        -maxOffset('x', scale.value),
        maxOffset('x', scale.value)
      );
      ty.value = clamp(
        savedTy.value + e.translationY,
        -maxOffset('y', scale.value),
        maxOffset('y', scale.value)
      );
    })
    .onEnd(() => {
      savedTx.value = tx.value;
      savedTy.value = ty.value;
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .maxDuration(280)
    .onEnd((e) => {
      if (scale.value > 1.01) {
        reset();
        return;
      }
      // Çift dokunulan noktayı merkeze getir: dokunuşun merkeze uzaklığı,
      // büyüme oranı kadar ters yönde kaydırılıyor.
      const next = DOUBLE_TAP_SCALE;
      const offsetX = (width / 2 - e.x) * (next - 1);
      const offsetY = (height / 2 - e.y) * (next - 1);
      const limitX = maxOffset('x', next);
      const limitY = maxOffset('y', next);

      scale.value = withTiming(next);
      tx.value = withTiming(clamp(offsetX, -limitX, limitX));
      ty.value = withTiming(clamp(offsetY, -limitY, limitY));
      savedScale.value = next;
      savedTx.value = clamp(offsetX, -limitX, limitX);
      savedTy.value = clamp(offsetY, -limitY, limitY);
      syncLock(true);
    });

  const gesture = Gesture.Simultaneous(pinch, pan, doubleTap);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: scale.value }],
  }));

  return (
    <GestureDetector gesture={gesture}>
      <View style={[styles.wrap, { width, height }]}>
        <Animated.View style={[styles.fill, animatedStyle]}>
          <Image
            source={{ uri }}
            style={styles.fill}
            contentFit="contain"
            cachePolicy="memory-disk"
            transition={120}
            onError={onError}
            accessibilityIgnoresInvertColors
          />
        </Animated.View>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  wrap: { backgroundColor: VIEWER_BG, overflow: 'hidden' },
  fill: { width: '100%', height: '100%' },
});
