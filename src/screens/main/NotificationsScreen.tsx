import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  Bell,
  BookOpen,
  Calendar,
  CheckCircle,
  ExternalLink,
  Megaphone,
  MessageSquare,
  Tag,
} from 'lucide-react-native';
import { notificationAPI, userNotificationAPI } from '../../lib/api';
import type { RootStackParamList } from '../../navigation/types';

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('tr-TR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

interface Announcement {
  id: number;
  title: string;
  content: string;
  link?: string | null;
  category_name?: string;
  is_viewed?: boolean;
  created_at: string;
}

interface Category {
  id: number;
  name: string;
  slug: string;
  is_active: boolean;
}

const ACTIVITY_TYPE_META: Record<string, { icon: any; label: (n: any) => string }> = {
  comment_on_post: {
    icon: MessageSquare,
    label: (n) => `${n.actor_full_name || n.actor_username || 'Bir kullanıcı'} "${n.post_title || 'postun'}" gönderine yorum yaptı.`,
  },
  dept_new_post: {
    icon: BookOpen,
    label: (n) => `Takip ettiğin bölümde yeni not paylaşıldı: ${n.post_title || 'yeni not'}`,
  },
  request_fulfilled: {
    icon: CheckCircle,
    label: (n) => `Not isteğin karşılandı: ${n.post_title || 'karşılanan not'}`,
  },
  supported_req_fulfilled: {
    icon: CheckCircle,
    label: (n) => `"+1" verdiğin not isteği karşılandı: ${n.post_title || 'karşılanan not'}`,
  },
  comment_reply: {
    icon: MessageSquare,
    label: (n) => `${n.actor_full_name || n.actor_username || 'Bir kullanıcı'} yorumuna yanıt verdi.`,
  },
};

function AnnouncementCard({ notif }: { notif: Announcement }) {
  return (
    <View style={styles.card}>
      <View style={styles.metaRow}>
        <View style={[styles.badge, notif.is_viewed ? styles.badgeMuted : styles.badgeActive]}>
          <Text style={[styles.badgeText, notif.is_viewed && styles.badgeTextMuted]}>
            {notif.is_viewed ? 'Görüntülendi' : 'Yeni'}
          </Text>
        </View>
        {!!notif.category_name && (
          <View style={styles.categoryBadge}>
            <Tag size={11} color="#fff" />
            <Text style={styles.categoryText}>{notif.category_name}</Text>
          </View>
        )}
        <View style={styles.dateRow}>
          <Calendar size={11} color="#9ca3af" />
          <Text style={styles.dateText}>{formatDate(notif.created_at)}</Text>
        </View>
      </View>
      <Text style={styles.cardTitle}>{notif.title}</Text>
      <Text style={styles.cardContent}>{notif.content}</Text>
      {!!notif.link && (
        <Pressable style={styles.linkRow} onPress={() => Linking.openURL(notif.link!)}>
          <ExternalLink size={14} color="#1d4ed8" />
          <Text style={styles.linkText}>Daha fazla bilgi</Text>
        </Pressable>
      )}
    </View>
  );
}

function ActivityCard({ notif }: { notif: any }) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const meta = ACTIVITY_TYPE_META[notif.type];
  const Icon = meta?.icon || Bell;
  const label = meta ? meta.label(notif) : 'Yeni aktivite bildirimi';
  const canNavigate = !!notif.post_id;

  return (
    <Pressable
      style={styles.activityCard}
      disabled={!canNavigate}
      onPress={() => canNavigate && navigation.navigate('PostDetail', { postId: notif.post_id })}
    >
      <View style={styles.activityIcon}>
        <Icon size={16} color="#2F5755" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.activityLabel}>{label}</Text>
        <Text style={styles.dateText}>{formatDate(notif.created_at)}</Text>
      </View>
      {!notif.read_at && <View style={styles.dot} />}
    </Pressable>
  );
}

