import React, { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { DrawerContentComponentProps } from '@react-navigation/drawer';
import { useDrawerProgress, useDrawerStatus } from '@react-navigation/drawer';
import {
  Bell,
  BadgeHelp,
  Bus,
  Calculator,
  CalendarDays,
  ChevronDown,
  GraduationCap,
  HeartHandshake,
  HelpCircle,
  Lightbulb,
  ListChecks,
  LogOut,
  Megaphone,
  Moon,
  Sun,
  Trophy,
  UtensilsCrossed,
  Wrench,
  type LucideIcon,
} from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { useTheme, type ThemePreference } from '../../context/ThemeContext';
import { departmentFollowAPI, statsAPI } from '../../lib/api';
import { useMyAvatar } from '../../hooks/useMyAvatar';
import { useUnreadNotifications } from '../../hooks/useUnreadNotifications';
import AvatarDisplay from '../avatar/AvatarDisplay';
import DeerIcon from '../icons/DeerIcon';
import { goToTab, navigateApp } from '../../navigation/navigateApp';
import type { RootStackParamList } from '../../navigation/types';
import OptionSheet from './OptionSheet';

interface MenuLinkProps {
  icon: LucideIcon;
  label: string;
  color: string;
  badge?: number;
  onPress: () => void;
  isSubItem?: boolean;
}

// Web'in `px-3 py-2 rounded-md` linkleriyle (Navbar.jsx satır ~467-540) birebir
// aynı padding/font-size; ikon rengi web'deki gibi metinle aynı currentColor'ı
// takip ediyor (dark: darktext, light: gray-700) — sabit gri değil.
function MenuLink({ icon: Icon, label, color, badge, onPress, isSubItem }: MenuLinkProps) {
  const subItemClasses = 'pl-11 pr-3 py-2 rounded-md active:bg-inset';
  const mainItemClasses = 'flex-row items-center gap-4 px-3 py-3.5 rounded-md active:bg-inset';

  const subItemTextClasses = 'text-ink2 text-[13px] font-semibold';
  const mainItemTextClasses = 'text-ink2 text-[17px] font-bold';

  return (
    <Pressable onPress={onPress} className={isSubItem ? subItemClasses : mainItemClasses}>
      {!isSubItem && <Icon size={22} color={color} />}
      <View className="flex-row items-center gap-2 flex-1 ">
        {isSubItem && <Icon size={18} color={color} />}
        <Text className={isSubItem ? subItemTextClasses : mainItemTextClasses}>{label}</Text>
      </View>
      {!!badge && badge > 0 && (
        <View className="ml-auto min-w-[16px] h-4 px-1 rounded-full bg-red-500 items-center justify-center">
          <Text className="text-white text-[10px] font-bold">{badge > 99 ? '99+' : badge}</Text>
        </View>
      )}
    </Pressable>
  );
}

function Divider() {
  return <View className="h-px bg-inset my-3" />;
}

interface FollowedDepartment {
  faculty: string;
  department: string;
  created_at?: string;
}

// Web'in Navbar'ında yok — mobile-özel eklenti. Başlık artık takip edilen ilk
// bölümün ADI değil, sabit "Takip Ettiğim Bölümler" (kullanıcı isteği): tek bir
// bölüm adı, listenin ne olduğunu anlatmıyordu. Bölümler onun altında alt-öğe
// olarak duruyor; ilki hep görünür, kalanı "Tümünü gör" ile açılıyor ve
// "Daha az göster" AÇILAN LİSTENİN ALTINDA — yani en alttaki bölümün
// ardında — duruyor.
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
  // Başlık artık "Araçlar" gibi açılır-kapanır (kullanıcı isteği: yanında aşağı
  // ok butonu olmalı) — ok Reanimated ile 180° dönüyor, statik transform değil.
  const [open, setOpen] = useState(true);
  const rotation = useSharedValue(180);

  useEffect(() => {
    // Menü kapanınca liste başa dönsün — bir sonraki açılışta panel hep en
    // baştaki haliyle karşılasın (bkz. MenuDrawerContent scroll sıfırlaması).
    if (!isOpen) {
      setShowAll(false);
      setOpen(true);
      rotation.value = 180;
      return;
    }
    departmentFollowAPI
      .getMine()
      .then((res) => setFollows(res.data?.follows || []))
      .catch(() => setFollows([]));
  }, [isOpen, rotation]);

  const chevronStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${rotation.value}deg` }] }));

  const toggle = () => {
    const next = !open;
    setOpen(next);
    rotation.value = withTiming(next ? 180 : 0, { duration: 200 });
  };

  if (follows === null) return null;

  const header = (
    <Pressable onPress={toggle} className="flex-row items-center gap-4 px-3 py-3.5 rounded-md active:bg-inset">
      <GraduationCap size={22} color={iconColor} />
      <Text className="text-ink2 text-[17px] font-bold flex-1" numberOfLines={1}>
        Takip Ettiğim Bölümler
      </Text>
      <Animated.View style={chevronStyle}>
        <ChevronDown size={22} color={iconColor} />
      </Animated.View>
    </Pressable>
  );

  if (follows.length === 0) {
    return (
      <View>
        {header}
        {open && (
          <Pressable
            onPress={() => onNavigate(() => goToTab(navigation, 'Departments'))}
            className="pl-11 pr-3 py-2 rounded-md active:bg-inset"
          >
            <Text className="text-muted text-[13.5px] font-semibold">Takip ettiğin bölüm yok</Text>
          </Pressable>
        )}
      </View>
    );
  }

  // API `created_at DESC` (en yeni önce) döndürüyor — "ilk takip edilen" en
  // eski kayıt, yani ters çevrilmiş dizinin ilk elemanı.
  const ordered = [...follows].reverse();
  const visible = showAll ? ordered : ordered.slice(0, 1);
  const hiddenCount = ordered.length - 1;

  return (
    <View>
      {header}

      {open &&
        visible.map((f) => (
          <Pressable
            key={`${f.faculty}-${f.department}`}
            onPress={() => onNavigate(() => navigation.navigate('DepartmentDetail', { faculty: f.faculty, department: f.department }))}
            className="pl-11 pr-3 py-2 rounded-md active:bg-inset"
          >
            <Text className="text-ink2 text-[15px] font-semibold" numberOfLines={1}>
              {f.department}
            </Text>
          </Pressable>
        ))}

      {open && hiddenCount > 0 && (
        <Pressable onPress={() => setShowAll((v) => !v)} className="pl-11 pr-3 py-1.5">
          <Text className="text-accent text-[13.5px] font-semibold">{showAll ? 'Daha az göster' : `Tümünü gör (${hiddenCount})`}</Text>
        </Pressable>
      )}
    </View>
  );
}

const TOOLS_EXTRA = [
  { key: 'AktsCalculator' as const, icon: Calculator, label: 'AKTS / GANO Hesaplama' },
  { key: 'CafeteriaMenu' as const, icon: UtensilsCrossed, label: 'Yemek Listesi' },
  { key: 'Checklists' as const, icon: ListChecks, label: 'Checklistler' },
  { key: 'Schedule' as const, icon: CalendarDays, label: 'Ders Programı' },
  // ToolsScreen'de vardı ama menüdeki listede eksikti (kullanıcı bildirdi).
  { key: 'Ego130Schedule' as const, icon: Bus, label: '130 Ring Saatleri' },
  { key: 'Leaderboard' as const, icon: Trophy, label: 'Liderlik Tablosu' },
];

// Not İstekleri/SSS/Öneriler/Yardım zaten üstte ayrı link olarak var — burada
// sadece o dörtte olmayan araçlar listeleniyor (bkz. ToolsScreen.tsx TOOLS).
// Ok, açılınca Reanimated ile 180° dönüyor (statik CSS transform değil).
function ToolsSection({
  iconColor,
  isDrawerOpen,
  onNavigate,
}: {
  iconColor: string;
  isDrawerOpen: boolean;
  onNavigate: (fn: () => void) => void;
}) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [open, setOpen] = useState(false);
  const rotation = useSharedValue(0);

  // Menü kapanınca kapalı duruma dön: panel her açılışta aynı (en baştaki)
  // görünümde olsun, önceki açılışta açık bıraktığın bölüm hatırlanmasın.
  useEffect(() => {
    if (isDrawerOpen) return;
    setOpen(false);
    rotation.value = 0;
  }, [isDrawerOpen, rotation]);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    rotation.value = withTiming(next ? 180 : 0, { duration: 200 });
  };

  const chevronStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${rotation.value}deg` }] }));

  return (
    <View>
      <Pressable onPress={toggle} className="flex-row items-center gap-4 px-3 py-3.5 rounded-md active:bg-inset">
        <Wrench size={22} color={iconColor} />
        <Text className="text-ink2 text-[17px] font-bold flex-1">Araçlar</Text>
        <Animated.View style={chevronStyle}>
          <ChevronDown size={22} color={iconColor} />
        </Animated.View>
      </Pressable>
      {open && (
        <View className="gap-1 mt-1">
          {TOOLS_EXTRA.map(({ key, icon: Icon, label }) => (
            <MenuLink
              key={key}
              icon={Icon}
              label={label}
              color={iconColor}
              isSubItem
              onPress={() => onNavigate(() => navigateApp(navigation, key))}
            />
          ))}
        </View>
      )}
    </View>
  );
}

