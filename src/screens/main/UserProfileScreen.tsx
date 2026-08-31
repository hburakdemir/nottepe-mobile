import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import { useRoute } from '@react-navigation/native';
import { Lock, ShieldOff, User as UserIcon } from 'lucide-react-native';
import { userAPI, badgeAPI } from '../../lib/api';
import PostCard from '../../components/PostCard';
import BadgeChip, { type Badge } from '../../components/BadgeChip';
import type { RootStackParamList } from '../../navigation/types';
import type { Post } from '../../types/post';

interface PublicProfile {
  id: number;
  username: string;
  full_name?: string;
  department?: string;
  faculty?: string;
  bio?: string;
  post_count?: number;
  is_public: boolean;
}

const POSTS_LIMIT = 12;

export default function UserProfileScreen() {
  const route = useRoute<any>();
  const { username } = route.params as RootStackParamList['UserProfile'];

  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [badges, setBadges] = useState<Badge[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [postsLoading, setPostsLoading] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [banned, setBanned] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setNotFound(false);
      setBanned(false);
      try {
        const profileRes = await userAPI.getProfile(username);
        if (cancelled) return;
        const p: PublicProfile = profileRes.data.profile;
        setProfile(p);
        const badgeRes = await badgeAPI.getByUser(p.id).catch(() => ({ data: { badges: [] } }));
        if (cancelled) return;
        setBadges(badgeRes.data?.badges || []);
      } catch (err: any) {
        if (cancelled) return;
        if (err.response?.status === 403) setBanned(true);
        else setNotFound(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [username]);

  useEffect(() => {
    if (!profile || profile.is_public === false) return;
    let cancelled = false;
    (async () => {
      setPostsLoading(true);
      try {
        const res = await userAPI.getPosts(username, { page: 1, limit: POSTS_LIMIT });
        if (!cancelled) setPosts(res.data.posts || []);
      } catch {
        if (!cancelled) setPosts([]);
      } finally {
        if (!cancelled) setPostsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [profile, username]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#1d4ed8" />
      </View>
    );
  }

  if (banned) {
    return (
      <View style={styles.center}>
        <ShieldOff size={48} color="#f87171" />
        <Text style={styles.centerTitle}>Profil görüntülemeniz admin tarafından yasaklanmıştır</Text>
      </View>
    );
  }

  if (notFound || !profile) {
    return (
      <View style={styles.center}>
        <UserIcon size={48} color="#d1d5db" />
        <Text style={styles.centerTitle}>Kullanıcı bulunamadı</Text>
      </View>
    );
  }

  const isPrivate = profile.is_public === false;

  const header = (
    <View>
      <View style={styles.card}>
        <View style={styles.avatarFallback}>
          <UserIcon size={32} color="#fff" />
        </View>
        <Text style={styles.username}>{profile.username}</Text>
        {!!profile.full_name && <Text style={styles.fullName}>{profile.full_name}</Text>}
        {!!profile.department && (
          <Text style={styles.dept}>
            {profile.department}
            {profile.faculty ? ` · ${profile.faculty}` : ''}
          </Text>
        )}
        {typeof profile.post_count === 'number' && (
          <Text style={styles.postCount}>{profile.post_count} onaylı not</Text>
        )}
        {!!profile.bio && <Text style={styles.bio}>{profile.bio}</Text>}
        {badges.length > 0 && (
          <View style={styles.badgeRow}>
            {badges.map((badge) => (
              <BadgeChip key={badge.id} badge={badge} />
            ))}
          </View>
        )}
      </View>

      {isPrivate ? (
        <View style={styles.privateBox}>
          <Lock size={28} color="#9ca3af" />
          <Text style={styles.privateText}>Bu profil gizli.</Text>
        </View>
      ) : (
        <Text style={styles.sectionLabel}>PAYLAŞTIĞI NOTLAR</Text>
      )}
    </View>
  );

  if (isPrivate) {
    return (
      <View style={{ flex: 1, backgroundColor: '#f9fafb' }}>
        <View style={{ padding: 16 }}>{header}</View>
      </View>
    );
  }

  return (
    <FlatList
      style={styles.list}
      contentContainerStyle={styles.listContent}
      data={posts}
      keyExtractor={(item) => String(item.id ?? item.post_id)}
      renderItem={({ item }) => <PostCard post={item} />}
      ListHeaderComponent={header}
      ListEmptyComponent={
        postsLoading ? (
          <ActivityIndicator style={{ marginVertical: 24 }} color="#1d4ed8" />
        ) : (
          <Text style={styles.emptyText}>Henüz onaylı not paylaşılmamış.</Text>
        )
      }
    />
  );
}

const styles = StyleSheet.create({
  list: { flex: 1, backgroundColor: '#f9fafb' },
  listContent: { padding: 16, flexGrow: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 32 },
  centerTitle: { fontSize: 15, fontWeight: '600', color: '#374151', textAlign: 'center' },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    marginBottom: 20,
  },
  avatarFallback: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: '#2F5755',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  username: { fontSize: 20, fontWeight: '700', color: '#111827' },
  fullName: { fontSize: 13.5, color: '#6b7280', marginTop: 2 },
  dept: { fontSize: 12.5, color: '#9ca3af', marginTop: 4, textAlign: 'center' },
  postCount: { fontSize: 12.5, color: '#6b7280', marginTop: 6 },
  bio: { fontSize: 13, color: '#4b5563', marginTop: 10, textAlign: 'center', lineHeight: 19 },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14, justifyContent: 'center' },
  privateBox: { alignItems: 'center', gap: 10, paddingVertical: 40 },
  privateText: { fontSize: 14, color: '#6b7280' },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: '#9ca3af', letterSpacing: 0.5, marginBottom: 10 },
  emptyText: { textAlign: 'center', color: '#9ca3af', marginTop: 16 },
});
