import React, { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { DrawerContentComponentProps } from '@react-navigation/drawer';
import { useDrawerProgress, useDrawerStatus } from '@react-navigation/drawer';
import {
  Bell,
  BadgeHelp,
  Calculator,
  CalendarDays,
  Check,
  ChevronDown,
  GraduationCap,
  HeartHandshake,
  HelpCircle,
  Lightbulb,
  ListChecks,
  LogOut,
  Megaphone,
  Moon,
  Smartphone,
  Sun,
  Trophy,
  UtensilsCrossed,
  Wrench,
  type LucideIcon,
} from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { useTheme, type ThemePreference } from '../../context/ThemeContext';
import { avatarAPI, departmentFollowAPI, notificationAPI, postsAPI, savedPostsAPI, userNotificationAPI } from '../../lib/api';
import type { AvatarData } from '../avatar/AvatarDisplay';
import AvatarDisplay from '../avatar/AvatarDisplay';
import DeerIcon from '../icons/DeerIcon';
import type { RootStackParamList } from '../../navigation/types';

interface MenuLinkProps {
  icon: LucideIcon;
  label: string;
  color: string;
  badge?: number;
  onPress: () => void;
}

// Web'in `px-3 py-2 rounded-md` linkleriyle (Navbar.jsx satır ~467-540) birebir
// aynı padding/font-size; ikon rengi web'deki gibi metinle aynı currentColor'ı
// takip ediyor (dark: darktext, light: gray-700) — sabit gri değil.
function MenuLink({ icon: Icon, label, color, badge, onPress }: MenuLinkProps) {
  return (
    <Pressable onPress={onPress} className="flex-row items-center gap-4 px-3 py-3.5 rounded-md active:bg-gray-100 dark:active:bg-gray-700/40">
      <Icon size={22} color={color} />
      <Text className="text-gray-700 dark:text-darktext text-[20px] font-bold">{label}</Text>
      {!!badge && badge > 0 && (
        <View className="ml-auto min-w-[16px] h-4 px-1 rounded-full bg-red-500 items-center justify-center">
          <Text className="text-white text-[10px] font-bold">{badge > 99 ? '99+' : badge}</Text>
        </View>
      )}
    </Pressable>
  );
}

function Divider() {
  return <View className="h-px bg-gray-200 dark:bg-gray-700/60 my-3" />;
}

interface FollowedDepartment {
  faculty: string;
  department: string;
  created_at?: string;
}

// Web'in Navbar'ında yok — mobile-özel eklenti. Boşsa "eklemek için dokun"
// Departments sekmesine götürüyor; doluysa ilk (en eski) takip edilen bölümü
// gösteriyor, birden fazlaysa altında "Devamını gör" ile geri kalanı açıyor.
function FollowedDepartmentsSection({
  iconColor,
  isOpen,
  onNavigate,
}: {
  iconColor: string;
  isOpen: boolean;
  onNavigate: (fn: () => void) => void;
}) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [follows, setFollows] = useState<FollowedDepartment[] | null>(null);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    departmentFollowAPI
      .getMine()
      .then((res) => setFollows(res.data?.follows || []))
      .catch(() => setFollows([]));
  }, [isOpen]);

  if (follows === null) return null;

  if (follows.length === 0) {
    return (
      <Pressable
        onPress={() => onNavigate(() => navigation.navigate('Departments'))}
        className="flex-row items-center gap-4 px-3 py-3.5 rounded-md active:bg-gray-100 dark:active:bg-gray-700/40"
      >
        <GraduationCap size={22} color={iconColor} />
        <Text className="text-gray-700 dark:text-darktext text-[20px] font-bold flex-1">
          Henüz takip ettiğin bölüm yok, eklemek için dokun
        </Text>
      </Pressable>
    );
  }

  // API `created_at DESC` (en yeni önce) döndürüyor — "ilk takip edilen" en
  // eski kayıt, yani ters çevrilmiş dizinin ilk elemanı.
  const ordered = [...follows].reverse();
  const first = ordered[0];
  const rest = ordered.slice(1);

  return (
    <View>
      <Pressable
        onPress={() =>
          onNavigate(() => navigation.navigate('DepartmentDetail', { faculty: first.faculty, department: first.department }))
        }
        className="flex-row items-center gap-4 px-3 py-3.5 rounded-md active:bg-gray-100 dark:active:bg-gray-700/40"
      >
        <GraduationCap size={22} color={iconColor} />
        <Text className="text-gray-700 dark:text-darktext text-[20px] font-bold flex-1" numberOfLines={1}>
          {first.department}
        </Text>
      </Pressable>

      {rest.length > 0 && (
        <>
          <Pressable onPress={() => setShowAll((v) => !v)} className="pl-11 pr-3 py-1.5">
            <Text className="text-brand dark:text-brand-light text-[13.5px] font-semibold">
              {showAll ? 'Daha az göster' : `Devamını gör (${rest.length})`}
            </Text>
          </Pressable>
          {showAll &&
            rest.map((f) => (
              <Pressable
                key={`${f.faculty}-${f.department}`}
                onPress={() => onNavigate(() => navigation.navigate('DepartmentDetail', { faculty: f.faculty, department: f.department }))}
                className="pl-11 pr-3 py-2 rounded-md active:bg-gray-100 dark:active:bg-gray-700/40"
              >
                <Text className="text-gray-700 dark:text-darktext text-[15px] font-semibold" numberOfLines={1}>
                  {f.department}
                </Text>
              </Pressable>
            ))}
        </>
      )}
    </View>
  );
}

