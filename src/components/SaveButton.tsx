import React, { useEffect } from 'react';
import { Pressable, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { Bookmark } from 'lucide-react-native';

interface Props {
  saved: boolean;
  onPress: () => void;
  size?: number;
  color: string;
  savedColor: string;
  style?: StyleProp<ViewStyle>;
}

// Ortak "kaydet" butonu — eskiden her kart bunu kendi Pressable'ıyla ayrı ayrı
// çiziyordu, dokunma alanı ~33dp (17px ikon + 8 hitSlop) idi ve hiçbir geri
// bildirim vermiyordu ("kaydet butonuna tıklanmıyor, çok zor tıklanıyor").
// Burada: en az 44dp dokunma kutusu + basınca "sıkışma" + durum değişince
// zıplama animasyonu. Toggle'ın kendisi artık optimistik (bkz.
// SavedPostContext.toggleSavePost) — tıklama anında ikon değişir, animasyon
// bunu görsel olarak da destekliyor.
export default function SaveButton({ saved, onPress, size = 18, color, savedColor, style }: Props) {
  const scale = useSharedValue(1);

  useEffect(() => {
    // Durum (kaydedildi/kaldırıldı) her değiştiğinde küçük bir "pop".
    scale.value = withSequence(withSpring(1.25, { damping: 10, stiffness: 300 }), withSpring(1, { damping: 12, stiffness: 260 }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saved]);

  const handlePressIn = () => {
    scale.value = withTiming(0.82, { duration: 80 });
  };
  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 12, stiffness: 260 });
  };

  const iconStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      hitSlop={14}
      style={[{ padding: 8, alignItems: 'center', justifyContent: 'center' }, style]}
      accessibilityRole="button"
      accessibilityLabel={saved ? 'Kayıttan çıkar' : 'Kaydet'}
    >
      <Animated.View style={iconStyle}>
        <Bookmark size={size} color={saved ? savedColor : color} fill={saved ? savedColor : 'none'} strokeWidth={2} />
      </Animated.View>
    </Pressable>
  );
}
