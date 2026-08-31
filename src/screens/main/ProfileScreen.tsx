import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';
import {
  Bell,
  BellOff,
  Calculator,
  CalendarDays,
  Camera,
  Edit2,
  FileText,
  HelpCircle,
  Lightbulb,
  ListChecks,
  MessagesSquare,
  Palette,
  Trash2,
  User as UserIcon,
} from 'lucide-react-native';
import {
  aktsAPI,
  avatarAPI,
  badgeAPI,
  checklistAPI,
  departmentFollowAPI,
  faqAPI,
  postsAPI,
  savedPostsAPI,
  scheduleAPI,
  suggestionAPI,
} from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { useSavedPosts } from '../../context/SavedPostContext';
import PostCard from '../../components/PostCard';
import BadgeChip, { type Badge } from '../../components/BadgeChip';
import ChecklistCard from '../../components/ChecklistCard';
import ChecklistStatsModal from '../../components/ChecklistStatsModal';
import ChecklistEditModal from '../../components/ChecklistEditModal';
import ProfileEditModal from '../../components/profile/ProfileEditModal';
import DeleteAccountModal from '../../components/profile/DeleteAccountModal';
import AvatarBuilderScreen from './AvatarBuilderScreen';
import AvatarDisplay from '../../components/avatar/AvatarDisplay';
import type { AvatarData } from '../../components/avatar/AvatarDisplay';
import { isWithinEditWindow, type Checklist, type ChecklistItem } from '../../types/checklist';
import { DAY_NAMES, getCourseColor, toMinutes, type ScheduleCourse } from '../../utils/schedule';
import { formatGpa } from '../../utils/gano';
import type { Post } from '../../types/post';
import type { RootStackParamList } from '../../navigation/types';

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

const TABS = [
  { key: 'posts', label: 'Notlarım', icon: FileText },
  { key: 'saved', label: 'Kaydedilenler', icon: FileText },
  { key: 'lists', label: 'Checklistler', icon: ListChecks },
  { key: 'akts', label: 'AKTS', icon: Calculator },
  { key: 'schedule', label: 'Program', icon: CalendarDays },
  { key: 'follows', label: 'Takip', icon: Bell },
  { key: 'forums', label: 'Forumlar', icon: MessagesSquare },
] as const;

