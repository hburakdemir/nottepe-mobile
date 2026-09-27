import React from 'react';
import { Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useBlockedByIds } from '../../hooks/useBlockedByIds';

// Yönetici/moderatör, onu engelleyen birinin içeriğini (normal kullanıcının
// göremeyeceği yerde) görürken kullanıcı adının yanına çıkan etiket
// (kullanıcı isteği). Web karşılığı: client/src/components/moderation/BlockedMeTag.jsx.
export default function BlockedMeTag({ userId, style }: { userId?: number | string | null; style?: StyleProp<ViewStyle> }) {
  const ids = useBlockedByIds();
  if (userId == null || !ids.has(Number(userId))) return null;
  return (
    <View className="self-start rounded-full bg-red-600/10 border border-red-600/30 px-2 py-0.5" style={style}>
      <Text className="text-red-600 text-[11px] font-bold">Sizi engelledi ama admin olmak 😎</Text>
    </View>
  );
}
