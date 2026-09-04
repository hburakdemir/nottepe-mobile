import React, { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import type { LucideIcon } from 'lucide-react-native';

export interface SwipeAction {
  key: string;
  icon: LucideIcon;
  label: string;
  /** Butonun dolgu rengi — ikon ve yazı her zaman beyaz çiziliyor. */
  color: string;
  onPress: () => void;
}

const ACTION_WIDTH = 76;
const OPEN_THRESHOLD = 0.4;

// Satırı sağa çekince SOLDAN açılan aksiyon şeridi (kullanıcı isteği:
// "sağa kaydırınca okunmadı ve sil ikonları çıkmalı yan yana").
//
// NEDEN KÜTÜPHANE DEĞİL: önce `react-native-gesture-handler/ReanimatedSwipeable`
// kullanıldı; görünüm doğruydu ama BUTONLAR DOKUNMA ALMIYORDU. Sebep, o
// bileşenin aksiyonları satırın ALTINA (z-sırasında önce) koyup satırı
// `translateX` ile kaydırması: Fabric'te dokunma hedeflemesi satırın
// kaydırılmamış yerleşim dikdörtgenini kullandığı için satır, açığa çıkan
// aksiyon alanının üstünü kapatıyor ve dokunuşları yutuyor. Burada aksiyon
// katmanı satırın ÜSTÜNDE (z-sırasında sonra) ve yalnızca açıkken render
// ediliyor — dokunuşlar doğrudan butonlara gidiyor.
//
// Çekmece jesti bu ekranda bilerek kapalı (bkz. drawerConstants
// NO_DRAWER_SWIPE_ROUTES); açık olsaydı sağa çekiş menüyü açardı.
export default function SwipeActions({ actions, children }: { actions: SwipeAction[]; children: React.ReactNode }) {
  const width = ACTION_WIDTH * actions.length;
  const translateX = useSharedValue(0);
  const [open, setOpen] = useState(false);

  const close = useCallback(() => {
    translateX.value = withTiming(0, { duration: 160 });
    setOpen(false);
  }, [translateX]);

  const pan = Gesture.Pan()
    .activeOffsetX([-20, 20])
    .failOffsetY([-12, 12])
    .onChange((event) => {
      const next = translateX.value + event.changeX;
      translateX.value = Math.min(width, Math.max(0, next));
    })
    .onEnd(() => {
      const shouldOpen = translateX.value > width * OPEN_THRESHOLD;
      translateX.value = withSpring(shouldOpen ? width : 0, { damping: 20, stiffness: 220 });
      runOnJS(setOpen)(shouldOpen);
    });

  const rowStyle = useAnimatedStyle(() => ({ transform: [{ translateX: translateX.value }] }));

  return (
    <View style={{ overflow: 'hidden', borderRadius: 12 }}>
      <GestureDetector gesture={pan}>
        <Animated.View style={rowStyle}>{children}</Animated.View>
      </GestureDetector>

      {open && (
        <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width, flexDirection: 'row' }}>
          {actions.map(({ key, icon: Icon, label, color, onPress }) => (
            <Pressable
              key={key}
              className="items-center justify-center gap-1"
              style={{ width: ACTION_WIDTH, backgroundColor: color }}
              onPress={() => {
                close();
                onPress();
              }}
              accessibilityLabel={label}
            >
              <Icon size={19} color="#fff" />
              <Text className="text-white text-[11px] font-semibold" numberOfLines={1}>
                {label}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}
