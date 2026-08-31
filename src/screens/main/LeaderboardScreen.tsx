import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
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
    <Pressable style={[styles.row, isMe && styles.rowMe]} onPress={() => goToUserProfile(entry.username)}>
      <View style={[styles.rankBadge, rankColor && { backgroundColor: rankColor.bg }]}>
        <Text style={[styles.rankText, rankColor && { color: rankColor.text }]}>{entry.rank}</Text>
      </View>
      <View style={styles.avatarWrap}>
        {entry.avatar_config ? (
          <AvatarDisplay
            avatar={{ config: entry.avatar_config as any, photo_path: entry.avatar_photo_path, display_mode: entry.avatar_display_mode }}
            size={34}
          />
        ) : (
          <User size={17} color="#2F5755" />
        )}
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={styles.username} numberOfLines={1}>
            {entry.username}
          </Text>
          {isMe && <Text style={styles.meText}>(sen)</Text>}
        </View>
        {!!entry.badges?.length && (
          <View style={{ flexDirection: 'row', gap: 3, marginTop: 3 }}>
            {entry.badges.map((b) => (
              <BadgeChip key={b.id} badge={b} compact />
            ))}
          </View>
        )}
      </View>
      <Text style={styles.metric}>{metric}</Text>
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
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.titleRow}>
        <Trophy size={22} color="#2F5755" />
        <Text style={styles.title}>Liderlik Tablosu</Text>
      </View>
      <Text style={styles.subtitle}>Not paylaşan, seri yapan ve rozet kazanan öğrenciler.</Text>

      <View style={styles.sortRow}>
        {SORTS.map(({ key, label, icon: Icon }) => (
          <Pressable key={key} style={[styles.sortBtn, sort === key && styles.sortBtnActive]} onPress={() => setSort(key)}>
            <Icon size={14} color={sort === key ? '#fff' : '#4b5563'} />
            <Text style={[styles.sortBtnText, sort === key && styles.sortBtnTextActive]}>{label}</Text>
          </Pressable>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 30 }} size="large" color="#2F5755" />
      ) : entries.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyText}>Henüz kimse bu kategoride sıralamaya girmedi. İlk sen ol!</Text>
        </View>
      ) : (
        <View style={{ gap: 6 }}>
          {entries.map((entry) => (
            <LeaderboardRow key={entry.id} entry={entry} metric={activeSort.metric(entry)} isMe={entry.id === user?.id} />
          ))}
        </View>
      )}

      {!loading && me && !meInTop && (
        <>
          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>senin sıran</Text>
            <View style={styles.dividerLine} />
          </View>
          <LeaderboardRow entry={me} metric={activeSort.metric(me)} isMe />
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  content: { padding: 16, paddingBottom: 40 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { fontSize: 22, fontWeight: '800', color: '#111827' },
  subtitle: { fontSize: 12.5, color: '#6b7280', marginTop: 6, marginBottom: 14 },
  sortRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  sortBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9 },
  sortBtnActive: { backgroundColor: '#2F5755' },
  sortBtnText: { fontSize: 12, fontWeight: '600', color: '#4b5563' },
  sortBtnTextActive: { color: '#fff' },
  emptyBox: { alignItems: 'center', paddingVertical: 40, backgroundColor: '#fff', borderRadius: 14 },
  emptyText: { color: '#9ca3af', fontSize: 13.5, textAlign: 'center', paddingHorizontal: 24 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fff', borderRadius: 12, padding: 10 },
  rowMe: { backgroundColor: '#2F575519', borderWidth: 1, borderColor: '#2F575533' },
  rankBadge: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#f3f4f6', alignItems: 'center', justifyContent: 'center' },
  rankText: { fontSize: 13, fontWeight: '700', color: '#4b5563' },
  avatarWrap: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#2F575519', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  username: { fontSize: 13.5, fontWeight: '600', color: '#111827', flexShrink: 1 },
  meText: { fontSize: 11, color: '#2F5755', fontWeight: '600' },
  metric: { fontSize: 13, fontWeight: '700', color: '#2F5755' },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 14 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#e5e7eb' },
  dividerText: { fontSize: 11, color: '#9ca3af' },
});
