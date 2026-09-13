import React, { useEffect } from 'react';
import { Keyboard, Platform, Pressable, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useNavigationState } from '@react-navigation/native';
import { Home, Library, UtensilsCrossed, Wrench, type LucideIcon } from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';
import { useMyAvatar } from '../../hooks/useMyAvatar';
import AvatarDisplay, { type AvatarData } from '../avatar/AvatarDisplay';
import DeerIcon from '../icons/DeerIcon';
import { TAB_ROUTE_NAMES, navigateApp } from '../../navigation/navigateApp';
import { useMetrics } from '../../theme/metrics';

// Onaylanan "E · Instagram tarzı buzlu cam" mockup'ının RN karşılığı — kenarlardan
// boşluklu, yüzen tam bir buzlu-cam hap (bar'ın kendi blur+arka planı+border+
// gölgesi var), etiketsiz; aktif sekme daha kalın çizgi + teal renk + arkasındaki
// yumuşak teal kapsülle belli oluyor. Bildirimler ve Profil artık burada değil
// (AppHeader'daki zil/avatar) — "Ekle" en sağda.
//
// Web'de Navbar/MobileTabBar her rotada (detay sayfaları dahil) sabit kalıyor —
// burada da öyle. Bar iki yerde çiziliyor:
//  1. MainTabsScreen'de Tab.Navigator'ın `tabBar`'ı olarak — sahnelerin
//     KARDEŞİ olduğu için sekme geçiş animasyonu boyunca ekranda sabit kalır.
//  2. AppShell'de, push edilen ekranların (gönderi/profil/araç sayfaları)
//     altında.
// Aktif sekme her iki durumda da en yakın navigator'ın odaklı route adından
// çıkarılıyor (5 route'tan biri değilse hiçbiri aktif görünmez).
//
// "Ekle" buradan çıkıp AppHeader'daki + butonuna taşındı; yerine en sık gidilen
// iki hedef geldi: Yemek Listesi ve (en sağda, ikon yerine kullanıcının kendi
// avatarıyla) Profil.
const TAB_ROUTES = TAB_ROUTE_NAMES;

const PROFILE_ROUTE = 'Profile';

// TEK BİR SEKME YUVASI — AYRI VE MEMOİZE.
//
// Eskiden beş yuva da `WaveTabBar`ın gövdesinde satır içi `map` ile
// çiziliyordu. Bunun bedeli şuydu: bir sekmeye dokunulduğunda `activeRouteName`
// değişiyor, WaveTabBar baştan render oluyor ve BEŞ yuva birden yeniden
// kuruluyordu — profil yuvasındaki avatar dahil. O avatar piksel-sanat bir SVG
// (~40 `SvgRect`, bkz. AvatarSVG.tsx), yani her dokunuşta ~40 native SVG
// düğümü sökülüp yeniden kuruluyordu. Testçilerin "sayfa geçişlerinde tabbar
// donuyor" dediği şey buydu.
//
// Artık her yuva kendi prop'larına bakıyor: bir geçişte yalnızca İKİ yuvanın
// `isFocused`'ı değişiyor (eskisi false olur, yenisi true), kalan üçü prop
// olarak aynı kaldığı için hiç çizilmiyor. Avatar da ayrıca memoize
// (AvatarDisplay + AvatarSVG), dolayısıyla profil yuvası odak değiştirse bile
// SVG yeniden kurulmuyor — yalnızca çevresindeki halkanın kalınlığı değişiyor.
//
// ⚠️ `onPress` çağrı yerinde bağımlılıksız `useCallback` olmak ZORUNDA;
// referansı her render'da değişirse memo hiçbir işe yaramaz.
interface TabSlotProps {
  routeName: (typeof TAB_ROUTES)[number];
  isFocused: boolean;
  onPress: (routeName: string) => void;
  barHeight: number;
  iconSize: number;
  avatarSize: number;
  activeColor: string;
  inactiveColor: string;
  avatar: AvatarData | null;
}

