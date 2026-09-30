import React from 'react';
import { Pressable, Text } from 'react-native';

// Filtre çipi (Duyurular'da Tümü + kategoriler, Şikâyetler'de durum). Ayrı
// bileşen olmasının iki sebebi var:
// (1) dokunma alanı tek yerde büyütülüyor — çipin kendisi `py-1.5` ile 24-26px
// yüksekliğinde, parmak payı olmadan gerçek cihazda ıskalanabiliyor;
// (2) basılıyken sönükleşme (`active:opacity-60`) tüm çiplerde aynı.
export default function FilterChip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
      onPress={onPress}
      className={`rounded-full px-3 py-1.5 border active:opacity-60 ${
        selected ? 'bg-brand border-brand' : 'bg-surface border-line'
      }`}
    >
      <Text className={`text-xs font-medium ${selected ? 'text-white' : 'text-muted'}`}>{label}</Text>
    </Pressable>
  );
}
