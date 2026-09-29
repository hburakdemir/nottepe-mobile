import React, { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, { Easing, FadeInDown, FadeOutDown, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { RotateCcw } from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';

// Silme sonrası "Geri al" çubuğu: saniye sayacı + azalan ilerleme çizgisi.
// `startedAt` değişince (yeni silme) sayaç ve çizgi baştan başlıyor. Süre
// dolunca ekranı kapatan zamanlayıcı çağıranda (tek doğruluk kaynağı orası);
// buradaki sayaç yalnızca gösterim.
export default function UndoBar({
  startedAt,
  durationMs,
  message,
  onUndo,
}: {
  startedAt: number;
  durationMs: number;
  message: string;
  onUndo: () => void;
}) {
  const { colors } = useTheme();
  const total = Math.round(durationMs / 1000);
  const [left, setLeft] = useState(total);
  const progress = useSharedValue(1);

  useEffect(() => {
    const tick = () => setLeft(Math.max(0, Math.ceil((startedAt + durationMs - Date.now()) / 1000)));
    tick();
    const t = setInterval(tick, 250);
    progress.value = 1;
    progress.value = withTiming(0, { duration: Math.max(0, startedAt + durationMs - Date.now()), easing: Easing.linear });
    return () => clearInterval(t);
  }, [startedAt, durationMs, progress]);

  const barStyle = useAnimatedStyle(() => ({ width: `${progress.value * 100}%` }));

  return (
    <Animated.View
      entering={FadeInDown.duration(200)}
      exiting={FadeOutDown.duration(180)}
      className="absolute left-3 right-3 bottom-[96px] bg-surface border border-line rounded-xl overflow-hidden"
    >
      <View className="flex-row items-center gap-3 px-3.5 py-3">
        <Text className="flex-1 text-[13px] text-ink2">{message}</Text>
        <Pressable onPress={onUndo} hitSlop={10} className="flex-row items-center gap-1.5" accessibilityLabel="Geri al">
          <RotateCcw size={14} color={colors.accent} />
          <Text className="text-[13px] font-bold text-accent">Geri al</Text>
          <View className="min-w-[22px] h-[22px] rounded-full bg-accent-soft items-center justify-center">
            <Text className="text-[11px] font-bold text-accent">{left}</Text>
          </View>
        </Pressable>
      </View>
      <Animated.View style={[{ height: 3, backgroundColor: colors.accent }, barStyle]} />
    </Animated.View>
  );
}
