import React, { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Award, Flame, FileText, User } from 'lucide-react-native';
import { leaderboardAPI } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useGoToUserProfile } from '../../hooks/useGoToUserProfile';
import AvatarDisplay from '../../components/avatar/AvatarDisplay';
import { Skeleton, SkeletonGroup } from '../../components/Skeleton';
import { useDelayedLoading } from '../../hooks/useDelayedLoading';
import BadgeChip, { type Badge } from '../../components/BadgeChip';

interface LeaderboardEntry {
  id: number;
  username: string;
  rank: number;
  current_streak?: number;
  approved_posts?: number;
  badge_count?: number;
  badges?: Badge[];
  avatar_config?: unknown;
  avatar_photo_path?: string | null;
  avatar_display_mode?: 'avatar' | 'photo' | 'both';
}

const SORTS = [
  { key: 'streak', label: 'Seri', icon: Flame, metric: (e: LeaderboardEntry) => `${e.current_streak} gün` },
  { key: 'posts', label: 'Onaylı Not', icon: FileText, metric: (e: LeaderboardEntry) => `${e.approved_posts} not` },
  { key: 'badges', label: 'Rozet', icon: Award, metric: (e: LeaderboardEntry) => `${e.badge_count} rozet` },
] as const;

const RANK_COLORS: Record<number, { bg: string; text: string }> = {
  1: { bg: '#fbbf24', text: '#78350f' },
  2: { bg: '#d1d5db', text: '#1f2937' },
  3: { bg: '#b45309', text: '#fff7ed' },
};

const LeaderboardRow = React.memo(function LeaderboardRow({ entry, metric, isMe }: { entry: LeaderboardEntry; metric: string; isMe: boolean }) {
  const goToUserProfile = useGoToUserProfile();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const rankColor = RANK_COLORS[entry.rank];

  return (
    <Pressable
      className={`flex-row items-center gap-2.5 bg-surface rounded-xl p-2.5 ${isMe ? 'bg-accent-soft border border-accent-line' : ''}`}
      onPress={() => goToUserProfile(entry.username)}
    >
      <View
        className="w-[30px] h-[30px] rounded-[15px] bg-inset items-center justify-center"
        style={rankColor ? { backgroundColor: rankColor.bg } : undefined}
      >
        <Text className="text-[13px] font-bold text-muted" style={rankColor ? { color: rankColor.text } : undefined}>
          {entry.rank}
        </Text>
      </View>
      <View className="w-[34px] h-[34px] rounded-[17px] bg-accent-soft items-center justify-center overflow-hidden">
        {entry.avatar_config ? (
          <AvatarDisplay
            avatar={{ config: entry.avatar_config as any, photo_path: entry.avatar_photo_path, display_mode: entry.avatar_display_mode }}
            size={34}
          />
        ) : (
          <User size={17} color={isDark ? '#5A9690' : '#2F5755'} />
        )}
      </View>
      <View className="flex-1 min-w-0">
        <View className="flex-row items-center gap-1.5">
          <Text className="text-[13.5px] font-semibold text-ink flex-shrink" numberOfLines={1}>
            {entry.username}
          </Text>
          {isMe && <Text className="text-[11px] text-accent font-semibold">(sen)</Text>}
        </View>
        {!!entry.badges?.length && (
          <View className="flex-row gap-[3px] mt-[3px]">
            {entry.badges.map((b) => (
              <BadgeChip key={b.id} badge={b} compact />
            ))}
          </View>
        )}
      </View>
      <Text className="text-[13px] font-bold text-accent">{metric}</Text>
    </Pressable>
  );
});

const LEADERBOARD_STALE_MS = 2 * 60 * 1000;

const EMPTY_ENTRIES: LeaderboardEntry[] = [];

