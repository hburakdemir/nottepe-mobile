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

/** Profil şablonu iki modda çalışıyor: `me` oturum sahibinin kendi profili,
 *  `user` başka bir kullanıcının herkese açık profili. Tek fark etiketler ve
 *  yazma yetkisi — düzen, renk ve yükleme davranışı AYNI (testçi şikâyeti:
 *  "başka bir kullanıcı profili görüntülendiğinde tablardaki renkler loading
 *  vs. kendi profilini görüntülediğin gibi olmalı, tek şablon olmalı"). */
export type ProfileMode = 'me' | 'user';

// Sekmelerin tek kaynağı. Etiketler moda göre değişiyor ("Postlar" vs.
// "Paylaştığı Notlar"), geri kalan her şey ortak. `sectionKey`, profil
// sahibinin gizleyebildiği bölümün adı — `null` olan sekme hep görünür.
const TAB_BASE = [
  { key: 'posts', icon: FileText, sectionKey: null, meLabel: 'Postlar', userLabel: 'Paylaştığı Notlar' },
  { key: 'saved', icon: Bookmark, sectionKey: 'saved_posts', meLabel: 'Kayıtlı', userLabel: 'Kaydettikleri' },
  { key: 'lists', icon: ListChecks, sectionKey: 'my_lists', meLabel: 'Checklistler', userLabel: 'Checklistleri' },
  { key: 'akts', icon: Calculator, sectionKey: 'akts', meLabel: 'AKTS', userLabel: 'AKTS Hesapları' },
  { key: 'schedule', icon: CalendarDays, sectionKey: 'schedule', meLabel: 'Program', userLabel: 'Ders Programı' },
  { key: 'follows', icon: Bell, sectionKey: 'follows', meLabel: 'Takip', userLabel: 'Takip Ettikleri' },
  { key: 'forums', icon: MessagesSquare, sectionKey: 'forums', meLabel: 'Forumlar', userLabel: 'Forumlar' },
] as const;

export type TabKey = (typeof TAB_BASE)[number]['key'];

export interface TabDef {
  key: TabKey;
  label: string;
  icon: LucideIcon;
  sectionKey: string | null;
}

// Mod başına BİR kez kuruluyor: `TabStrip` ve şablonun pager'ı bu diziyi prop
// olarak alıyor ve ikisi de `React.memo`'lu — her render'da yeni bir dizi
// üretilse memo hiçbir zaman bail-out yapamazdı.
const TABS_BY_MODE: Record<ProfileMode, readonly TabDef[]> = {
  me: TAB_BASE.map((t) => ({ key: t.key, label: t.meLabel, icon: t.icon, sectionKey: t.sectionKey })),
  user: TAB_BASE.map((t) => ({ key: t.key, label: t.userLabel, icon: t.icon, sectionKey: t.sectionKey })),
};

export function makeTabs(mode: ProfileMode): readonly TabDef[] {
  return TABS_BY_MODE[mode];
}

/** Kendi profilinin sekme listesi — `makeTabs('me')` ile aynı referans. */
export const TABS = TABS_BY_MODE.me;

// Profil sahibi bölümleri tek tek gizleyebiliyor; sunucu yalnızca DEĞİŞTİRİLEN
// anahtarları döndürüyor, o yüzden varsayılan "hepsi açık" ile birleştiriliyor.
export const DEFAULT_SECTION_VISIBILITY: Record<string, boolean> = {
  saved_posts: true,
  my_lists: true,
  akts: true,
  schedule: true,
  follows: true,
  forums: true,
  badges: true,
};

/** Görünürlük ayarına göre filtrelenmiş sekme listesi. Yeni dizi döndürüyor —
 *  çağıran tarafın `useMemo`'lamasi ŞART (bkz. TABS_BY_MODE notu). */
export function visibleTabs(mode: ProfileMode, sectionVisibility: Record<string, boolean>): TabDef[] {
  return makeTabs(mode).filter((t) => t.sectionKey === null || sectionVisibility[t.sectionKey] !== false);
}

export function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' });
}

// Sekme verisi ilk kez (ya da bir mutasyondan sonra yeniden) çekilirken
// gösteriliyor — "henüz kaydın yok" metinleri yükleme bitmeden görünmesin diye.
export function TabLoading() {
  const colors = useThemeColors();
  return <ActivityIndicator style={{ marginTop: 24 }} color={colors.accent} />;
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
