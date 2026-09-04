import React from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, { interpolate, useAnimatedStyle } from 'react-native-reanimated';
import { DrawerActions, useNavigation } from '@react-navigation/native';
import { useDrawerProgress, useDrawerStatus } from '@react-navigation/drawer';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Bell, Plus } from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';
import { useActiveRoute } from '../../navigation/useActiveRouteName';
import { routeTitle } from '../../navigation/routeTitles';
import { useMyAvatar } from '../../hooks/useMyAvatar';
import { useUnreadNotifications } from '../../hooks/useUnreadNotifications';
import AvatarDisplay from '../../components/avatar/AvatarDisplay';
import DeerIcon from '../icons/DeerIcon';
import type { RootStackParamList } from '../../navigation/types';

// Web'in Navbar.jsx'i `shadow-sm border-b border-gray-200` kullanıyor (satır
// ~202) — NativeWind'in `shadow-sm` class'ı yerine (Android'de elevation'ı
// güvenilir çevirmiyor, bkz. projedeki diğer SHADOW_MD sabitleri) Tailwind'in
// shadow-sm değerlerinin (0 1px 2px rgba(0,0,0,.05)) birebir RN karşılığı.
const SHADOW_SM = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 1 },
  shadowOpacity: 0.05,
  shadowRadius: 2,
  elevation: 1,
};

// Web'in Navbar'ından bilinçli bir sapma (kullanıcı isteği): solda menü
// avatarı, ortada BULUNULAN SAYFANIN ADI, sağda bildirim zili + yeni not
// ekleme butonu. Bar tek satır ve her ekranda aynı yükseklikte (push edilen
// ekranların native başlıkları kapalı, bkz. RootNavigator.tsx) — başlık o
// yüzden ikinci bir satır açmadan bu barın İÇİNE, mutlak konumlu ortalanmış
// bir katman olarak konuyor (soldaki avatar ve sağdaki iki buton farklı
// genişlikte olduğu için `flex-1` ile ortalamak başlığı hep hafif kaydırırdı).
export default function AppHeader({ title: titleOverride }: { title?: string } = {}) {
  const { theme } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const avatar = useMyAvatar();
  const unreadCount = useUnreadNotifications();
  const drawerProgress = useDrawerProgress();
  // Menü açıkken bu avatar, itilen sayfanın en sol kenarında (görünen dar
  // şeritte) tuhafça görünür kalıyordu — X'te menü açılınca tetikleyici
  // ortadan kayboluyor. Drawer'ın ilerlemesiyle birlikte soluyor.
  const isDrawerOpen = useDrawerStatus() === 'open';
  const avatarFadeStyle = useAnimatedStyle(() => ({
    opacity: interpolate(drawerProgress.value, [0, 1], [1, 0]),
  }));

  const inkColor = theme === 'dark' ? '#DFD0B8' : '#374151';
  const brandColor = theme === 'dark' ? '#5A9690' : '#2F5755';
  const activeRoute = useActiveRoute();
  // Bir başkasının profilinde sabit "Profil" yerine kullanıcı adı yazıyor
  // (kullanıcı isteği) — başlık route adından değil parametresinden geliyor.
  //
  // `titleOverride`: sekmelerin başlığı BURADAN türetilemiyor. AppHeader,
  // Tab.Navigator'ın DIŞINDA (MainTabsScreen'de) duruyor; oradaki
  // `useNavigationState` stack'in durumunu veriyor ve odaklı route hep
  // "MainTabs" çıkıyor — iç içe sekme durumu üst navigator'ın state'ine
  // güvenilir biçimde yansımıyor. Bu yüzden sekme adını MainTabsScreen kendi
  // `screenListeners`'ıyla izleyip başlığı hazır veriyor.
  const derivedTitle =
    activeRoute?.name === 'UserProfile' && typeof activeRoute.params?.username === 'string'
      ? (activeRoute.params.username as string)
      : routeTitle(activeRoute?.name);
  const title = titleOverride ?? derivedTitle;

  return (
    <View className="bg-surface border-b border-line-soft" style={SHADOW_SM}>
      <View className="h-16 flex-row items-center px-4">
        {!!title && (
          <View pointerEvents="none" className="absolute inset-0 items-center justify-center px-20">
            <Text className="text-ink text-[16px] font-bold" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
              {title}
            </Text>
          </View>
        )}

        <Animated.View style={avatarFadeStyle} pointerEvents={isDrawerOpen ? 'none' : 'auto'}>
          <Pressable
            onPress={() => navigation.dispatch(DrawerActions.openDrawer())}
            hitSlop={8}
            accessibilityLabel="Menü"
            className="w-9 h-9 rounded-full overflow-hidden items-center justify-center bg-accent-soft"
          >
            {avatar ? <AvatarDisplay avatar={avatar} size={34} showBg={false} /> : <DeerIcon size={20} color={brandColor} />}
          </Pressable>
        </Animated.View>

        <View className="flex-1" />

        <View className="flex-row items-center gap-1">
          <Pressable
            onPress={() => navigation.navigate('Notifications', { initialTab: 'aktivite' })}
            hitSlop={8}
            className="p-2 rounded-full"
            accessibilityLabel="Bildirimler"
          >
            <Bell size={22} color={inkColor} />
            {/* Okunmamış bildirim sayısı zilin ÜSTÜNDE (kullanıcı isteği).
                Sayı menüdeki zille aynı react-query anahtarından geliyor, yani
                Bildirimler ekranı okundu yaptığında ikisi birlikte sıfırlanıyor
                (bkz. hooks/useUnreadNotifications.ts). */}
            {unreadCount > 0 && (
              <View className="absolute top-0.5 right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-red-500 items-center justify-center border-2 border-surface">
                <Text className="text-white text-[10px] font-bold">{unreadCount > 99 ? '99+' : unreadCount}</Text>
              </View>
            )}
          </Pressable>

          {/* Ekleme artık tab bar'da değil (orası Yemek Listesi + profil avatarına
              ayrıldı, bkz. WaveTabBar.tsx) — zilin sağında. */}
          <Pressable onPress={() => navigation.navigate('AddPost')} hitSlop={8} className="p-2 rounded-full" accessibilityLabel="Not ekle">
            <Plus size={24} color={inkColor} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}
