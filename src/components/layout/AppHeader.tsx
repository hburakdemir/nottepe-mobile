import React, { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, { interpolate, useAnimatedStyle } from 'react-native-reanimated';
import { DrawerActions, useFocusEffect, useNavigation } from '@react-navigation/native';
import { useDrawerProgress, useDrawerStatus } from '@react-navigation/drawer';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Bell } from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';
import { avatarAPI } from '../../lib/api';
import type { AvatarData } from '../../components/avatar/AvatarDisplay';
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

// Web'in Navbar'ından bilinçli bir sapma (kullanıcı isteği): solda logo yerine
// menü avatarı, ortada "Nottepe" yazısı, sağda hamburger yerine bildirim zili
// — avatar artık menünün açıldığı tarafta (soldan iten Drawer, bkz.
// RootNavigator.tsx). Avatara dokununca çekmece açılıyor (en üstünde
// "Profili Görüntüle" var).
export default function AppHeader() {
  const { theme } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [avatar, setAvatar] = useState<AvatarData | null>(null);
  const drawerProgress = useDrawerProgress();
  // Menü açıkken bu avatar, itilen sayfanın en sol kenarında (görünen dar
  // şeritte) tuhafça görünür kalıyordu — X'te menü açılınca tetikleyici
  // ortadan kayboluyor. Drawer'ın ilerlemesiyle birlikte soluyor.
  const isDrawerOpen = useDrawerStatus() === 'open';
  const avatarFadeStyle = useAnimatedStyle(() => ({
    opacity: interpolate(drawerProgress.value, [0, 1], [1, 0]),
  }));

  useFocusEffect(
    useCallback(() => {
      avatarAPI
        .get()
        .then((res) => setAvatar(res.data?.avatar || null))
        .catch(() => setAvatar(null));
    }, [])
  );

  const inkColor = theme === 'dark' ? '#DFD0B8' : '#374151';
  const brandColor = theme === 'dark' ? '#5A9690' : '#2F5755';

  return (
    <View className="bg-primary dark:bg-darkbgbutton border-b border-gray-200 dark:border-gray-700/60" style={SHADOW_SM}>
      <View className="h-16 flex-row items-center px-4">
        <Animated.View style={avatarFadeStyle} pointerEvents={isDrawerOpen ? 'none' : 'auto'}>
          <Pressable
            onPress={() => navigation.dispatch(DrawerActions.openDrawer())}
            hitSlop={8}
            accessibilityLabel="Menü"
            className="w-9 h-9 rounded-full overflow-hidden items-center justify-center bg-brand/10 dark:bg-brand-light/15"
          >
            {avatar ? <AvatarDisplay avatar={avatar} size={34} showBg={false} /> : <DeerIcon size={20} color={brandColor} />}
          </Pressable>
        </Animated.View>

        <View className="flex-1 items-center">
          <Text className="text-secondary dark:text-darktext text-lg font-extrabold tracking-tight">Nottepe</Text>
        </View>

        <Pressable
          onPress={() => navigation.navigate('Notifications', { initialTab: 'aktivite' })}
          hitSlop={8}
          className="p-2 rounded-full"
          accessibilityLabel="Bildirimler"
        >
          <Bell size={22} color={inkColor} />
        </Pressable>
      </View>
    </View>
  );
}
