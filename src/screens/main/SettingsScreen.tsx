import React, { useCallback, useState } from 'react';
import { Linking, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Constants from 'expo-constants';
import {
  BadgeHelp,
  Ban,
  BellRing,
  ChevronRight,
  FileText,
  HardDrive,
  Moon,
  ShieldCheck,
  Sun,
  Trash2,
  UserPen,
  type LucideIcon,
} from 'lucide-react-native';
import { useTheme, useThemeColors } from '../../context/ThemeContext';
import { TAB_BAR_SAFE_PADDING } from '../../components/layout/tabBarMetrics';
import type { RootStackParamList } from '../../navigation/types';
import NotificationSettingsSheet from '../../components/notifications/NotificationSettingsSheet';
import ThemePickerModal from '../../components/settings/ThemePickerModal';
import FileCacheSheet, { formatBytes } from '../../components/settings/FileCacheSheet';
import { listCachedFiles } from '../../lib/fileCache';
import TermsModal from '../../components/auth/TermsModal';
import DeleteAccountModal from '../../components/profile/DeleteAccountModal';
import ProfileEditModal from '../../components/profile/ProfileEditModal';
import { useMyBadges } from '../../hooks/profile/useProfileLists';
import type { Badge } from '../../components/BadgeChip';
import { useShellRefresh } from '../../hooks/usePullRefresh';

const THEME_LABELS = { system: 'Sistem', light: 'Açık', dark: 'Koyu' } as const;

interface RowProps {
  icon: LucideIcon;
  label: string;
  value?: string;
  onPress: () => void;
  danger?: boolean;
  iconColor: string;
}

function Row({ icon: Icon, label, value, onPress, danger, iconColor }: RowProps) {
  // Sabit `#dc2626` / `text-red-600` yerine temanın tehlike rengi: koyu temada
  // açık bir kırmızıya dönüyor, koyu zeminde okunuyor.
  const colors = useThemeColors();
  return (
    <Pressable onPress={onPress} className="flex-row items-center gap-3.5 px-4 py-3.5 active:bg-inset">
      <Icon size={20} color={danger ? colors.danger : iconColor} />
      <Text className={`flex-1 text-[15px] font-semibold ${danger ? 'text-danger' : 'text-ink'}`}>{label}</Text>
      {!!value && <Text className="text-muted text-[14px]">{value}</Text>}
      {!danger && <ChevronRight size={18} color={iconColor} style={{ opacity: 0.5 }} />}
    </Pressable>
  );
}

// Satırlar arası ince çizgi — ikonun hizasından başlıyor (iOS Ayarlar gibi).
function Sep() {
  return <View className="h-px bg-line-soft ml-[50px]" />;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="mb-6">
      {/* CSS `uppercase` Türkçe bilmiyor ("BILDIRIMLER") — tr-TR ile büyütülüyor. */}
      <Text className="text-muted text-[12px] font-bold tracking-wider px-1 mb-2">{title.toLocaleUpperCase('tr-TR')}</Text>
      <View className="bg-surface rounded-[14px] border border-line-soft overflow-hidden">{children}</View>
    </View>
  );
}

// Menüdeki eski "Temayı Ayarla" satırının yerini alan sayfa (kullanıcı isteği):
// hesap, bildirim, görünüm ve hukuki metinler tek yerde. Yeni ayarlar ileride
// buraya bölüm olarak eklenecek. Web'deki karşılığı client/src/pages/SettingsPage.jsx.
const NO_BADGES: Badge[] = [];

export default function SettingsScreen() {
  const pull = useShellRefresh();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { theme, themePreference } = useTheme();
  const iconColor = theme === 'dark' ? '#DFD0B8' : '#374151';
  const [sheet, setSheet] = useState<null | 'edit' | 'notifications' | 'theme' | 'terms' | 'delete' | 'storage'>(null);
  const { data: badges = NO_BADGES } = useMyBadges();
  const [cacheBytes, setCacheBytes] = useState(0);
  const refreshCacheSize = useCallback(() => {
    setCacheBytes(listCachedFiles().reduce((sum, e) => sum + e.size, 0));
  }, []);
  useFocusEffect(refreshCacheSize);
  const close = () => {
    if (sheet === 'storage') refreshCacheSize();
    setSheet(null);
  };
  const version = Constants.expoConfig?.version;

  return (
    <View className="flex-1 bg-ground">
      {/* Alt pay sekme çubuğu kadar: AppShell'deki WaveTabBar içeriğin ÜSTÜNE
          biniyor; 40 px'lik eski payda en alttaki "Tehlikeli bölge" ve sürüm
          yazısı çubuğun altında kalıyordu. */}
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: TAB_BAR_SAFE_PADDING }} refreshControl={<RefreshControl refreshing={pull.refreshing} onRefresh={pull.onRefresh} />}>
        <Section title="Hesap">
          <Row
            icon={UserPen}
            label="Profil bilgilerini düzenle"
            iconColor={iconColor}
            onPress={() => setSheet('edit')}
          />
          <Sep />
          <Row icon={Ban} label="Engellenen kullanıcılar" iconColor={iconColor} onPress={() => navigation.navigate('BlockedUsers')} />
        </Section>

        <Section title="Bildirimler">
          <Row icon={BellRing} label="Bildirim tercihleri" iconColor={iconColor} onPress={() => setSheet('notifications')} />
        </Section>

        <Section title="Görünüm">
          <Row
            icon={theme === 'dark' ? Moon : Sun}
            label="Tema"
            value={THEME_LABELS[themePreference]}
            iconColor={iconColor}
            onPress={() => setSheet('theme')}
          />
        </Section>

        <Section title="Depolama">
          <Row
            icon={HardDrive}
            label="Önbelleğe alınan dosyalar"
            value={cacheBytes > 0 ? formatBytes(cacheBytes) : 'Boş'}
            iconColor={iconColor}
            onPress={() => setSheet('storage')}
          />
        </Section>

        <Section title="Hakkında">
          <Row icon={FileText} label="Kullanım Koşulları" iconColor={iconColor} onPress={() => setSheet('terms')} />
          <Sep />
          <Row
            icon={ShieldCheck}
            label="KVKK Aydınlatma Metni"
            iconColor={iconColor}
            onPress={() => Linking.openURL('https://nottepe.com/kvkk')}
          />
          <Sep />
          <Row icon={BadgeHelp} label="Yardım ve iletişim" iconColor={iconColor} onPress={() => navigation.navigate('Help')} />
        </Section>

        <Section title="Tehlikeli bölge">
          <Row icon={Trash2} label="Hesabımı sil" danger iconColor={iconColor} onPress={() => setSheet('delete')} />
        </Section>

        {!!version && <Text className="text-muted2 text-[12px] text-center mt-2">Nottepe {version}</Text>}
      </ScrollView>

      <NotificationSettingsSheet visible={sheet === 'notifications'} onClose={close} />
      <ThemePickerModal visible={sheet === 'theme'} onClose={close} />
      <TermsModal visible={sheet === 'terms'} onClose={close} />
      <FileCacheSheet visible={sheet === 'storage'} onClose={close} />
      {/* Profil sekmesindekiyle aynı modal, burada da açılıyor — kullanıcıyı
          Profil'e götürmüyor (kullanıcı isteği). */}
      {sheet === 'edit' && (
        <ProfileEditModal
          badges={badges}
          onClose={close}
          onDeleteAccountRequest={() => setSheet('delete')}
        />
      )}
      {sheet === 'delete' && <DeleteAccountModal onClose={close} />}
    </View>
  );
}
