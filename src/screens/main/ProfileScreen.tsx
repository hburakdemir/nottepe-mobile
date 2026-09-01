import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';
import {
  Bell,
  BellOff,
  Bookmark,
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
  targetId: number;
  created_at: string;
  title: string;
  body?: string;
}

const TABS = [
  { key: 'posts', label: 'Postlar', icon: FileText },
  { key: 'saved', label: 'Kayıtlı', icon: Bookmark },
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
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" color="#2F5755" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-primary">
      <ScrollView>
        <View className="bg-white p-4 m-4 mb-5 rounded-lg" style={SHADOW_MD}>
          <View className="flex-row gap-3.5">
            <View className="w-20 h-20">
              <View className="w-20 h-20 rounded-[20px] bg-brand items-center justify-center overflow-hidden">
                {avatar ? <AvatarDisplay avatar={avatar} size={80} /> : <UserIcon size={32} color="#fff" />}
              </View>
              <Pressable
                className="absolute -bottom-[3px] -right-[3px] w-[22px] h-[22px] rounded-[11px] bg-indigo-600 items-center justify-center"
                onPress={() => setShowAvatarBuilder(true)}
              >
                <Palette size={12} color="#fff" />
              </Pressable>
              <Pressable
                className="absolute -bottom-[3px] -left-[3px] w-[22px] h-[22px] rounded-[11px] bg-brand items-center justify-center"
                onPress={handlePickPhoto}
                disabled={photoUploading}
              >
                {photoUploading ? <ActivityIndicator size="small" color="#fff" /> : <Camera size={12} color="#fff" />}
              </Pressable>
            </View>
            <View className="flex-1">
              <Text className="text-[19px] font-extrabold text-gray-900">{user?.username}</Text>
              <Text className="text-[13px] text-gray-600 mt-0.5">{user?.full_name}</Text>
              <Text className="text-[12.5px] text-gray-500 mt-px">{user?.email}</Text>
              {!!user?.phone && <Text className="text-xs text-gray-400 mt-0.5">{user.phone}</Text>}
              {!!user?.department && (
                <Text className="text-xs text-gray-400 mt-0.5">
                  {user.department}
                  {user.faculty ? ` · ${user.faculty}` : ''}
                </Text>
              )}
              {!!user?.bio && <Text className="text-[12.5px] text-gray-600 mt-1.5 leading-[17px]">{user.bio}</Text>}
            </View>
          </View>

          <View className="flex-row flex-wrap gap-2 mt-3.5">
            {badges.filter((b) => b.is_visible !== false).length === 0 ? (
              <Text className="text-[11.5px] text-gray-400">Henüz rozet yok — not paylaşarak rozet kazanabilirsin!</Text>
            ) : (
              badges.filter((b) => b.is_visible !== false).map((badge) => <BadgeChip key={badge.id} badge={badge} />)
            )}
          </View>

          <Pressable className="flex-row items-center justify-center gap-1.5 bg-brand rounded-[10px] py-2.5 mt-3.5" onPress={() => setShowEditModal(true)}>
            <Edit2 size={15} color="#fff" />
            <Text className="text-white text-[13px] font-bold">Düzenle</Text>
          </Pressable>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="bg-white rounded-lg mx-4 mb-5"
          style={SHADOW_MD}
          contentContainerClassName="px-3"
        >
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
              <Pressable
                key={key}
                className={`flex-row items-center gap-[5px] py-3 mr-[18px] border-b-2 ${active ? 'border-b-brand' : 'border-b-transparent'}`}
                onPress={() => setActiveTab(key)}
              >
                <Icon size={14} color={active ? '#2F5755' : '#9ca3af'} />
                <Text className={`text-[12.5px] font-semibold ${active ? 'text-brand' : 'text-gray-400'}`}>
                  {label}
                  {count !== null ? ` (${count})` : ''}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <View className="px-4 gap-2.5">
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
                  <View key={calc.id} className="flex-row items-center bg-white rounded-lg p-3.5 mb-3" style={SHADOW_SM}>
                    <View className="flex-1">
                      <Text className="text-sm font-bold text-gray-900" numberOfLines={1}>
                        {calc.title}
                      </Text>
                      <Text className="text-[11.5px] text-gray-400 mt-0.5">
                        {semesterCount} dönem · {courseCount} ders · {formatDate(calc.updated_at)}
                      </Text>
                    </View>
                    <View className="items-center mr-2.5">
                      <Text className="text-lg font-extrabold text-brand">{formatGpa(calc.gpa)}</Text>
                      <Text className="text-[9px] text-gray-400 uppercase">GANO</Text>
                    </View>
                    <Pressable className="bg-brand rounded-lg px-2.5 py-[7px]" onPress={() => navigation.navigate('AktsCalculator', { loadId: calc.id })}>
                      <Text className="text-white text-xs font-bold">Düzenle</Text>
                    </Pressable>
                    <Pressable onPress={() => handleAktsDelete(calc.id)} hitSlop={8} className="ml-2">
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
                <Pressable className="flex-row self-end items-center gap-1.5 bg-brand rounded-lg px-3 py-2 mb-2.5" onPress={() => navigation.navigate('Schedule')}>
                  <Edit2 size={13} color="#fff" />
                  <Text className="text-white text-xs font-bold">Düzenle</Text>
                </Pressable>
                {[1, 2, 3, 4, 5, 6].map((day) => {
                  const dayCourses = mySchedule.filter((c) => c.day === day).sort((a, b) => toMinutes(a.start) - toMinutes(b.start));
                  if (dayCourses.length === 0) return null;
                  return (
                    <View key={day} className="bg-white rounded-lg p-3.5 mb-3" style={SHADOW_SM}>
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
                })}
              </View>
            ))}

          {activeTab === 'follows' &&
            (follows.length === 0 ? (
              <EmptyState icon={Bell} text='Henüz bölüm takip etmiyorsun. Bölüm sayfasındaki "Takip Et" butonuyla haberdar olabilirsin.' actionLabel="Bölümlere Göz At" onAction={() => navigation.navigate('Departments')} />
            ) : (
              follows.map((f) => (
                <View key={`${f.faculty}-${f.department}`} className="flex-row items-center bg-white rounded-lg p-3.5 mb-3" style={SHADOW_SM}>
                  <Pressable className="flex-1" onPress={() => navigation.navigate('DepartmentDetail', { faculty: f.faculty, department: f.department })}>
                    <Text className="text-sm font-bold text-gray-900" numberOfLines={1}>
                      {f.department}
                    </Text>
                    <Text className="text-[11.5px] text-gray-400 mt-0.5">{f.faculty}</Text>
                  </Pressable>
                  <Pressable className="flex-row items-center gap-[5px] border border-gray-200 rounded-lg px-2.5 py-[7px]" onPress={() => handleUnfollow(f.faculty, f.department)}>
                    <BellOff size={13} color="#6b7280" />
                    <Text className="text-[11.5px] text-gray-500 font-semibold">Bırak</Text>
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
                <Pressable
                  key={item.key}
                  className="flex-row gap-2 bg-white rounded-lg p-3.5 mb-3"
                  style={SHADOW_SM}
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

        <Pressable className="items-center py-4 mt-2 mb-[30px]" onPress={logout}>
          <Text className="text-red-600 text-[13.5px] font-bold">Çıkış Yap</Text>
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
    <View className="items-center py-[50px] gap-2.5">
      <Icon size={40} color="#d1d5db" />
      <Text className="text-gray-400 text-[13.5px] text-center px-[30px]">{text}</Text>
      {!!actionLabel && (
        <Pressable className="bg-brand rounded-[10px] px-[18px] py-2.5 mt-1" onPress={onAction}>
          <Text className="text-white text-[13px] font-bold">{actionLabel}</Text>
        </Pressable>
      )}
    </View>
  );
}

const SHADOW_MD = {
  shadowColor: '#000',
  shadowOpacity: 0.1,
  shadowRadius: 8,
  shadowOffset: { width: 0, height: 3 },
  elevation: 3,
};

const SHADOW_SM = {
  shadowColor: '#000',
  shadowOpacity: 0.06,
  shadowRadius: 6,
  shadowOffset: { width: 0, height: 2 },
  elevation: 2,
};
