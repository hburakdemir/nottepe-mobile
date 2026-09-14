import React from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import {
  Bell,
  Bookmark,
  Calculator,
  CalendarDays,
  FileText,
  ListChecks,
  MessagesSquare,
  type LucideIcon,
} from 'lucide-react-native';
import { useTheme, useThemeColors } from '../../context/ThemeContext';

// Profil ekranının parçalarının ORTAK kullandığı sabitler ve küçük bileşenler.
// Tek bir 1632 satırlık dosyadan çıkarılan parçalar (bkz. bu klasördeki diğer
// dosyalar) bunlara ayrı ayrı ihtiyaç duyuyor; kopyalamak yerine tek kaynak.
//
// `src/components/layout/tabBarMetrics.ts` ile aynı desen: PascalCase bileşen
// dosyalarının yanında, paylaşılan sabitleri tutan tek bir dosya.

export const TABS = [
  { key: 'posts', label: 'Postlar', icon: FileText },
  { key: 'saved', label: 'Kayıtlı', icon: Bookmark },
  { key: 'lists', label: 'Checklistler', icon: ListChecks },
  { key: 'akts', label: 'AKTS', icon: Calculator },
  { key: 'schedule', label: 'Program', icon: CalendarDays },
  { key: 'follows', label: 'Takip', icon: Bell },
  { key: 'forums', label: 'Forumlar', icon: MessagesSquare },
] as const;

export type TabKey = (typeof TABS)[number]['key'];

export function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' });
}

// Sekme verisi ilk kez (ya da bir mutasyondan sonra yeniden) çekilirken
// gösteriliyor — "henüz kaydın yok" metinleri yükleme bitmeden görünmesin diye.
export function TabLoading() {
  const colors = useThemeColors();
  // `color` ham değer almak zorunda (className değil) — token karşılığı
  // `useThemeColors()`'tan geliyor, bkz. ThemeContext.tsx'teki not.
  return <ActivityIndicator className="mt-6" color={colors.accent} />;
}

export function EmptyState({
  icon: Icon,
  text,
  actionLabel,
  onAction,
}: {
  icon: LucideIcon;
  text: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  return (
    <View className="items-center py-[50px] gap-2.5">
      <Icon size={40} color={isDark ? '#6b7280' : '#d1d5db'} />
      <Text className="text-muted2 text-[13.5px] text-center px-[30px]">{text}</Text>
      {!!actionLabel && (
        <Pressable className="bg-brand rounded-[10px] px-[18px] py-2.5 mt-1" onPress={onAction}>
          <Text className="text-white text-[13px] font-bold">{actionLabel}</Text>
        </Pressable>
      )}
    </View>
  );
}

// NativeWind'in `shadow-*` sınıfı BİLEREK kullanılmıyor: Android'de elevation'ı
// güvenilir çevirmiyor (ayrıntılı gerekçe AppHeader.tsx'te). Bunlar Tailwind
// shadow değerlerinin tam RN karşılığı ve projedeki 11 ekranın ortak deseni.
export const SHADOW_MD = {
  shadowColor: '#000',
  shadowOpacity: 0.1,
  shadowRadius: 8,
  shadowOffset: { width: 0, height: 3 },
  elevation: 3,
};

export const SHADOW_SM = {
  shadowColor: '#000',
  shadowOpacity: 0.06,
  shadowRadius: 6,
  shadowOffset: { width: 0, height: 2 },
  elevation: 2,
};