export default function NotificationsScreen() {
  const [tab, setTab] = useState<'duyurular' | 'aktivite'>('duyurular');

  const [categories, setCategories] = useState<Category[]>([]);
  const [activeCategory, setActiveCategory] = useState('');
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loadingAnnouncements, setLoadingAnnouncements] = useState(true);

  const [activity, setActivity] = useState<any[]>([]);
  const [activityLoading, setActivityLoading] = useState(true);
  const [activityLoaded, setActivityLoaded] = useState(false);

  useEffect(() => {
    notificationAPI
      .getCategories()
      .then((res) => setCategories((res.data || []).filter((c: Category) => c.is_active)))
      .catch(() => {});
  }, []);

  useEffect(() => {
    setLoadingAnnouncements(true);
    notificationAPI
      .getAll(activeCategory)
      .then((res) => setAnnouncements(res.data || []))
      .catch(() => setAnnouncements([]))
      .finally(() => setLoadingAnnouncements(false));
  }, [activeCategory]);

  useEffect(() => {
    if (tab !== 'aktivite' || activityLoaded) return;
    setActivityLoading(true);
    userNotificationAPI
      .getAll({ page: 1, limit: 30 })
      .then((res) => {
        setActivity(res.data.notifications || []);
        setActivityLoaded(true);
        userNotificationAPI.markAllRead().catch(() => {});
      })
      .catch(() => setActivity([]))
      .finally(() => setActivityLoading(false));
  }, [tab, activityLoaded]);

  return (
    <View style={styles.container}>
      <View style={styles.tabRow}>
        <Pressable style={[styles.tabBtn, tab === 'duyurular' && styles.tabBtnActive]} onPress={() => setTab('duyurular')}>
          <Megaphone size={15} color={tab === 'duyurular' ? '#fff' : '#2F5755'} />
          <Text style={[styles.tabBtnText, tab === 'duyurular' && styles.tabBtnTextActive]}>Duyurular</Text>
        </Pressable>
        <Pressable style={[styles.tabBtn, tab === 'aktivite' && styles.tabBtnActive]} onPress={() => setTab('aktivite')}>
          <Bell size={15} color={tab === 'aktivite' ? '#fff' : '#2F5755'} />
          <Text style={[styles.tabBtnText, tab === 'aktivite' && styles.tabBtnTextActive]}>Aktivite</Text>
        </Pressable>
      </View>

      {tab === 'duyurular' ? (
        <FlatList
          contentContainerStyle={styles.listContent}
          data={announcements}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => <AnnouncementCard notif={item} />}
          ListHeaderComponent={
            categories.length > 0 ? (
              <View style={styles.categoryFilterRow}>
                <Pressable
                  style={[styles.filterChip, activeCategory === '' && styles.filterChipActive]}
                  onPress={() => setActiveCategory('')}
                >
                  <Text style={[styles.filterChipText, activeCategory === '' && styles.filterChipTextActive]}>Tümü</Text>
                </Pressable>
                {categories.map((cat) => (
                  <Pressable
                    key={cat.id}
                    style={[styles.filterChip, activeCategory === cat.slug && styles.filterChipActive]}
                    onPress={() => setActiveCategory(cat.slug)}
                  >
                    <Text style={[styles.filterChipText, activeCategory === cat.slug && styles.filterChipTextActive]}>
                      {cat.name}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : null
          }
          ListEmptyComponent={
            loadingAnnouncements ? (
              <ActivityIndicator style={{ marginTop: 24 }} color="#1d4ed8" />
            ) : (
              <Text style={styles.emptyText}>Henüz bildirim yok.</Text>
            )
          }
        />
      ) : (
        <FlatList
          contentContainerStyle={styles.listContent}
          data={activity}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => <ActivityCard notif={item} />}
          ListEmptyComponent={
            activityLoading ? (
              <ActivityIndicator style={{ marginTop: 24 }} color="#1d4ed8" />
            ) : (
              <Text style={styles.emptyText}>Henüz aktivite bildirimi yok.</Text>
            )
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  tabRow: { flexDirection: 'row', gap: 8, padding: 12, paddingBottom: 4 },
  tabBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: '#2F5755',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  tabBtnActive: { backgroundColor: '#2F5755' },
  tabBtnText: { fontSize: 13, fontWeight: '600', color: '#2F5755' },
  tabBtnTextActive: { color: '#fff' },
  listContent: { padding: 12, flexGrow: 1, gap: 10 },
  categoryFilterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  filterChip: { backgroundColor: '#fff', borderRadius: 100, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: '#e5e7eb' },
  filterChipActive: { backgroundColor: '#2F5755', borderColor: '#2F5755' },
  filterChipText: { fontSize: 12, color: '#6b7280', fontWeight: '500' },
  filterChipTextActive: { color: '#fff' },
  emptyText: { textAlign: 'center', color: '#9ca3af', marginTop: 24 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10 },
  metaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 100 },
  badgeActive: { backgroundColor: '#2F5755' },
  badgeMuted: { backgroundColor: '#f3f4f6' },
  badgeText: { fontSize: 10.5, fontWeight: '600', color: '#fff' },
  badgeTextMuted: { color: '#6b7280' },
  categoryBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#4f7d7a', borderRadius: 100, paddingHorizontal: 8, paddingVertical: 3 },
  categoryText: { fontSize: 10.5, fontWeight: '600', color: '#fff' },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: 'auto' },
  dateText: { fontSize: 11, color: '#9ca3af' },
  cardTitle: { fontSize: 15.5, fontWeight: '700', color: '#111827', marginBottom: 6 },
  cardContent: { fontSize: 13.5, color: '#4b5563', lineHeight: 19 },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
  linkText: { fontSize: 13, color: '#1d4ed8', fontWeight: '600' },
  activityCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  activityIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#2F575519',
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityLabel: { fontSize: 13.5, color: '#374151', lineHeight: 19 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#2F5755', marginTop: 6 },
});
