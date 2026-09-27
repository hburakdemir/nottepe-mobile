import React, { useState } from 'react';
import { Pressable, Text, type StyleProp, type ViewStyle } from 'react-native';
import { EyeOff } from 'lucide-react-native';
import { useBlockedIds } from '../../hooks/useBlockedIds';
import { useThemeColors } from '../../context/ThemeContext';

interface Props {
  /** İçeriğin yazarı. Engellediklerim arasında değilse içerik olduğu gibi çizilir. */
  authorId?: number | string | null;
  /** Kutuda geçen içerik adı: "gönderi", "yorum", "soru", "öneri", "not isteği". */
  kind: string;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}

// Engellediğim kişinin içeriği listeden çıkarılmıyor; yerine bu kutu çiziliyor,
// dokununca içerik açılıyor (kullanıcı isteği, X'teki gibi). Web karşılığı:
// client/src/components/moderation/BlockedContentGate.jsx.
export default function BlockedContentGate({ authorId, kind, style, children }: Props) {
  const blockedIds = useBlockedIds();
  const colors = useThemeColors();
  const [revealed, setRevealed] = useState(false);

  if (authorId == null || revealed || !blockedIds.has(Number(authorId))) return <>{children}</>;

  return (
    <Pressable
      onPress={() => setRevealed(true)}
      accessibilityRole="button"
      className="flex-row items-center gap-3 bg-surface border border-line-soft rounded-[14px] px-4 py-3.5"
      style={style}
    >
      <EyeOff size={18} color={colors.muted} />
      <Text className="flex-1 text-muted text-[13.5px] leading-[19px]">
        Engellediğiniz kişiye ait bir {kind} bulunmaktadır.{' '}
        <Text className="text-accent font-semibold">Görüntülemek için tıklayın.</Text>
      </Text>
    </Pressable>
  );
}
