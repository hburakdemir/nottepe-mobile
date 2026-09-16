import React, { useCallback } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useQueryClient } from '@tanstack/react-query';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Bell, BellOff } from 'lucide-react-native';
import { departmentFollowAPI } from '../../lib/api';
import { useTheme } from '../../context/ThemeContext';
import { FOLLOWED_DEPARTMENTS_KEY } from '../layout/MenuDrawerContent';
import { goToTab } from '../../navigation/navigateApp';
import type { RootStackParamList } from '../../navigation/types';
import { MY_FOLLOWS_KEY, useMyFollows, type Follow } from '../../hooks/profile/useProfileLists';
import { useDelayedLoading } from '../../hooks/useDelayedLoading';
import PagerPage, { type ProfileTabProps } from './PagerPage';
import { EmptyState, SHADOW_SM, TabLoading } from './profileCommon';

const FollowRow = React.memo(function FollowRow({
  follow,
  onOpen,
  onUnfollow,
  iconColor,
}: {
  follow: Follow;
  onOpen: (f: Follow) => void;
  onUnfollow: (f: Follow) => void;
  iconColor: string;
}) {
  return (
    <View className="flex-row items-center bg-surface rounded-lg p-3.5 mb-3" style={SHADOW_SM}>
      <Pressable className="flex-1" onPress={() => onOpen(follow)}>
        <Text className="text-sm font-bold text-ink" numberOfLines={1}>
          {follow.department}
        </Text>
        <Text className="text-[11.5px] text-muted2 mt-0.5">{follow.faculty}</Text>
      </Pressable>
      <Pressable
        className="flex-row items-center gap-[5px] border border-line rounded-lg px-2.5 py-[7px]"
        onPress={() => onUnfollow(follow)}
      >
        <BellOff size={13} color={iconColor} />
        <Text className="text-[11.5px] text-muted font-semibold">Bırak</Text>
      </Pressable>
    </View>
  );
});

// Profil > Takip sekmesi.
function FollowsTab({ active, width, headerHeight, scrollY, onRememberOffset }: ProfileTabProps) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const queryClient = useQueryClient();
  const { theme } = useTheme();
  const { data: follows, isPending } = useMyFollows();
  // bkz. ChecklistsTab.tsx — aynı gecikmeli yükleme kuralı.
  const showLoading = useDelayedLoading(isPending);

  // lucide ikonları ham renk alıyor (className değil) — token karşılığı
  // `useThemeColors()` üzerinden gelebilir ama bu iki değer ekranın geri
  // kalanıyla birebir aynı kalsın diye eski hâliyle korunuyor.
  const iconColor = theme === 'dark' ? '#9ca3af' : '#6b7280';

  const handleOpen = useCallback(
    (f: Follow) => navigation.navigate('DepartmentDetail', { faculty: f.faculty, department: f.department }),
    [navigation]
  );

  const handleUnfollow = useCallback(
    async (f: Follow) => {
      // İyimser: satır anında gidiyor.
      queryClient.setQueryData<Follow[]>(MY_FOLLOWS_KEY, (prev) =>
        prev?.filter((x) => !(x.faculty === f.faculty && x.department === f.department))
      );
      try {
        await departmentFollowAPI.unfollow(f.faculty, f.department);
        // Menüdeki liste 5 dk cache'li (bkz. MenuDrawerContent) — tazelensin.
        queryClient.invalidateQueries({ queryKey: FOLLOWED_DEPARTMENTS_KEY });
      } catch {
        // Sunucu reddettiyse listeyi sunucudan yeniden çek.
        queryClient.invalidateQueries({ queryKey: MY_FOLLOWS_KEY });
        Alert.alert('Hata', 'İşlem başarısız.');
      }
    },
    [queryClient]
  );

  const goToDepartments = useCallback(() => goToTab(navigation, 'Departments'), [navigation]);

  return (
    <PagerPage
      tabKey="follows"
      width={width}
      headerHeight={headerHeight}
      scrollY={scrollY}
      onRememberOffset={onRememberOffset}
    >
      {active &&
        (showLoading ? (
          <TabLoading />
        ) : isPending ? null : !follows || follows.length === 0 ? (
          <EmptyState
            icon={Bell}
            text='Henüz bölüm takip etmiyorsun. Bölüm sayfasındaki "Takip Et" butonuyla haberdar olabilirsin.'
            actionLabel="Bölümlere Göz At"
            onAction={goToDepartments}
          />
        ) : (
          follows.map((f) => (
            <FollowRow
              key={`${f.faculty}-${f.department}`}
              follow={f}
              onOpen={handleOpen}
              onUnfollow={handleUnfollow}
              iconColor={iconColor}
            />
          ))
        ))}
    </PagerPage>
  );
}

export default React.memo(FollowsTab);