const TabSlot = React.memo(function TabSlot({
  routeName,
  isFocused,
  onPress,
  barHeight,
  iconSize,
  avatarSize,
  activeColor,
  inactiveColor,
  avatar,
}: TabSlotProps) {
  const Icon = ICONS[routeName];

  const handlePress = React.useCallback(() => {
    if (isFocused) return;
    onPress(routeName);
  }, [isFocused, onPress, routeName]);

  return (
    <Pressable
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={routeName}
      accessibilityState={isFocused ? { selected: true } : {}}
      className="flex-1 items-center justify-center"
      style={{ height: barHeight }}
    >
      {routeName === PROFILE_ROUTE ? (
        // Son slotta ikon yerine kullanıcının kendi avatarı; aktifken diğer
        // sekmelerin kalın çizgisinin karşılığı ince marka halkası.
        <View
          style={{
            width: avatarSize + 4,
            height: avatarSize + 4,
            borderRadius: (avatarSize + 4) / 2,
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            borderWidth: isFocused ? 1.5 : 0,
            borderColor: activeColor,
          }}
        >
          {avatar ? (
            <AvatarDisplay avatar={avatar} size={avatarSize} showBg={false} />
          ) : (
            <DeerIcon size={avatarSize - 6} color={isFocused ? activeColor : inactiveColor} />
          )}
        </View>
      ) : (
        <Icon size={iconSize} color={isFocused ? activeColor : inactiveColor} strokeWidth={isFocused ? 2.3 : 1.8} />
      )}
    </Pressable>
  );
});

const ICONS: Record<string, LucideIcon> = {
  Home,
  Departments: Library,
  Tools: Wrench,
  CafeteriaMenu: UtensilsCrossed,
};

// Tabletde bar telefon ölçeğinde kalırsa parmak izine göre küçük görünüyordu
// (kullanıcı isteği: "her yer responsive olmalı") — bu yüzden yükseklik/ikon/
// avatar boyutları aşağıda `scale()` ile tabletde ~%15 büyütülüyor; sadece
// kenar boşluğu (`H_MARGIN`) sabit kalıyor, zaten tablette `ContentContainer`
// bar'ı da ortalanmış içerik genişliğine sığdırıyor.
const BASE_BAR_HEIGHT = 50;
const BASE_BAR_RADIUS = 25;
const BASE_CAPSULE_SIZE = 38;
const BASE_CAPSULE_RADIUS = 13;
// 4 yerine 5 sütun var — kenar boşluğu daraltılmasa ikonlar birbirine girerdi.
const H_MARGIN = 20;
const BOTTOM_MARGIN = 10;
const BASE_AVATAR_SIZE = 26;
const BASE_ICON_SIZE = 23;

const COLORS = {
  light: {
    barBg: 'rgba(255,255,255,0.92)',
    barBorder: 'rgba(255,255,255,0.8)',
    capsule: 'rgba(47,87,85,0.16)',
    active: '#2F5755',
    inactive: '#6b7280',
    blurTint: 'light' as const,
  },
  dark: {
    barBg: 'rgba(34,40,49,0.92)',
    barBorder: 'rgba(255,255,255,0.14)',
    capsule: 'rgba(90,150,144,0.3)',
    active: '#5A9690',
    inactive: '#a9b2ba',
    blurTint: 'dark' as const,
  },
};

