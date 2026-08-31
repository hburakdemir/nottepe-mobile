import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  Bell,
  Bookmark,
  Calculator,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  FileText,
  HelpCircle,
  Lightbulb,
  ListChecks,
  Lock,
  MessagesSquare,
  ShieldOff,
  User as UserIcon,
} from 'lucide-react-native';
import { avatarAPI, badgeAPI, faqAPI, suggestionAPI, userAPI } from '../../lib/api';
import PostCard from '../../components/PostCard';
import BadgeChip, { type Badge } from '../../components/BadgeChip';
import ChecklistCard from '../../components/ChecklistCard';
import AvatarDisplay from '../../components/avatar/AvatarDisplay';
import type { AvatarData } from '../../components/avatar/AvatarDisplay';
import { DAY_NAMES, getCourseColor, toMinutes, type ScheduleCourse } from '../../utils/schedule';
import { formatGpa } from '../../utils/gano';
import type { Checklist } from '../../types/checklist';
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
  profile_section_visibility?: Record<string, boolean>;
}

interface AktsCalc {
  id: number;
  title: string;
  gpa: number | null;
  updated_at: string;
  data: { semesters: { courses: unknown[] }[] };
}

interface Follow {
  faculty: string;
  department: string;
}

interface ForumItem {
  key: string;
  kind: 'faq' | 'suggestion';
  created_at: string;
  title: string;
  body?: string;
}

const POSTS_LIMIT = 12;

const DEFAULT_SECTION_VISIBILITY: Record<string, boolean> = {
  saved_posts: true,
  my_lists: true,
  akts: true,
  schedule: true,
  follows: true,
  forums: true,
  badges: true,
};

const TAB_DEFS = [
  { key: 'posts', label: 'Paylaştığı Notlar', icon: FileText, sectionKey: null },
  { key: 'saved', label: 'Kaydettikleri', icon: Bookmark, sectionKey: 'saved_posts' },
  { key: 'lists', label: 'Checklistleri', icon: ListChecks, sectionKey: 'my_lists' },
  { key: 'akts', label: 'AKTS Hesapları', icon: Calculator, sectionKey: 'akts' },
  { key: 'schedule', label: 'Ders Programı', icon: CalendarDays, sectionKey: 'schedule' },
  { key: 'follows', label: 'Takip Ettikleri', icon: Bell, sectionKey: 'follows' },
  { key: 'forums', label: 'Forumlar', icon: MessagesSquare, sectionKey: 'forums' },
] as const;