export default function LeaderboardScreen() {
  const { user } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [sort, setSort] = useState<(typeof SORTS)[number]['key']>('streak');

  // Sıralama ölçütü anahtarın parçası: kullanıcı "seri"den "puan"a geçip geri
  // döndüğünde ilk liste cache'ten anında geliyor. Eskiden her geçiş yeni
  // istek atıp tabloyu boşaltıyordu.
  //
  // Liderlik tablosu saniye saniye değişen bir şey değil ama "canlı" hissi
  // önemli: 2 dakika, sekmeler arası gidip gelmeyi bedavaya getirirken
  // kullanıcının kendi hamlesinin karşılığını görmesini de geciktirmiyor.
  const { data, isLoading } = useQuery({
    queryKey: ['leaderboard', sort],
    queryFn: async () => {
      const res = await leaderboardAPI.get(sort);
      return {
        entries: (res.data.entries || []) as LeaderboardEntry[],
        me: (res.data.me || null) as LeaderboardEntry | null,
      };
    },
    staleTime: LEADERBOARD_STALE_MS,
  });

  // Yükleme hatası artık Alert değil: tablo boş kalıyor ve altındaki boş-durum
  // metni görünüyor. Arka planda tazelenen bir sorgu için uyarı kutusu açmak,
  // kullanıcı başka bir şey yaparken önünü keserdi.
  const entries = data?.entries ?? EMPTY_ENTRIES;
  const me = data?.me ?? null;
  const loading = isLoading;
  // bkz. useDelayedLoading.ts — hızlı bağlantıda iskelet hiç görünmüyor.
  const showSkeleton = useDelayedLoading(loading);

  const activeSort = SORTS.find((s) => s.key === sort)!;
  const meInTop = me && entries.some((e) => e.id === me.id);

  // SANALLAŞTIRMA — bu, ileriye dönük bir çökme koruması.
  //
  // Eskiden liste düz bir `ScrollView` içinde `entries.map()` idi: sunucu ne
  // dönerse hepsi tek karede mount ediliyordu, üstelik her satır ayrıca kendi
  // rozetlerini de map'liyor. Kapalı testte 9 kullanıcıyla sorun çıkmaz; asıl
  // tehlike üretime çıktıktan sonra kullanıcı sayısı birkaç yüze ulaştığında
  // ortaya çıkar ve o noktada ekran kilitlenir. FlatList yalnızca görünür
  // pencereyi çiziyor.
  //
  // `removeClippedSubviews` KAPALI: satırlar dokunulabilir (profile gidiyor)
  // ve bu prop'un Android'de ekrandan çıkıp giren satırlarda dokunuşu yutması
  // bilinen bir sorun — aynı gerekçe ProfileScreen'deki listelerde de yazılı.
  const renderRow = useCallback(
    ({ item }: { item: LeaderboardEntry }) => (
      <LeaderboardRow entry={item} metric={activeSort.metric(item)} isMe={item.id === user?.id} />
    ),
    [activeSort, user?.id]
  );

  const header = (
    <>
      {/* Ekran içi "Liderlik Tablosu" başlığı ve alt yazısı kaldırıldı — üst
          bar zaten sayfa adını yazıyor. */}
      <View className="flex-row gap-2 mb-3.5">
        {SORTS.map(({ key, label, icon: Icon }) => (
          <Pressable
            key={key}
            className={`flex-row items-center gap-1.5 rounded-[10px] px-3 py-[9px] ${sort === key ? 'bg-brand' : 'bg-surface'}`}
            onPress={() => setSort(key)}
          >
            <Icon size={14} color={sort === key ? '#fff' : isDark ? '#9ca3af' : '#4b5563'} />
            <Text className={`text-xs font-semibold ${sort === key ? 'text-white' : 'text-muted'}`}>{label}</Text>
          </Pressable>
        ))}
      </View>

      {/* Çark yerine satırın kendi şekli: 30px sıra rozeti, 34px avatar,
          kullanıcı adı ve sağda metrik. Hızlı bağlantıda hiç görünmüyor
          (bkz. useDelayedLoading.ts). */}
      {showSkeleton && (
        <SkeletonGroup>
          <View className="gap-2.5 mt-2.5">
            {([76, 92, 64, 84, 70, 96, 68] as const).map((w, i) => (
              <View key={i} className="flex-row items-center gap-2.5 bg-surface rounded-xl p-2.5">
                <Skeleton width={30} height={30} radius={15} />
                <Skeleton width={34} height={34} radius={17} />
                <View className="flex-1">
                  <Skeleton width={w} height={13} />
                </View>
                <Skeleton width={28} height={13} />
              </View>
            ))}
          </View>
        </SkeletonGroup>
      )}
    </>
  );

  const footer =
    !loading && me && !meInTop ? (
      <>
        <View className="flex-row items-center gap-2.5 my-3.5">
          <View className="flex-1 h-px bg-inset" />
          <Text className="text-[11px] text-muted2">senin sıran</Text>
          <View className="flex-1 h-px bg-inset" />
        </View>
        <LeaderboardRow entry={me} metric={activeSort.metric(me)} isMe />
      </>
    ) : null;

  return (
    <FlatList
      showsVerticalScrollIndicator={false}
      className="flex-1 bg-ground"
      contentContainerClassName="p-4 pb-[110px]"
      data={loading ? [] : entries}
      keyExtractor={(item) => String(item.id)}
      renderItem={renderRow}
      ItemSeparatorComponent={() => <View className="h-1.5" />}
      ListHeaderComponent={header}
      ListFooterComponent={footer}
      ListEmptyComponent={
        loading ? null : (
          <View className="items-center py-10 bg-surface rounded-[14px]">
            <Text className="text-muted2 text-[13.5px] text-center px-6">Henüz kimse bu kategoride sıralamaya girmedi. İlk sen ol!</Text>
          </View>
        )
      }
      removeClippedSubviews={false}
      initialNumToRender={12}
      maxToRenderPerBatch={10}
      windowSize={9}
    />
  );
}
