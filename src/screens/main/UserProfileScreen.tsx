import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
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
  targetId: number;
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
            targetId: a.entry_id,
            created_at: a.created_at,
            title: a.question,
            body: a.comment_content,
          }));
          const sugItems: ForumItem[] = (sugRes.data.activity || []).map((a: any) => ({
            key: `suggestion-${a.type}-${a.comment_id || a.suggestion_id}`,
            kind: 'suggestion',
            targetId: a.suggestion_id,
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
      <View className="flex-1 items-center justify-center gap-3 px-8">
        <ActivityIndicator size="large" color="#2F5755" />
      </View>
    );
  }

  if (banned) {
    return (
      <View className="flex-1 items-center justify-center gap-3 px-8">
        <ShieldOff size={48} color="#f87171" />
        <Text className="text-[15px] font-semibold text-gray-700 text-center">Profil görüntülemeniz admin tarafından yasaklanmıştır</Text>
      </View>
    );
  }

  if (notFound || !profile) {
    return (
      <View className="flex-1 items-center justify-center gap-3 px-8">
        <UserIcon size={48} color="#d1d5db" />
        <Text className="text-[15px] font-semibold text-gray-700 text-center">Kullanıcı bulunamadı</Text>
      </View>
    );
  }

  const isPrivate = profile.is_public === false;
  const sectionVisibility = { ...DEFAULT_SECTION_VISIBILITY, ...(profile.profile_section_visibility || {}) };
  const tabs = TAB_DEFS.filter((t) => t.sectionKey === null || sectionVisibility[t.sectionKey]);

  return (
    <ScrollView className="flex-1 bg-primary" contentContainerClassName="px-4 py-8">
      <View className="bg-white rounded-lg p-4 items-center mb-8" style={SHADOW_MD}>
        <View className="w-20 h-20 rounded-3xl bg-brand border-2 border-darkbgbutton items-center justify-center overflow-hidden mb-2.5">
          {avatar ? <AvatarDisplay avatar={avatar} size={80} /> : <UserIcon size={32} color="#fff" />}
        </View>
        <Text className="text-2xl font-bold text-gray-900">{profile.username}</Text>
        {!!profile.full_name && <Text className="text-base text-gray-600 mt-0.5">{profile.full_name}</Text>}
        {!!profile.department && (
          <Text className="text-xs text-gray-500 mt-1 text-center">
            {profile.department}
            {profile.faculty ? ` · ${profile.faculty}` : ''}
          </Text>
        )}
        {typeof profile.post_count === 'number' && <Text className="text-sm text-gray-500 mt-1.5">{profile.post_count} onaylı not</Text>}
        {!!profile.bio && <Text className="text-sm text-gray-600 mt-2 text-center leading-[21px]">{profile.bio}</Text>}
        {sectionVisibility.badges && (
          <View className="flex-row flex-wrap gap-2 mt-3 justify-center">
            {badges.length === 0 ? (
              <Text className="text-xs text-gray-400">Henüz rozet yok.</Text>
            ) : (
              badges.map((badge) => <BadgeChip key={badge.id} badge={badge} />)
            )}
          </View>
        )}
      </View>

      {isPrivate ? (
        <View className="items-center gap-2 py-8 px-[30px] bg-white rounded-lg" style={SHADOW_MD}>
          <Lock size={48} color="#9ca3af" />
          <Text className="text-lg text-gray-500 font-semibold">Bu profil gizli.</Text>
          <Text className="text-sm text-gray-400 text-center">Kullanıcı postlarını ve listelerini yalnızca kendisi görebilir.</Text>
        </View>
      ) : (
        <>
          <View className="bg-white rounded-lg mb-8" style={SHADOW_MD}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="border-b border-gray-200" contentContainerStyle={{ paddingHorizontal: 16 }}>
              {tabs.map(({ key, label, icon: Icon }) => {
                const active = activeTab === key;
                return (
                  <Pressable
                    key={key}
                    className={`flex-row items-center gap-1.5 py-3 mr-5 border-b-2 ${active ? 'border-b-[#1e40af]' : 'border-b-transparent'}`}
                    onPress={() => setActiveTab(key)}
                  >
                    <Icon size={16} color={active ? '#1e3a8a' : '#6b7280'} />
                    <Text className={`text-xs font-medium ${active ? 'text-[#1e3a8a]' : 'text-gray-500'}`}>{label}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          <View className="gap-3">
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
                    <View className="flex-row items-center justify-center gap-4 py-3.5">
                      <Pressable
                        className={`w-[34px] h-[34px] rounded-[17px] bg-white items-center justify-center ${postsPage <= 1 ? 'opacity-50' : ''}`}
                        disabled={postsPage <= 1}
                        onPress={() => setPostsPage((p) => Math.max(1, p - 1))}
                      >
                        <ChevronLeft size={16} color={postsPage <= 1 ? '#d1d5db' : '#2F5755'} />
                      </Pressable>
                      <Text className="text-[12.5px] text-gray-500 font-semibold">
                        Sayfa {postsPage} / {Math.ceil(postsTotal / POSTS_LIMIT)}
                      </Text>
                      <Pressable
                        className={`w-[34px] h-[34px] rounded-[17px] bg-white items-center justify-center ${postsPage >= Math.ceil(postsTotal / POSTS_LIMIT) ? 'opacity-50' : ''}`}
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
                    <View key={calc.id} className="flex-row items-center justify-between bg-white rounded-lg p-5 mb-1" style={SHADOW_MD}>
                      <View className="flex-1">
                        <Text className="text-sm font-semibold text-gray-900" numberOfLines={1}>
                          {calc.title}
                        </Text>
                        <Text className="text-sm text-gray-500 mt-0.5">
                          {semesterCount} dönem · {courseCount} ders · {formatDate(calc.updated_at)}
                        </Text>
                      </View>
                      <View className="items-center">
                        <Text className="text-2xl font-bold text-brand">{formatGpa(calc.gpa)}</Text>
                        <Text className="text-[10px] text-gray-400 uppercase">GANO</Text>
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
                    <View key={day} className="bg-white rounded-lg p-3 mb-2" style={SHADOW_MD}>
                      <Text className="text-[13px] font-bold text-gray-900 mb-2">{DAY_NAMES[day]}</Text>
                      {dayCourses.map((c) => (
                        <View key={c.id} className="flex-row items-center gap-2 py-1.5">
                          <View className="w-1 h-[26px] rounded-sm" style={{ backgroundColor: getCourseColor(c.colorIdx).hex }} />
                          <View className="flex-1">
                            <Text className="text-[12.5px] font-semibold text-gray-900" numberOfLines={1}>
                              {c.name}
                            </Text>
                            <Text className="text-[11px] text-gray-500 mt-px">
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
                    className="flex-row items-center justify-between bg-white rounded-lg p-5 mb-1"
                    style={SHADOW_MD}
                    onPress={() => navigation.navigate('DepartmentDetail', { faculty: f.faculty, department: f.department })}
                  >
                    <View>
                      <Text className="text-sm font-semibold text-gray-900">{f.department}</Text>
                      <Text className="text-sm text-gray-500 mt-0.5">{f.faculty}</Text>
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
                  <Pressable
                    key={item.key}
                    className="flex-row gap-2 bg-white rounded-lg p-3 mb-1"
                    style={SHADOW_MD}
                    onPress={() =>
                      item.kind === 'faq'
                        ? navigation.navigate('FaqDetail', { id: item.targetId })
                        : navigation.navigate('SuggestionDetail', { id: item.targetId })
                    }
                  >
                    {item.kind === 'faq' ? <HelpCircle size={15} color="#2F5755" /> : <Lightbulb size={15} color="#2F5755" />}
                    <View className="flex-1">
                      <Text className="text-[11.5px] font-semibold text-gray-500">{item.title}</Text>
                      {!!item.body && (
                        <Text className="text-sm text-gray-700 mt-[3px]" numberOfLines={2}>
                          {item.body}
                        </Text>
                      )}
                      <Text className="text-[10.5px] text-gray-400 mt-1">{formatDate(item.created_at)}</Text>
                    </View>
                  </Pressable>
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
    <View className="items-center py-8 gap-2.5 bg-white rounded-lg" style={SHADOW_MD}>
      <Icon size={48} color="#9ca3af" />
      <Text className="text-gray-500 text-base text-center px-[30px]">{text}</Text>
    </View>
  );
}

const SHADOW_MD = {
  shadowColor: '#000',
  shadowOpacity: 0.1,
  shadowRadius: 8,
  shadowOffset: { width: 0, height: 3 },
  elevation: 3,
} as const;