type TabKey = (typeof TABS)[number]['key'];

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function ProfileScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user, logout } = useAuth();
  const isStaff = user?.role === 'admin' || user?.role === 'moderator';
  const { savedPosts, fetchSavedPosts } = useSavedPosts();

  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>('posts');

  const [myPosts, setMyPosts] = useState<Post[]>([]);
  const [savedPostsData, setSavedPostsData] = useState<Post[]>([]);
  const [myChecklists, setMyChecklists] = useState<Checklist[]>([]);
  const [expandedChecklistId, setExpandedChecklistId] = useState<number | null>(null);
  const [statsChecklist, setStatsChecklist] = useState<Checklist | null>(null);
  const [editChecklist, setEditChecklist] = useState<Checklist | null>(null);
  const [aktsCalcs, setAktsCalcs] = useState<AktsCalc[]>([]);
  const [mySchedule, setMySchedule] = useState<ScheduleCourse[]>([]);
  const [follows, setFollows] = useState<Follow[]>([]);
  const [badges, setBadges] = useState<Badge[]>([]);
  const [avatar, setAvatar] = useState<AvatarData | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);

  const [forumItems, setForumItems] = useState<ForumItem[] | null>(null);
  const [forumLoading, setForumLoading] = useState(false);

  const [showAvatarBuilder, setShowAvatarBuilder] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const results = await Promise.allSettled([
      postsAPI.getMyPosts(),
      savedPostsAPI.getSavedPosts(),
      avatarAPI.get(),
      aktsAPI.getAll(),
      badgeAPI.getMine(),
      checklistAPI.getMine(),
      departmentFollowAPI.getMine(),
      scheduleAPI.getMine(),
    ]);
    const [postsRes, savedRes, avatarRes, aktsRes, badgesRes, checklistsRes, followsRes, scheduleRes] = results;
    setMyPosts(postsRes.status === 'fulfilled' ? postsRes.value.data : []);
    setSavedPostsData(savedRes.status === 'fulfilled' ? savedRes.value.data : []);
    setAvatar(avatarRes.status === 'fulfilled' ? avatarRes.value.data?.avatar || null : null);
    setAktsCalcs(aktsRes.status === 'fulfilled' ? aktsRes.value.data.calculations || [] : []);
    setBadges(badgesRes.status === 'fulfilled' ? badgesRes.value.data.badges || [] : []);
    setMyChecklists(checklistsRes.status === 'fulfilled' ? checklistsRes.value.data.checklists || [] : []);
    setFollows(followsRes.status === 'fulfilled' ? followsRes.value.data.follows || [] : []);
    setMySchedule(scheduleRes.status === 'fulfilled' ? scheduleRes.value.data?.courses || [] : []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  useEffect(() => {
    if (activeTab !== 'forums' || forumItems !== null || !user?.id) return;
    setForumLoading(true);
    Promise.all([
      faqAPI.getUserActivity(user.id).catch(() => ({ data: { activity: [] } })),
      suggestionAPI.getUserActivity(user.id).catch(() => ({ data: { activity: [] } })),
    ]).then(([faqRes, sugRes]) => {
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
      const merged = [...faqItems, ...sugItems].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      setForumItems(merged);
      setForumLoading(false);
    });
  }, [activeTab, forumItems, user?.id]);

  const handlePostDelete = (deletedId: string | number) => {
    setMyPosts((prev) => prev.filter((p) => String(p.id ?? p.post_id) !== String(deletedId)));
  };

  const handleChecklistItemToggle = async (checklistId: number, item: ChecklistItem) => {
    const newChecked = !item.checked;
    setMyChecklists((prev) =>
      prev.map((c) =>
        c.id === checklistId
          ? { ...c, items: c.items.map((i) => (i.id === item.id ? { ...i, checked: newChecked } : i)) }
          : c
      )
    );
    try {
      await checklistAPI.setItemState(item.id, newChecked);
    } catch {
      Alert.alert('Hata', 'Kaydedilemedi, tekrar deneyin.');
    }
  };

  const handleAktsDelete = (id: number) => {
    Alert.alert('Hesaplamayı sil', 'Bu hesaplamayı silmek istediğinize emin misiniz?', [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: async () => {
          try {
            await aktsAPI.delete(id);
            setAktsCalcs((prev) => prev.filter((c) => c.id !== id));
          } catch {
            Alert.alert('Hata', 'Silinemedi.');
          }
        },
      },
    ]);
  };

  const handleUnfollow = async (faculty: string, department: string) => {
    setFollows((prev) => prev.filter((f) => !(f.faculty === faculty && f.department === department)));
    try {
      await departmentFollowAPI.unfollow(faculty, department);
    } catch {
      Alert.alert('Hata', 'İşlem başarısız.');
    }
  };

  const visibleBadgeCount = badges.filter((b) => b.is_visible !== false).length;

  const handleToggleBadgeVisibility = async (badge: Badge) => {
    const nextVisible = !(badge.is_visible !== false);
    if (!nextVisible && visibleBadgeCount <= 1) {
      Alert.alert('Uyarı', 'En az bir rozet görünür kalmalı.');
      return;
    }
    try {
      await badgeAPI.setVisibility(badge.id, nextVisible);
      setBadges((prev) => prev.map((b) => (b.id === badge.id ? { ...b, is_visible: nextVisible } : b)));
    } catch (err: any) {
      Alert.alert('Hata', err.response?.data?.message || 'Rozet görünürlüğü güncellenemedi.');
    }
  };

  const handlePickPhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('İzin gerekli', 'Fotoğraf seçmek için galeri izni vermelisiniz.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    setPhotoUploading(true);
    try {
      const res = await avatarAPI.uploadPhoto({
        uri: asset.uri,
        name: asset.fileName || 'photo.jpg',
        type: asset.mimeType || 'image/jpeg',
      });
      setAvatar(res.data.avatar);
    } catch (err: any) {
      Alert.alert('Hata', err.response?.data?.error || 'Fotoğraf yüklenemedi.');
    } finally {
      setPhotoUploading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2F5755" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#f9fafb' }}>
      <ScrollView>
        <View style={styles.headerCard}>
          <View style={styles.headerTop}>
            <View style={styles.avatarWrap}>
              <View style={styles.avatarCircle}>
                {avatar ? <AvatarDisplay avatar={avatar} size={80} /> : <UserIcon size={32} color="#fff" />}
              </View>
              <Pressable style={styles.paletteBtn} onPress={() => setShowAvatarBuilder(true)}>
                <Palette size={12} color="#fff" />
              </Pressable>
              <Pressable style={styles.cameraBtn} onPress={handlePickPhoto} disabled={photoUploading}>
                {photoUploading ? <ActivityIndicator size="small" color="#fff" /> : <Camera size={12} color="#fff" />}
              </Pressable>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.username}>{user?.username}</Text>
              <Text style={styles.fullName}>{user?.full_name}</Text>
              <Text style={styles.email}>{user?.email}</Text>
              {!!user?.phone && <Text style={styles.meta}>{user.phone}</Text>}
              {!!user?.department && (
                <Text style={styles.meta}>
                  {user.department}
                  {user.faculty ? ` · ${user.faculty}` : ''}
                </Text>
              )}
              {!!user?.bio && <Text style={styles.bio}>{user.bio}</Text>}
            </View>
          </View>

          <View style={styles.badgeRow}>
            {badges.filter((b) => b.is_visible !== false).length === 0 ? (
              <Text style={styles.noBadgeText}>Henüz rozet yok — not paylaşarak rozet kazanabilirsin!</Text>
            ) : (
              badges.filter((b) => b.is_visible !== false).map((badge) => <BadgeChip key={badge.id} badge={badge} />)
            )}
          </View>

          <Pressable style={styles.editBtn} onPress={() => setShowEditModal(true)}>
            <Edit2 size={15} color="#fff" />
            <Text style={styles.editBtnText}>Düzenle</Text>
          </Pressable>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabBar} contentContainerStyle={{ paddingHorizontal: 12 }}>
          {TABS.map(({ key, label, icon: Icon }) => {
            const count =
              key === 'posts'
                ? myPosts.length
                : key === 'saved'
                ? savedPosts.length
                : key === 'lists'
                ? myChecklists.length
                : key === 'akts'
                ? aktsCalcs.length
                : key === 'schedule'
                ? mySchedule.length
                : key === 'follows'
                ? follows.length
                : null;
            const active = activeTab === key;
            return (
              <Pressable key={key} style={[styles.tabBtn, active && styles.tabBtnActive]} onPress={() => setActiveTab(key)}>
                <Icon size={14} color={active ? '#2F5755' : '#9ca3af'} />
                <Text style={[styles.tabBtnText, active && styles.tabBtnTextActive]}>
                  {label}
                  {count !== null ? ` (${count})` : ''}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={styles.tabContent}>
          {activeTab === 'posts' &&
            (myPosts.length === 0 ? (
              <EmptyState icon={FileText} text="Henüz not paylaşmadınız." />
            ) : (
              myPosts.map((post) => (
                <PostCard key={String(post.id ?? post.post_id)} post={post} showStatus showRating={false} onDelete={handlePostDelete} />
              ))
            ))}

          {activeTab === 'saved' &&
            (savedPostsData.length === 0 ? (
              <EmptyState icon={FileText} text="Henüz not kaydetmediniz." />
            ) : (
              savedPostsData.map((post) => (
                <PostCard
                  key={String(post.id ?? post.post_id)}
                  post={post}
                  onDelete={() => {
                    fetchSavedPosts();
                    setSavedPostsData((prev) => prev.filter((p) => p.id !== post.id));
                  }}
                />
              ))
            ))}

          {activeTab === 'lists' &&
            (myChecklists.length === 0 ? (
              <EmptyState icon={ListChecks} text="Henüz bir checklist oluşturmadın." actionLabel="Checklistlere Git" onAction={() => navigation.navigate('Checklists')} />
            ) : (
              myChecklists.map((checklist) => (
                <ChecklistCard
                  key={checklist.id}
                  checklist={checklist}
                  isOpen={expandedChecklistId === checklist.id}
                  onToggleOpen={(c) => setExpandedChecklistId((prev) => (prev === c.id ? null : c.id))}
                  onToggleItem={handleChecklistItemToggle}
                  onStatsClick={setStatsChecklist}
                  onEditClick={setEditChecklist}
                  canEdit={isWithinEditWindow(checklist)}
                />
              ))
            ))}

          {activeTab === 'akts' &&
            (aktsCalcs.length === 0 ? (
              <EmptyState icon={Calculator} text="Henüz kayıtlı AKTS hesaplaman yok." actionLabel="Hesaplayıcıya Git" onAction={() => navigation.navigate('AktsCalculator')} />
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
                    <View style={{ alignItems: 'center', marginRight: 10 }}>
                      <Text style={styles.gpaValue}>{formatGpa(calc.gpa)}</Text>
                      <Text style={styles.gpaLabel}>GANO</Text>
                    </View>
                    <Pressable style={styles.smallBtn} onPress={() => navigation.navigate('AktsCalculator', { loadId: calc.id })}>
                      <Text style={styles.smallBtnText}>Düzenle</Text>
                    </Pressable>
                    <Pressable onPress={() => handleAktsDelete(calc.id)} hitSlop={8} style={{ marginLeft: 8 }}>
                      <Trash2 size={17} color="#dc2626" />
                    </Pressable>
                  </View>
                );
              })
            ))}

          {activeTab === 'schedule' &&
            (mySchedule.length === 0 ? (
              <EmptyState icon={CalendarDays} text="Henüz ders programı oluşturmadın." actionLabel="Ders Programı Oluştur" onAction={() => navigation.navigate('Schedule')} />
            ) : (
              <View>
                <Pressable style={styles.editScheduleBtn} onPress={() => navigation.navigate('Schedule')}>
                  <Edit2 size={13} color="#fff" />
                  <Text style={styles.editScheduleBtnText}>Düzenle</Text>
                </Pressable>
                {[1, 2, 3, 4, 5, 6].map((day) => {
                  const dayCourses = mySchedule.filter((c) => c.day === day).sort((a, b) => toMinutes(a.start) - toMinutes(b.start));
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
                })}
              </View>
            ))}

          {activeTab === 'follows' &&
            (follows.length === 0 ? (
              <EmptyState icon={Bell} text='Henüz bölüm takip etmiyorsun. Bölüm sayfasındaki "Takip Et" butonuyla haberdar olabilirsin.' actionLabel="Bölümlere Göz At" onAction={() => navigation.navigate('MainTabs', { screen: 'Departments' } as any)} />
            ) : (
              follows.map((f) => (
                <View key={`${f.faculty}-${f.department}`} style={styles.rowCard}>
                  <Pressable style={{ flex: 1 }} onPress={() => navigation.navigate('DepartmentDetail', { faculty: f.faculty, department: f.department })}>
                    <Text style={styles.rowCardTitle} numberOfLines={1}>
                      {f.department}
                    </Text>
                    <Text style={styles.rowCardMeta}>{f.faculty}</Text>
                  </Pressable>
                  <Pressable style={styles.unfollowBtn} onPress={() => handleUnfollow(f.faculty, f.department)}>
                    <BellOff size={13} color="#6b7280" />
                    <Text style={styles.unfollowBtnText}>Bırak</Text>
                  </Pressable>
                </View>
              ))
            ))}

          {activeTab === 'forums' &&
            (forumLoading || forumItems === null ? (
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

        <Pressable style={styles.logoutBtn} onPress={logout}>
          <Text style={styles.logoutText}>Çıkış Yap</Text>
        </Pressable>
      </ScrollView>

      {statsChecklist && <ChecklistStatsModal checklist={statsChecklist} onClose={() => setStatsChecklist(null)} />}
      {editChecklist && (
        <ChecklistEditModal
          checklist={editChecklist}
          onClose={() => setEditChecklist(null)}
          onSaved={() => checklistAPI.getMine().then((res) => setMyChecklists(res.data.checklists || []))}
        />
      )}

      {showEditModal && (
        <ProfileEditModal
          badges={badges}
          onToggleBadgeVisibility={handleToggleBadgeVisibility}
          onClose={() => setShowEditModal(false)}
          onDeleteAccountRequest={() => setShowDeleteModal(true)}
        />
      )}
      {showDeleteModal && <DeleteAccountModal onClose={() => setShowDeleteModal(false)} />}

      <Modal visible={showAvatarBuilder} animationType="slide" onRequestClose={() => setShowAvatarBuilder(false)}>
        <AvatarBuilderScreen
          initialConfig={avatar?.config || {}}
          isStaff={isStaff}
          onClose={() => setShowAvatarBuilder(false)}
          onSaved={(newCfg) => {
            setAvatar((prev) => ({ ...(prev || {}), config: newCfg }));
          }}
        />
      </Modal>
    </View>
  );
}

function EmptyState({
  icon: Icon,
  text,
  actionLabel,
  onAction,
}: {
  icon: any;
  text: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.emptyBox}>
      <Icon size={40} color="#d1d5db" />
      <Text style={styles.emptyText}>{text}</Text>
      {!!actionLabel && (
        <Pressable style={styles.emptyActionBtn} onPress={onAction}>
          <Text style={styles.emptyActionText}>{actionLabel}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  headerCard: { backgroundColor: '#fff', padding: 16 },
  headerTop: { flexDirection: 'row', gap: 14 },
  avatarWrap: { width: 80, height: 80 },
  avatarCircle: {
    width: 80,
    height: 80,
    borderRadius: 20,
    backgroundColor: '#2F5755',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  paletteBtn: {
    position: 'absolute',
    bottom: -3,
    right: -3,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#4f46e5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraBtn: {
    position: 'absolute',
    bottom: -3,
    left: -3,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#2F5755',
    alignItems: 'center',
    justifyContent: 'center',
  },
  username: { fontSize: 19, fontWeight: '800', color: '#111827' },
  fullName: { fontSize: 13, color: '#4b5563', marginTop: 2 },
  email: { fontSize: 12.5, color: '#6b7280', marginTop: 1 },
  meta: { fontSize: 12, color: '#9ca3af', marginTop: 2 },
  bio: { fontSize: 12.5, color: '#4b5563', marginTop: 6, lineHeight: 17 },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  noBadgeText: { fontSize: 11.5, color: '#9ca3af' },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#2F5755',
    borderRadius: 10,
    paddingVertical: 10,
    marginTop: 14,
  },
  editBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  tabBar: { backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#f3f4f6' },
  tabBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 12, marginRight: 18, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabBtnActive: { borderBottomColor: '#2F5755' },
  tabBtnText: { fontSize: 12.5, fontWeight: '600', color: '#9ca3af' },
  tabBtnTextActive: { color: '#2F5755' },
  tabContent: { padding: 12, gap: 10 },
  emptyBox: { alignItems: 'center', paddingVertical: 50, gap: 10 },
  emptyText: { color: '#9ca3af', fontSize: 13.5, textAlign: 'center', paddingHorizontal: 30 },
  emptyActionBtn: { backgroundColor: '#2F5755', borderRadius: 10, paddingHorizontal: 18, paddingVertical: 10, marginTop: 4 },
  emptyActionText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  rowCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 4 },
  rowCardTitle: { fontSize: 14, fontWeight: '700', color: '#111827' },
  rowCardMeta: { fontSize: 11.5, color: '#9ca3af', marginTop: 2 },
  gpaValue: { fontSize: 18, fontWeight: '800', color: '#2F5755' },
  gpaLabel: { fontSize: 9, color: '#9ca3af', textTransform: 'uppercase' },
  smallBtn: { backgroundColor: '#2F5755', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7 },
  smallBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  unfollowBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7 },
  unfollowBtnText: { fontSize: 11.5, color: '#6b7280', fontWeight: '600' },
  editScheduleBtn: { flexDirection: 'row', alignSelf: 'flex-end', alignItems: 'center', gap: 6, backgroundColor: '#2F5755', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 10 },
  editScheduleBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
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
  logoutBtn: { alignItems: 'center', paddingVertical: 16, marginTop: 8, marginBottom: 30 },
  logoutText: { color: '#dc2626', fontSize: 13.5, fontWeight: '700' },
});