export default function WaveTabBar({ activeRouteName }: { activeRouteName?: string } = {}) {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const c = COLORS[theme];
  const navigation = useNavigation();
  // Aktif sekmenin adı iki montaj yerinde iki ayrı kaynaktan geliyor:
  //
  //  • AppShell (push edilmiş ekranlar) — prop YOK. En yakın navigator'ın
  //    odaklı route'u okunuyor; orada bu kök stack'in tepesindeki ekran demek,
  //    5 sekmeden biri olmadığı için hiçbiri aktif görünmüyor. Doğrusu da bu.
  //
  //  • MainTabsScreen — prop VAR. Bar artık Tab.Navigator'ın `tabBar` yuvasında
  //    DEĞİL, onun KARDEŞİ olarak çiziliyor (gerekçe o dosyada yazılı), yani
  //    `useNavigationState` oradan kök stack'i görür ve hep "MainTabs" derdi —
  //    aktif sekme hiç belli olmazdı. Odaklı sekmenin adı bu yüzden prop'la
  //    geliyor; MainTabsScreen zaten üst bar başlığı için o state'i tutuyor.
  const nearestRouteName = useNavigationState((state) => state.routes[state.index]?.name);
  const currentRouteName = activeRouteName ?? nearestRouteName;
  const activeIndex = TAB_ROUTES.indexOf(currentRouteName as (typeof TAB_ROUTES)[number]);
  const avatar = useMyAvatar();
  const { scale } = useMetrics();
  const BAR_HEIGHT = scale(BASE_BAR_HEIGHT);
  const BAR_RADIUS = scale(BASE_BAR_RADIUS);
  const CAPSULE_SIZE = scale(BASE_CAPSULE_SIZE);
  const CAPSULE_RADIUS = scale(BASE_CAPSULE_RADIUS);
  const AVATAR_SIZE = scale(BASE_AVATAR_SIZE);
  const ICON_SIZE = scale(BASE_ICON_SIZE);

  const [barWidth, setBarWidth] = React.useState(0);
  const colWidth = barWidth / TAB_ROUTES.length;
  const capsuleX = useSharedValue(0);
  const capsuleOpacity = useSharedValue(0);

  useEffect(() => {
    if (barWidth === 0) return;
    capsuleOpacity.value = withTiming(activeIndex === -1 ? 0 : 1, { duration: 150 });
    if (activeIndex !== -1) {
      capsuleX.value = withSpring((activeIndex + 0.5) * colWidth - CAPSULE_SIZE / 2, {
        damping: 17,
        stiffness: 180,
        mass: 0.8,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex, barWidth]);

  const capsuleStyle = useAnimatedStyle(() => ({
    opacity: capsuleOpacity.value,
    transform: [{ translateX: capsuleX.value }],
  }));

  // Yalnızca `navigation`'a bağlı — referansı sabit kalsın ki `TabSlot`'un
  // memo'su tutsun. Sekmeler Tab.Navigator'ın ekranları olduğu için
  // `navigateApp` `MainTabs`e iç içe navigate ediyor; sekme mount'lu kaldığından
  // veri yeniden çekilmiyor. Push edilmiş bir ekrandayken (ör. gönderi detayı)
  // aynı çağrı stack'i MainTabs'e geri sarıyor.
  const handlePress = React.useCallback(
    (routeName: string) => {
      navigateApp(navigation, routeName);
    },
    [navigation]
  );

  // Klavye açıkken bar gizleniyor. Sekme sahneleri KeyboardAvoider'ın içinde
  // (bkz. MainTabsScreen.tsx) — bar da onunla birlikte yukarı itilseydi
  // klavyenin hemen üstünde yüzen tuhaf bir hap olarak kalırdı.
  const [keyboardOpen, setKeyboardOpen] = React.useState(false);
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setKeyboardOpen(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardOpen(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  if (keyboardOpen) return null;

  return (
    // Bar'ın kendisi mutlak konumlu: hem Tab.Navigator'ın `tabBar` yuvasında
    // (orada normal akışta olsa sahneleri yukarı iterdi) hem de AppShell'de
    // içeriğin ÜZERİNDE yüzsün diye — tek tanım, iki montaj yeri.
    <View
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        paddingBottom: Math.max(insets.bottom, BOTTOM_MARGIN),
        paddingHorizontal: H_MARGIN,
      }}
      pointerEvents="box-none"
    >
      {/* Bar'ın kendisi yüzen bir buzlu-cam hap: gerçek arka plan bulanıklığı
          (BlurView) + yarı saydam dolgu + ince border + gölge. İçinde, aktif
          sekmenin arkasında ayrı, daha yumuşak bir teal kapsül kayarak geziyor. */}
      <BlurView
        intensity={Platform.OS === 'ios' ? 45 : 65}
        tint={c.blurTint}
        style={{
          height: BAR_HEIGHT,
          borderRadius: BAR_RADIUS,
          overflow: 'hidden',
          borderWidth: 1,
          borderColor: c.barBorder,
          backgroundColor: c.barBg,
          shadowColor: '#000',
          shadowOpacity: 0.25,
          shadowRadius: 18,
          shadowOffset: { width: 0, height: 10 },
          elevation: 12,
        }}
      >
        <View style={{ flex: 1, paddingHorizontal: 8 }} onLayout={(e) => setBarWidth(e.nativeEvent.layout.width - 16)}>
          {barWidth > 0 && (
            <Animated.View
              pointerEvents="none"
              style={[
                {
                  position: 'absolute',
                  top: (BAR_HEIGHT - CAPSULE_SIZE) / 2,
                  left: 8,
                  width: CAPSULE_SIZE,
                  height: CAPSULE_SIZE,
                  borderRadius: CAPSULE_RADIUS,
                  backgroundColor: c.capsule,
                },
                capsuleStyle,
              ]}
            />
          )}

          <View className="flex-1 flex-row items-center">
            {TAB_ROUTES.map((routeName, index) => (
              <TabSlot
                key={routeName}
                routeName={routeName}
                isFocused={index === activeIndex}
                onPress={handlePress}
                barHeight={BAR_HEIGHT}
                iconSize={ICON_SIZE}
                avatarSize={AVATAR_SIZE}
                activeColor={c.active}
                inactiveColor={c.inactive}
                avatar={avatar}
              />
            ))}
          </View>
        </View>
      </BlurView>
    </View>
  );
}