const TOOLS_EXTRA = [
  { key: 'AktsCalculator' as const, icon: Calculator, label: 'AKTS / GANO Hesaplama' },
  { key: 'CafeteriaMenu' as const, icon: UtensilsCrossed, label: 'Yemek Listesi' },
  { key: 'Checklists' as const, icon: ListChecks, label: 'Checklistler' },
  { key: 'Schedule' as const, icon: CalendarDays, label: 'Ders Programı' },
  { key: 'Leaderboard' as const, icon: Trophy, label: 'Liderlik Tablosu' },
];

// Not İstekleri/SSS/Öneriler/Yardım zaten üstte ayrı link olarak var — burada
// sadece o dörtte olmayan araçlar listeleniyor (bkz. ToolsScreen.tsx TOOLS).
// Ok, açılınca Reanimated ile 180° dönüyor (statik CSS transform değil).
function ToolsSection({ iconColor, onNavigate }: { iconColor: string; onNavigate: (fn: () => void) => void }) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [open, setOpen] = useState(false);
  const rotation = useSharedValue(0);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    rotation.value = withTiming(next ? 180 : 0, { duration: 200 });
  };

  const chevronStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${rotation.value}deg` }] }));

  return (
    <View>
      <Pressable onPress={toggle} className="flex-row items-center gap-4 px-3 py-3.5 rounded-md active:bg-gray-100 dark:active:bg-gray-700/40">
        <Wrench size={22} color={iconColor} />
        <Text className="text-gray-700 dark:text-darktext text-[20px] font-bold flex-1">Araçlar</Text>
        <Animated.View style={chevronStyle}>
          <ChevronDown size={22} color={iconColor} />
        </Animated.View>
      </Pressable>
      {open && (
        <View className="gap-1 mt-1">
          {TOOLS_EXTRA.map(({ key, icon: Icon, label }) => (
            <MenuLink key={key} icon={Icon} label={label} color={iconColor} onPress={() => onNavigate(() => navigation.navigate(key))} />
          ))}
        </View>
      )}
    </View>
  );
}

const THEME_OPTIONS: { key: ThemePreference; label: string; icon: LucideIcon }[] = [
  { key: 'system', label: 'Sistem', icon: Smartphone },
  { key: 'light', label: 'Açık', icon: Sun },
  { key: 'dark', label: 'Koyu', icon: Moon },
];

// Diğer alt-sayfa seçicileriyle aynı taban sayfa (bkz. HomeScreen.tsx fakülte
// seçici) — altdan açılan sade bir sheet, 3 seçenek + seçili olanda tik.
function ThemePickerModal({
  visible,
  onClose,
  iconColor,
}: {
  visible: boolean;
  onClose: () => void;
  iconColor: string;
}) {
  const { themePreference, setThemePreference } = useTheme();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable className="flex-1 bg-black/50 justify-end" onPress={onClose}>
        <View className="bg-primary dark:bg-darkbgbutton rounded-t-[18px] p-4">
          <Text className="text-secondary dark:text-darktext text-base font-bold mb-2 px-1">Temayı Ayarla</Text>
          {THEME_OPTIONS.map(({ key, label, icon: Icon }) => {
            const selected = themePreference === key;
            return (
              <Pressable
                key={key}
                onPress={() => {
                  setThemePreference(key);
                  onClose();
                }}
                className="flex-row items-center gap-4 px-3 py-3 rounded-md active:bg-gray-100 dark:active:bg-gray-700/40"
              >
                <Icon size={20} color={iconColor} />
                <Text className="text-gray-700 dark:text-darktext text-[16px] font-semibold flex-1">{label}</Text>
                {selected && <Check size={18} color="#2F5755" />}
              </Pressable>
            );
          })}
        </View>
      </Pressable>
    </Modal>
  );
}

// İtilen içerik panelin ÖNÜNDE göründüğü için gölge burada, panelin sağ
// kenarına yakın katmanlar halinde — kenara en yakın katman en koyu, dışa
// (sola) doğru şeffaflaşıyor (bkz. shadowFadeStyle kullanım yeri).
const SHADOW_STEPS: { width: number; alpha: number }[] = [
  { width: 3, alpha: 0.45 },
  { width: 6, alpha: 0.32 },
  { width: 10, alpha: 0.22 },
  { width: 16, alpha: 0.13 },
  { width: 24, alpha: 0.06 },
];

// Web'in Navbar.jsx `isMenuOpen` panelinin mobil karşılığı — X (Twitter)
// uygulamasındaki gibi soldan açılan, arkadaki sayfayı iten gerçek bir Drawer
// (bkz. RootNavigator.tsx + PushableStack.tsx). Panelin genişliğini/animasyonunu
// artık Drawer.Navigator kendi yönetiyor; bu bileşen sadece içerik. Admin linki
// bilinçli olarak yok (PLAN.md: yönetim paneli web'de kalıyor).
export default function MenuDrawerContent({ navigation }: DrawerContentComponentProps) {
  const { user, logout } = useAuth();
  const { theme } = useTheme();
  const [showThemePicker, setShowThemePicker] = useState(false);
  const iconColor = theme === 'dark' ? '#DFD0B8' : '#374151';
  const brandColor = theme === 'dark' ? '#5A9690' : '#2F5755';
  const isOpen = useDrawerStatus() === 'open';
  const drawerProgress = useDrawerProgress();
  // İtilen sayfa önde göründüğü için gölge onun kendi kenarında değil, ARKADA
  // KALAN bu panelin sağ kenarında hissedilmeli (bkz. PushableStack.tsx —
  // native Android shadow/elevation bu iç içe Drawer.Navigator + Reanimated
  // kombinasyonunda render olmuyor, o yüzden burada da elle katmanlanmış
  // yarı saydam şeritlerle taklit ediyoruz).
  const shadowFadeStyle = useAnimatedStyle(() => ({ opacity: drawerProgress.value }));

  const [avatar, setAvatar] = useState<AvatarData | null>(null);
  const [broadcastUnread, setBroadcastUnread] = useState(0);
  const [personalUnread, setPersonalUnread] = useState(0);
  const [myPostsCount, setMyPostsCount] = useState(0);
  const [savedPostsCount, setSavedPostsCount] = useState(0);

  // Drawer içeriği artık kalıcı mount'lu (her açılışta unmount/remount olmuyor)
  // — bu yüzden bu fetch'ler `isOpen`'a bağlı: her açılışta tazeleniyor, eski
  // (her seferinde taze mount olan) davranışla aynı garanti korunuyor.
  useEffect(() => {
    if (!isOpen) return;
    avatarAPI
      .get()
      .then((res) => setAvatar(res.data?.avatar || null))
      .catch(() => setAvatar(null));
    notificationAPI
      .getActive()
      .then((res) => setBroadcastUnread(res.data?.length || 0))
      .catch(() => setBroadcastUnread(0));
    userNotificationAPI
      .getUnreadCount()
      .then((res) => setPersonalUnread(res.data?.count || 0))
      .catch(() => setPersonalUnread(0));
    // X'in "Takip edilen/Takipçiler" istatistik satırının karşılığı — bizde
    // sosyal takip yok, bu yüzden kendi post sayılarımızı aynı kalın-sayı +
    // gri-etiket biçiminde gösteriyoruz (bkz. ProfileScreen.tsx fetchAll).
    postsAPI
      .getMyPosts()
      .then((res) => setMyPostsCount(res.data?.length || 0))
      .catch(() => setMyPostsCount(0));
    savedPostsAPI
      .getSavedPosts()
      .then((res) => setSavedPostsCount(res.data?.length || 0))
      .catch(() => setSavedPostsCount(0));
  }, [isOpen]);

  const close = () => navigation.closeDrawer();

  const go = (fn: () => void) => {
    close();
    fn();
  };

  const handleLogout = async () => {
    close();
    await logout();
  };

  const stackNavigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  return (
    <View className="flex-1 bg-primary dark:bg-darkbgbutton">
      <SafeAreaView edges={['top', 'left', 'bottom']} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: 12, gap: 4 }}>
          {/* X'te üstte kapatma butonu yok — panel dışına dokunma/kaydırma ile
              kapanıyor (bkz. PushableStack.tsx overlay + RootNavigator.tsx
              swipeEdgeWidth). Sağ üstte rozetli ikon çubuğu var; bizde bu
              ikonların karşılığı liste içindeki Bildirimler/Duyurular — o
              satırlar tekrar olmasın diye buraya taşındı. */}
          <View className="flex-row items-center justify-end gap-2 px-1 pb-1">
            <Pressable
              onPress={() => go(() => stackNavigation.navigate('Notifications', { initialTab: 'aktivite' }))}
              hitSlop={8}
              accessibilityLabel="Bildirimler"
              className="w-10 h-10 rounded-full items-center justify-center bg-gray-100 dark:bg-gray-700/40"
            >
              <Bell size={20} color={iconColor} />
              {personalUnread > 0 && (
                <View className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-red-500 items-center justify-center border-2 border-primary dark:border-darkbgbutton">
                  <Text className="text-white text-[10px] font-bold">{personalUnread > 99 ? '99+' : personalUnread}</Text>
                </View>
              )}
            </Pressable>
            <Pressable
              onPress={() => go(() => stackNavigation.navigate('Notifications', { initialTab: 'duyurular' }))}
              hitSlop={8}
              accessibilityLabel="Duyurular"
              className="w-10 h-10 rounded-full items-center justify-center bg-gray-100 dark:bg-gray-700/40"
            >
              <Megaphone size={20} color={iconColor} />
              {broadcastUnread > 0 && (
                <View className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-red-500 items-center justify-center border-2 border-primary dark:border-darkbgbutton">
                  <Text className="text-white text-[10px] font-bold">{broadcastUnread > 99 ? '99+' : broadcastUnread}</Text>
                </View>
              )}
            </Pressable>
          </View>

          <Pressable onPress={() => go(() => stackNavigation.navigate('Profile'))} className="px-3 py-2 rounded-md active:bg-gray-100 dark:active:bg-gray-700/40">
            <View className="w-[60px] h-[60px] rounded-full overflow-hidden items-center justify-center bg-brand/10 dark:bg-brand-light/15 mb-2">
              {avatar ? <AvatarDisplay avatar={avatar} size={60} showBg={false} /> : <DeerIcon size={32} color={brandColor} />}
            </View>
            <Text className="text-secondary dark:text-darktext text-[22px] font-extrabold">
              {user?.full_name || user?.username}
            </Text>
            {!!user?.username && (
              <Text className="text-gray-500 dark:text-gray-400 text-[15px] font-normal">@{user.username}</Text>
            )}
          </Pressable>

          {/* X'in takipçi/takip edilen istatistik satırının karşılığı — bizde
              sosyal takip yerine kendi notların önemli, o yüzden "Notlarım" /
              "Kaydettiğim Notlarım" sayıları (bkz. ProfileScreen.tsx TABS: posts/saved),
              X'teki kalın-sayı + gri-etiket biçiminde. */}
          <View className="flex-row gap-5 px-3 pb-2">
            <Pressable onPress={() => go(() => stackNavigation.navigate('Profile', { initialTab: 'posts' }))} className="flex-row items-baseline gap-1">
              <Text className="text-secondary dark:text-darktext text-[15px] font-extrabold">{myPostsCount}</Text>
              <Text className="text-gray-500 dark:text-gray-400 text-[15px] font-semibold">Notlarım</Text>
            </Pressable>
            <Pressable onPress={() => go(() => stackNavigation.navigate('Profile', { initialTab: 'saved' }))} className="flex-row items-baseline gap-1">
              <Text className="text-secondary dark:text-darktext text-[15px] font-extrabold">{savedPostsCount}</Text>
              <Text className="text-gray-500 dark:text-gray-400 text-[15px] font-semibold">Kaydettiğim Notlarım</Text>
            </Pressable>
          </View>

          <MenuLink
            icon={HeartHandshake}
            label="Not İstekleri"
            color={iconColor}
            onPress={() => go(() => stackNavigation.navigate('NoteRequests'))}
          />
          <MenuLink
            icon={HelpCircle}
            label="Sık Sorulan Sorular"
            color={iconColor}
            onPress={() => go(() => stackNavigation.navigate('Faq'))}
          />
          <MenuLink
            icon={Lightbulb}
            label="Öneriler"
            color={iconColor}
            onPress={() => go(() => stackNavigation.navigate('Suggestions'))}
          />
          <MenuLink icon={BadgeHelp} label="Yardım" color={iconColor} onPress={() => go(() => stackNavigation.navigate('Help'))} />

          <FollowedDepartmentsSection iconColor={iconColor} isOpen={isOpen} onNavigate={go} />
          <ToolsSection iconColor={iconColor} onNavigate={go} />

          <Divider />

          <Pressable
            onPress={() => setShowThemePicker(true)}
            className="flex-row items-center gap-4 px-3 py-3.5 rounded-md active:bg-gray-100 dark:active:bg-gray-700/40"
          >
            {theme === 'dark' ? <Moon size={22} color={iconColor} /> : <Sun size={22} color={iconColor} />}
            <Text className="text-gray-700 dark:text-darktext text-[20px] font-bold">Temayı Ayarla</Text>
          </Pressable>
          <Pressable
            onPress={handleLogout}
            className="flex-row items-center gap-4 px-3 py-3.5 rounded-md active:bg-red-50 dark:active:bg-red-900/20"
          >
            <LogOut size={22} color="#dc2626" />
            <Text className="text-red-600 text-[20px] font-bold">Çıkış Yap</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>

      <ThemePickerModal visible={showThemePicker} onClose={() => setShowThemePicker(false)} iconColor={iconColor} />

      <Animated.View style={[StyleSheet.absoluteFill, shadowFadeStyle]} pointerEvents="none">
        {SHADOW_STEPS.map((step) => (
          <View
            key={step.width}
            style={{
              position: 'absolute',
              right: 0,
              top: 0,
              bottom: 0,
              width: step.width,
              backgroundColor: `rgba(0,0,0,${step.alpha})`,
            }}
          />
        ))}
      </Animated.View>
    </View>
  );
}