const THEME_OPTIONS: { key: ThemePreference; label: string }[] = [
  { key: 'system', label: 'Sistem' },
  { key: 'light', label: 'Açık' },
  { key: 'dark', label: 'Koyu' },
];

// Uygulamadaki her "listeden seç" arayüzü gibi ortak OptionSheet'ten geliyor
// (bkz. components/layout/OptionSheet.tsx) — burada eskiden kendi kopyası vardı.
function ThemePickerModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { themePreference, setThemePreference } = useTheme();

  return (
    <OptionSheet
      visible={visible}
      title="Temayı Ayarla"
      options={THEME_OPTIONS.map((o) => ({ value: o.key, label: o.label }))}
      value={themePreference}
      searchable={false}
      onSelect={(v) => setThemePreference(v as ThemePreference)}
      onClose={onClose}
    />
  );
}

// İtilen içerik panelin ÖNÜNDE göründüğü için gölge burada, panelin sağ
// kenarında — kenara en yakın yer en koyu, dışa (sola) doğru şeffaflaşıyor
// (bkz. shadowFadeStyle kullanım yeri).
//
// ESKİDEN bu, üst üste binen 5 yarı saydam şeritle (3/6/10/16/24dp,
// 0.45/0.32/0.22/0.13/0.06) taklit ediliyordu. Şeritler `right: 0` ile
// ÜST ÜSTE bindiği için alfalar çarpışıyordu: en sağdaki 3dp'de birikmiş
// koyuluk 1−(0.55×0.68×0.78×0.87×0.94) ≈ 0.76 oluyordu. Sonuç, yumuşak bir
// gölge değil, %76 siyah, 5 basamaklı sert bir bant — panelin sağında dikey
// bir çizgi gibi görünüyordu. Yerine tek bir gerçek gradyan çiziyoruz:
// basamak yok, birikme yok, koyuluk tek sayıdan geliyor.
const SHADOW_WIDTH = 11;
const SHADOW_ALPHA_DARK = 0;
const SHADOW_ALPHA_LIGHT = 0.05;

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

  const avatar = useMyAvatar();
  const [broadcastUnread, setBroadcastUnread] = useState(0);
  // Üst bardaki zille AYNI kaynaktan (bkz. hooks/useUnreadNotifications.ts) —
  // eskiden burada ayrı bir fetch vardı, iki rozet birbirinden sapabiliyordu.
  const personalUnread = useUnreadNotifications();
  const [myPostsCount, setMyPostsCount] = useState(0);
  const [savedPostsCount, setSavedPostsCount] = useState(0);

  // Drawer içeriği artık kalıcı mount'lu (her açılışta unmount/remount olmuyor)
  // — bu yüzden bu fetch `isOpen`'a bağlı: her açılışta tazeleniyor, eski
  // (her seferinde taze mount olan) davranışla aynı garanti korunuyor.
  //
  // Eskiden burada ÜÇ ayrı istek vardı (duyurular + notlarım + kaydettiklerim)
  // ve üçünde de tam liste indirilip yalnızca `.length` okunuyordu. Artık tek
  // `GET /stats/me` bu sayıları hazır döndürüyor. X'in "Takip edilen/Takipçiler"
  // istatistik satırının karşılığı — bizde sosyal takip yok, o yüzden kendi post
  // sayılarımızı aynı kalın-sayı + gri-etiket biçiminde gösteriyoruz.
  // `unreadPersonal` alanı bilinçli olarak kullanılmıyor: kişisel rozet üst
  // bardaki zille paylaşılan useUnreadNotifications() hook'undan geliyor.
  useEffect(() => {
    if (!isOpen) return;
    statsAPI
      .getMine()
      .then((res) => {
        setBroadcastUnread(res.data?.unreadBroadcast || 0);
        setMyPostsCount(res.data?.posts || 0);
        setSavedPostsCount(res.data?.saved || 0);
      })
      .catch(() => {
        setBroadcastUnread(0);
        setMyPostsCount(0);
        setSavedPostsCount(0);
      });
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

  // Panel içeriği kalıcı mount'lu olduğu için bıraktığın kaydırma konumunu
  // hatırlıyordu; menü her açılışta en baştan başlasın diye KAPANIRKEN başa
  // alınıyor (açılırken almak görünür bir zıplama yaratırdı).
  const scrollRef = useRef<ScrollView>(null);
  useEffect(() => {
    if (!isOpen) scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [isOpen]);

  return (
    <View className="flex-1 bg-surface">
      <SafeAreaView edges={['top', 'left', 'bottom']} style={{ flex: 1 }}>
        <ScrollView showsVerticalScrollIndicator={false} ref={scrollRef} contentContainerStyle={{ padding: 12, gap: 4 }}>
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
              className="w-10 h-10 rounded-full items-center justify-center bg-inset"
            >
              <Bell size={20} color={iconColor} />
              {personalUnread > 0 && (
                <View className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-red-500 items-center justify-center border-2 border-surface">
                  <Text className="text-white text-[10px] font-bold">{personalUnread > 99 ? '99+' : personalUnread}</Text>
                </View>
              )}
            </Pressable>
            <Pressable
              onPress={() => go(() => stackNavigation.navigate('Notifications', { initialTab: 'duyurular' }))}
              hitSlop={8}
              accessibilityLabel="Duyurular"
              className="w-10 h-10 rounded-full items-center justify-center bg-inset"
            >
              <Megaphone size={20} color={iconColor} />
              {broadcastUnread > 0 && (
                <View className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-red-500 items-center justify-center border-2 border-surface">
                  <Text className="text-white text-[10px] font-bold">{broadcastUnread > 99 ? '99+' : broadcastUnread}</Text>
                </View>
              )}
            </Pressable>
          </View>

          <Pressable onPress={() => go(() => goToTab(stackNavigation, 'Profile'))} className="px-3 py-2 rounded-md active:bg-inset">
            <View className="w-[60px] h-[60px] rounded-full overflow-hidden items-center justify-center bg-accent-soft mb-2">
              {avatar ? <AvatarDisplay avatar={avatar} size={60} showBg={false} /> : <DeerIcon size={32} color={brandColor} />}
            </View>
            <Text className="text-ink text-[22px] font-extrabold">{user?.full_name || user?.username}</Text>
            {!!user?.username && <Text className="text-muted text-[15px] font-normal">@{user.username}</Text>}
          </Pressable>

          {/* X'in takipçi/takip edilen istatistik satırının karşılığı — bizde
              sosyal takip yerine kendi notların önemli, o yüzden "Notlarım" /
              "Kaydettiğim Notlarım" sayıları (bkz. ProfileScreen.tsx TABS: posts/saved),
              X'teki kalın-sayı + gri-etiket biçiminde. */}
          <View className="flex-row gap-5 px-3 pb-2">
            <Pressable
              onPress={() => go(() => goToTab(stackNavigation, 'Profile', { initialTab: 'posts' }))}
              className="flex-row items-baseline gap-1"
            >
              <Text className="text-ink text-[15px] font-extrabold">{myPostsCount}</Text>
              <Text className="text-muted text-[15px] font-semibold">Notlarım</Text>
            </Pressable>
            <Pressable
              onPress={() => go(() => goToTab(stackNavigation, 'Profile', { initialTab: 'saved' }))}
              className="flex-row items-baseline gap-1"
            >
              <Text className="text-ink text-[15px] font-extrabold">{savedPostsCount}</Text>
              <Text className="text-muted text-[15px] font-semibold">Kaydettiğim Notlarım</Text>
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
            label="Sizin Sorularınız"
            color={iconColor}
            onPress={() => go(() => stackNavigation.navigate('Faq'))}
          />
          <MenuLink icon={Lightbulb} label="Öneriler" color={iconColor} onPress={() => go(() => stackNavigation.navigate('Suggestions'))} />

          <FollowedDepartmentsSection iconColor={iconColor} isOpen={isOpen} onNavigate={go} />
          <ToolsSection iconColor={iconColor} isDrawerOpen={isOpen} onNavigate={go} />

          {/* Yardım listenin EN ALTINDA (kullanıcı isteği) — üstteki sıradan
              çıkarıldı, tema/çıkış bloğunun hemen üstüne alındı. */}
          <MenuLink icon={BadgeHelp} label="Yardım" color={iconColor} onPress={() => go(() => stackNavigation.navigate('Help'))} />

          <Divider />

          <Pressable
            onPress={() => setShowThemePicker(true)}
            className="flex-row items-center gap-4 px-3 py-3.5 rounded-md active:bg-inset"
          >
            {theme === 'dark' ? <Moon size={22} color={iconColor} /> : <Sun size={22} color={iconColor} />}
            <Text className="text-ink2 text-[17px] font-bold">Temayı Ayarla</Text>
          </Pressable>
          <Pressable onPress={handleLogout} className="flex-row items-center gap-4 px-3 py-3.5 rounded-md active:bg-danger-soft">
            <LogOut size={22} color="#dc2626" />
            <Text className="text-red-600 text-[17px] font-bold">Çıkış Yap</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>

      <ThemePickerModal visible={showThemePicker} onClose={() => setShowThemePicker(false)} />

      <Animated.View style={[StyleSheet.absoluteFill, shadowFadeStyle]} pointerEvents="none">
        <View style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: SHADOW_WIDTH }}>
          <Svg width="100%" height="100%">
            <Defs>
              <LinearGradient id="drawerEdgeShadow" x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0" stopColor="#000" stopOpacity={0} />
                <Stop offset="1" stopColor="#000" stopOpacity={theme === 'dark' ? SHADOW_ALPHA_DARK : SHADOW_ALPHA_LIGHT} />
              </LinearGradient>
            </Defs>
            <Rect x="0" y="0" width="100%" height="100%" fill="url(#drawerEdgeShadow)" />
          </Svg>
        </View>
      </Animated.View>
    </View>
  );
}