type TabKey = (typeof TAB_DEFS)[number]['key'];

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function UserProfileScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { username } = route.params as RootStackParamList['UserProfile'];

  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [avatar, setAvatar] = useState<AvatarData | null>(null);
  const [badges, setBadges] = useState<Badge[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [banned, setBanned] = useState(false);

  const [activeTab, setActiveTab] = useState<TabKey>('posts');
  const [loadedTabs, setLoadedTabs] = useState<Set<TabKey>>(new Set());

  const [posts, setPosts] = useState<Post[]>([]);
  const [postsTotal, setPostsTotal] = useState(0);
  const [postsPage, setPostsPage] = useState(1);
  const [postsLoading, setPostsLoading] = useState(false);

  const [savedPosts, setSavedPosts] = useState<Post[]>([]);
  const [checklists, setChecklists] = useState<Checklist[]>([]);
  const [expandedChecklistId, setExpandedChecklistId] = useState<number | null>(null);
  const [aktsCalcs, setAktsCalcs] = useState<AktsCalc[]>([]);
  const [scheduleCourses, setScheduleCourses] = useState<ScheduleCourse[]>([]);
  const [follows, setFollows] = useState<Follow[]>([]);
  const [tabLoading, setTabLoading] = useState(false);
  const [forumItems, setForumItems] = useState<ForumItem[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setNotFound(false);
      setBanned(false);
      setActiveTab('posts');
      setLoadedTabs(new Set());
      try {
        const profileRes = await userAPI.getProfile(username);
        if (cancelled) return;
        const p: PublicProfile = profileRes.data.profile;
        setProfile(p);
        const sectionVisibility = { ...DEFAULT_SECTION_VISIBILITY, ...(p.profile_section_visibility || {}) };
        const [avatarRes, badgeRes] = await Promise.all([
          avatarAPI.getByUserId(p.id).catch(() => ({ data: { avatar: null } })),
          sectionVisibility.badges ? badgeAPI.getByUser(p.id).catch(() => ({ data: { badges: [] } })) : Promise.resolve({ data: { badges: [] } }),
        ]);
        if (cancelled) return;
        setAvatar(avatarRes.data?.avatar || null);
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
        const res = await userAPI.getPosts(username, { page: postsPage, limit: POSTS_LIMIT });
        if (cancelled) return;
        setPosts(res.data.posts || []);
        setPostsTotal(res.data.total || 0);
      } catch {
        if (!cancelled) setPosts([]);
      } finally {
        if (!cancelled) setPostsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [profile, postsPage, username]);

  useEffect(() => {
    if (!profile || profile.is_public === false) return;
    if (activeTab === 'posts' || loadedTabs.has(activeTab)) return;

    let cancelled = false;
    (async () => {
      setTabLoading(true);
      try {
        if (activeTab === 'saved') {
          const res = await userAPI.getSavedPosts(username);
          if (!cancelled) setSavedPosts(res.data.posts || []);
        } else if (activeTab === 'lists') {
          const res = await userAPI.getChecklists(username);
          if (!cancelled) setChecklists(res.data.checklists || []);
        } else if (activeTab === 'akts') {
          const res = await userAPI.getAkts(username);
          if (!cancelled) setAktsCalcs(res.data.calculations || []);
        } else if (activeTab === 'schedule') {
          const res = await userAPI.getSchedule(username);
          if (!cancelled) setScheduleCourses(res.data.courses || []);
        } else if (activeTab === 'follows') {
          const res = await userAPI.getFollows(username);
          if (!cancelled) setFollows(res.data.follows || []);
        } else if (activeTab === 'forums') {
          const [faqRes, sugRes] = await Promise.all([
            faqAPI.getUserActivity(profile.id).catch(() => ({ data: { activity: [] } })),
            suggestionAPI.getUserActivity(profile.id).catch(() => ({ data: { activity: [] } })),
          ]);
          const faqItems: ForumItem[] = (faqRes.data.activity || []).map((a: any) => ({
            key: `faq-${a.comment_id}`,
            kind: 'faq',
            created_at: a.created_at,
            title: a.question,
            body: a.comment_content,
          }));
          const sugItems: ForumItem[] = (sugRes.data.activity || []).map((a: any) => ({
            key: `suggestion-${a.type}-${a.comment_id || a.suggestion_id}`,
            kind: 'suggestion',
            created_at: a.created_at,
            title: a.type === 'started' ? 'Yeni öneri paylaştı' : 'Öneriye yorum yaptı',
            body: a.type === 'started' ? a.suggestion_content : a.comment_content,
          }));
          if (!cancelled) {
            setForumItems(
              [...faqItems, ...sugItems].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
            );
          }
        }
      } catch {
        // sessizce geç
      } finally {
        if (!cancelled) {
          setTabLoading(false);
          setLoadedTabs((prev) => new Set(prev).add(activeTab));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, profile, username]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2F5755" />
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
  const sectionVisibility = { ...DEFAULT_SECTION_VISIBILITY, ...(profile.profile_section_visibility || {}) };
  const tabs = TAB_DEFS.filter((t) => t.sectionKey === null || sectionVisibility[t.sectionKey]);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#f9fafb' }}>
      <View style={styles.headerCard}>
        <View style={styles.avatarCircle}>
          {avatar ? <AvatarDisplay avatar={avatar} size={80} /> : <UserIcon size={32} color="#fff" />}
        </View>
        <Text style={styles.username}>{profile.username}</Text>
        {!!profile.full_name && <Text style={styles.fullName}>{profile.full_name}</Text>}
        {!!profile.department && (
          <Text style={styles.dept}>
            {profile.department}
            {profile.faculty ? ` · ${profile.faculty}` : ''}
          </Text>
        )}
        {typeof profile.post_count === 'number' && <Text style={styles.postCount}>{profile.post_count} onaylı not</Text>}
        {!!profile.bio && <Text style={styles.bio}>{profile.bio}</Text>}
        {sectionVisibility.badges && (
          <View style={styles.badgeRow}>
            {badges.length === 0 ? (
              <Text style={styles.noBadgeText}>Henüz rozet yok.</Text>
            ) : (
              badges.map((badge) => <BadgeChip key={badge.id} badge={badge} />)
            )}
          </View>
        )}
      </View>

      {isPrivate ? (
        <View style={styles.privateBox}>
          <Lock size={32} color="#9ca3af" />
          <Text style={styles.privateText}>Bu profil gizli.</Text>
          <Text style={styles.privateHint}>Kullanıcı postlarını ve listelerini yalnızca kendisi görebilir.</Text>
        </View>
      ) : (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabBar} contentContainerStyle={{ paddingHorizontal: 12 }}>
            {tabs.map(({ key, label, icon: Icon }) => {
              const active = activeTab === key;
              return (
                <Pressable key={key} style={[styles.tabBtn, active && styles.tabBtnActive]} onPress={() => setActiveTab(key)}>
                  <Icon size={14} color={active ? '#2F5755' : '#9ca3af'} />
                  <Text style={[styles.tabBtnText, active && styles.tabBtnTextActive]}>{label}</Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <View style={styles.tabContent}>
            {activeTab === 'posts' &&
              (postsLoading ? (
                <ActivityIndicator style={{ marginTop: 24 }} color="#2F5755" />
              ) : posts.length === 0 ? (
                <EmptyState icon={FileText} text="Henüz onaylı not paylaşılmamış." />
              ) : (
                <>
                  {posts.map((post) => (
                    <PostCard key={String(post.id ?? post.post_id)} post={post} showRating={false} />
                  ))}
                  {postsTotal > POSTS_LIMIT && (
                    <View style={styles.pagerRow}>
                      <Pressable
                        style={[styles.pagerBtn, postsPage <= 1 && styles.pagerBtnDisabled]}
                        disabled={postsPage <= 1}
                        onPress={() => setPostsPage((p) => Math.max(1, p - 1))}
                      >
                        <ChevronLeft size={16} color={postsPage <= 1 ? '#d1d5db' : '#2F5755'} />
                      </Pressable>
                      <Text style={styles.pagerText}>
                        Sayfa {postsPage} / {Math.ceil(postsTotal / POSTS_LIMIT)}
                      </Text>
                      <Pressable
                        style={[styles.pagerBtn, postsPage >= Math.ceil(postsTotal / POSTS_LIMIT) && styles.pagerBtnDisabled]}
                        disabled={postsPage >= Math.ceil(postsTotal / POSTS_LIMIT)}
                        onPress={() => setPostsPage((p) => p + 1)}
                      >
                        <ChevronRight size={16} color={postsPage >= Math.ceil(postsTotal / POSTS_LIMIT) ? '#d1d5db' : '#2F5755'} />
                      </Pressable>
                    </View>
                  )}
                </>
              ))}

            {activeTab === 'saved' &&
              (tabLoading && !loadedTabs.has('saved') ? (
                <ActivityIndicator style={{ marginTop: 24 }} color="#2F5755" />
              ) : savedPosts.length === 0 ? (
                <EmptyState icon={Bookmark} text="Henüz not kaydetmemiş." />
              ) : (
                savedPosts.map((post) => <PostCard key={String(post.id ?? post.post_id)} post={post} showRating={false} />)
              ))}

            {activeTab === 'lists' &&
              (tabLoading && !loadedTabs.has('lists') ? (
                <ActivityIndicator style={{ marginTop: 24 }} color="#2F5755" />
              ) : checklists.length === 0 ? (
                <EmptyState icon={ListChecks} text="Henüz bir checklist oluşturmamış." />
              ) : (
                checklists.map((checklist) => (
                  <ChecklistCard
                    key={checklist.id}
                    checklist={checklist}
                    isOpen={expandedChecklistId === checklist.id}
                    onToggleOpen={(c) => setExpandedChecklistId((prev) => (prev === c.id ? null : c.id))}
                    readOnlyItems
                  />
                ))
              ))}

            {activeTab === 'akts' &&
              (tabLoading && !loadedTabs.has('akts') ? (
                <ActivityIndicator style={{ marginTop: 24 }} color="#2F5755" />
              ) : aktsCalcs.length === 0 ? (
                <EmptyState icon={Calculator} text="Henüz kayıtlı bir AKTS hesaplaması yok." />
              ) : (
                aktsCalcs.map((calc) => {
                  const semesterCount = calc.data?.semesters?.length || 0;
                  const courseCount = calc.data?.semesters?.reduce((sum, s) => sum + (s.courses?.length || 0), 0) || 0;
                  return (
                    <View key={calc.id} style={styles.rowCard}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.rowCardTitle} numberOfLines={1}>
                          {calc.title}
                        </Text>
                        <Text style={styles.rowCardMeta}>
                          {semesterCount} dönem · {courseCount} ders · {formatDate(calc.updated_at)}
                        </Text>
                      </View>
                      <View style={{ alignItems: 'center' }}>
                        <Text style={styles.gpaValue}>{formatGpa(calc.gpa)}</Text>
                        <Text style={styles.gpaLabel}>GANO</Text>
                      </View>
                    </View>
                  );
                })
              ))}

            {activeTab === 'schedule' &&
              (tabLoading && !loadedTabs.has('schedule') ? (
                <ActivityIndicator style={{ marginTop: 24 }} color="#2F5755" />
              ) : scheduleCourses.length === 0 ? (
                <EmptyState icon={CalendarDays} text="Henüz ders programı oluşturmamış." />
              ) : (
                [1, 2, 3, 4, 5, 6].map((day) => {
                  const dayCourses = scheduleCourses.filter((c) => c.day === day).sort((a, b) => toMinutes(a.start) - toMinutes(b.start));
                  if (dayCourses.length === 0) return null;
                  return (
                    <View key={day} style={styles.dayCard}>
                      <Text style={styles.dayTitle}>{DAY_NAMES[day]}</Text>
                      {dayCourses.map((c) => (
                        <View key={c.id} style={styles.courseRow}>
                          <View style={[styles.colorBar, { backgroundColor: getCourseColor(c.colorIdx).hex }]} />
                          <View style={{ flex: 1 }}>
                            <Text style={styles.courseName} numberOfLines={1}>
                              {c.name}
                            </Text>
                            <Text style={styles.courseMeta}>
                              {c.start}–{c.end}
                              {c.location ? ` · ${c.location}` : ''}
                            </Text>
                          </View>
                        </View>
                      ))}
                    </View>
                  );
                })
              ))}

            {activeTab === 'follows' &&
              (tabLoading && !loadedTabs.has('follows') ? (
                <ActivityIndicator style={{ marginTop: 24 }} color="#2F5755" />
              ) : follows.length === 0 ? (
                <EmptyState icon={Bell} text="Henüz bir bölüm takip etmiyor." />
              ) : (
                follows.map((f) => (
                  <Pressable
                    key={`${f.faculty}-${f.department}`}
                    style={styles.rowCard}
                    onPress={() => navigation.navigate('DepartmentDetail', { faculty: f.faculty, department: f.department })}
                  >
                    <View>
                      <Text style={styles.rowCardTitle}>{f.department}</Text>
                      <Text style={styles.rowCardMeta}>{f.faculty}</Text>
                    </View>
                  </Pressable>
                ))
              ))}

            {activeTab === 'forums' &&
              (forumItems === null ? (
                <ActivityIndicator style={{ marginTop: 24 }} color="#2F5755" />
              ) : forumItems.length === 0 ? (
                <EmptyState icon={MessagesSquare} text="Henüz bir foruma katılmadı." />
              ) : (
                forumItems.map((item) => (
                  <View key={item.key} style={styles.forumRow}>
                    {item.kind === 'faq' ? <HelpCircle size={15} color="#2F5755" /> : <Lightbulb size={15} color="#2F5755" />}
                    <View style={{ flex: 1 }}>
                      <Text style={styles.forumTitle}>{item.title}</Text>
                      {!!item.body && (
                        <Text style={styles.forumBody} numberOfLines={2}>
                          {item.body}
                        </Text>
                      )}
                      <Text style={styles.forumDate}>{formatDate(item.created_at)}</Text>
                    </View>
                  </View>
                ))
              ))}
          </View>
        </>
      )}
    </ScrollView>
  );
}

function EmptyState({ icon: Icon, text }: { icon: any; text: string }) {
  return (
    <View style={styles.emptyBox}>
      <Icon size={40} color="#d1d5db" />
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 32 },
  centerTitle: { fontSize: 15, fontWeight: '600', color: '#374151', textAlign: 'center' },
  headerCard: { backgroundColor: '#fff', padding: 20, alignItems: 'center' },
  avatarCircle: {
    width: 80,
    height: 80,
    borderRadius: 20,
    backgroundColor: '#2F5755',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginBottom: 10,
  },
  username: { fontSize: 20, fontWeight: '700', color: '#111827' },
  fullName: { fontSize: 13.5, color: '#6b7280', marginTop: 2 },
  dept: { fontSize: 12.5, color: '#9ca3af', marginTop: 4, textAlign: 'center' },
  postCount: { fontSize: 12.5, color: '#6b7280', marginTop: 6 },
  bio: { fontSize: 13, color: '#4b5563', marginTop: 10, textAlign: 'center', lineHeight: 19 },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14, justifyContent: 'center' },
  noBadgeText: { fontSize: 11.5, color: '#9ca3af' },
  privateBox: { alignItems: 'center', gap: 8, paddingVertical: 50, paddingHorizontal: 30 },
  privateText: { fontSize: 15, color: '#6b7280', fontWeight: '600' },
  privateHint: { fontSize: 12, color: '#9ca3af', textAlign: 'center' },
  tabBar: { backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#f3f4f6' },
  tabBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 12, marginRight: 18, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabBtnActive: { borderBottomColor: '#2F5755' },
  tabBtnText: { fontSize: 12.5, fontWeight: '600', color: '#9ca3af' },
  tabBtnTextActive: { color: '#2F5755' },
  tabContent: { padding: 12, gap: 10 },
  emptyBox: { alignItems: 'center', paddingVertical: 50, gap: 10 },
  emptyText: { color: '#9ca3af', fontSize: 13.5, textAlign: 'center', paddingHorizontal: 30 },
  rowCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 4 },
  rowCardTitle: { fontSize: 14, fontWeight: '700', color: '#111827' },
  rowCardMeta: { fontSize: 11.5, color: '#9ca3af', marginTop: 2 },
  gpaValue: { fontSize: 18, fontWeight: '800', color: '#2F5755' },
  gpaLabel: { fontSize: 9, color: '#9ca3af', textTransform: 'uppercase' },
  dayCard: { backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 8 },
  dayTitle: { fontSize: 13, fontWeight: '700', color: '#111827', marginBottom: 8 },
  courseRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 },
  colorBar: { width: 4, height: 26, borderRadius: 2 },
  courseName: { fontSize: 12.5, fontWeight: '600', color: '#111827' },
  courseMeta: { fontSize: 11, color: '#6b7280', marginTop: 1 },
  forumRow: { flexDirection: 'row', gap: 8, backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 4 },
  forumTitle: { fontSize: 11.5, fontWeight: '600', color: '#6b7280' },
  forumBody: { fontSize: 13, color: '#374151', marginTop: 3 },
  forumDate: { fontSize: 10.5, color: '#9ca3af', marginTop: 4 },
  pagerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16, paddingVertical: 14 },
  pagerBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  pagerBtnDisabled: { opacity: 0.5 },
  pagerText: { fontSize: 12.5, color: '#6b7280', fontWeight: '600' },
});
