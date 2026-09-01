import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { Award, Flame, FileText, Trophy, User } from 'lucide-react-native';
import { leaderboardAPI } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { useGoToUserProfile } from '../../hooks/useGoToUserProfile';
import AvatarDisplay from '../../components/avatar/AvatarDisplay';
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

function LeaderboardRow({ entry, metric, isMe }: { entry: LeaderboardEntry; metric: string; isMe: boolean }) {
  const goToUserProfile = useGoToUserProfile();
  const rankColor = RANK_COLORS[entry.rank];

  return (
    <Pressable
      className={`flex-row items-center gap-2.5 bg-white rounded-xl p-2.5 ${isMe ? 'bg-brand/10 border border-brand/20' : ''}`}
      onPress={() => goToUserProfile(entry.username)}
    >
      <View className="w-[30px] h-[30px] rounded-[15px] bg-gray-100 items-center justify-center" style={rankColor ? { backgroundColor: rankColor.bg } : undefined}>
        <Text className="text-[13px] font-bold text-gray-600" style={rankColor ? { color: rankColor.text } : undefined}>{entry.rank}</Text>
      </View>
      <View className="w-[34px] h-[34px] rounded-[17px] bg-brand/10 items-center justify-center overflow-hidden">
        {entry.avatar_config ? (
          <AvatarDisplay
            avatar={{ config: entry.avatar_config as any, photo_path: entry.avatar_photo_path, display_mode: entry.avatar_display_mode }}
            size={34}
          />
        ) : (
          <User size={17} color="#2F5755" />
        )}
      </View>
      <View className="flex-1 min-w-0">
        <View className="flex-row items-center gap-1.5">
          <Text className="text-[13.5px] font-semibold text-gray-900 flex-shrink" numberOfLines={1}>
            {entry.username}
          </Text>
          {isMe && <Text className="text-[11px] text-brand font-semibold">(sen)</Text>}
        </View>
        {!!entry.badges?.length && (
          <View className="flex-row gap-[3px] mt-[3px]">
            {entry.badges.map((b) => (
              <BadgeChip key={b.id} badge={b} compact />
            ))}
          </View>
        )}
      </View>
      <Text className="text-[13px] font-bold text-brand">{metric}</Text>
    </Pressable>
  );
}

export default function LeaderboardScreen() {
  const { user } = useAuth();
  const [sort, setSort] = useState<(typeof SORTS)[number]['key']>('streak');
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [me, setMe] = useState<LeaderboardEntry | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    leaderboardAPI
      .get(sort)
      .then((res) => {
        setEntries(res.data.entries || []);
        setMe(res.data.me || null);
      })
      .catch(() => Alert.alert('Hata', 'Liderlik tablosu yüklenemedi.'))
      .finally(() => setLoading(false));
  }, [sort]);

  const activeSort = SORTS.find((s) => s.key === sort)!;
  const meInTop = me && entries.some((e) => e.id === me.id);

  return (
    <ScrollView className="flex-1 bg-gray-50" contentContainerClassName="p-4 pb-10">
      <View className="flex-row items-center gap-2.5">
        <Trophy size={22} color="#2F5755" />
        <Text className="text-[22px] font-extrabold text-gray-900">Liderlik Tablosu</Text>
      </View>
      <Text className="text-[12.5px] text-gray-500 mt-1.5 mb-3.5">Not paylaşan, seri yapan ve rozet kazanan öğrenciler.</Text>

      <View className="flex-row gap-2 mb-3.5">
        {SORTS.map(({ key, label, icon: Icon }) => (
          <Pressable
            key={key}
            className={`flex-row items-center gap-1.5 rounded-[10px] px-3 py-[9px] ${sort === key ? 'bg-brand' : 'bg-white'}`}
            onPress={() => setSort(key)}
          >
            <Icon size={14} color={sort === key ? '#fff' : '#4b5563'} />
            <Text className={`text-xs font-semibold ${sort === key ? 'text-white' : 'text-gray-600'}`}>{label}</Text>
          </Pressable>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 30 }} size="large" color="#2F5755" />
      ) : entries.length === 0 ? (
        <View className="items-center py-10 bg-white rounded-[14px]">
          <Text className="text-gray-400 text-[13.5px] text-center px-6">Henüz kimse bu kategoride sıralamaya girmedi. İlk sen ol!</Text>
        </View>
      ) : (
        <View className="gap-1.5">
          {entries.map((entry) => (
            <LeaderboardRow key={entry.id} entry={entry} metric={activeSort.metric(entry)} isMe={entry.id === user?.id} />
          ))}
        </View>
      )}

      {!loading && me && !meInTop && (
        <>
          <View className="flex-row items-center gap-2.5 my-3.5">
            <View className="flex-1 h-px bg-gray-200" />
            <Text className="text-[11px] text-gray-400">senin sıran</Text>
            <View className="flex-1 h-px bg-gray-200" />
          </View>
          <LeaderboardRow entry={me} metric={activeSort.metric(me)} isMe />
        </>
      )}
    </ScrollView>
  );
}
