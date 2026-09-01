import React, { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Bell } from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';
import { avatarAPI } from '../../lib/api';
import type { AvatarData } from '../../components/avatar/AvatarDisplay';
import AvatarDisplay from '../../components/avatar/AvatarDisplay';
import DeerIcon from '../icons/DeerIcon';
import type { RootStackParamList } from '../../navigation/types';

// Web'in Navbar'ından bilinçli bir sapma (kullanıcı isteği): solda logo yerine
// bildirim zili, ortada "Nottepe" yazısı, sağda hamburger yerine avatar — avatara
// dokununca Menu sayfası açılıyor (en üstünde "Profili Görüntüle" var).
export default function AppHeader() {
  const { theme } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [avatar, setAvatar] = useState<AvatarData | null>(null);

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
    <View className="bg-primary dark:bg-darkbgbutton border-b border-gray-200 dark:border-gray-700/60">
      <View className="h-16 flex-row items-center px-4">
        <Pressable
          onPress={() => navigation.navigate('Notifications', { initialTab: 'aktivite' })}
          hitSlop={8}
          className="p-2 rounded-full"
          accessibilityLabel="Bildirimler"
        >
          <Bell size={22} color={inkColor} />
        </Pressable>

        <View className="flex-1 items-center">
          <Text className="text-secondary dark:text-darktext text-lg font-extrabold tracking-tight">Nottepe</Text>
        </View>

        <Pressable
          onPress={() => navigation.navigate('Menu')}
          hitSlop={8}
          accessibilityLabel="Menü"
          className="w-9 h-9 rounded-full overflow-hidden items-center justify-center bg-brand/10 dark:bg-brand-light/15"
        >
          {avatar ? <AvatarDisplay avatar={avatar} size={34} showBg={false} /> : <DeerIcon size={20} color={brandColor} />}
        </Pressable>
      </View>
    </View>
  );
}
