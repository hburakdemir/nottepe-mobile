import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Linking, Pressable, Text, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import {
  Bell,
  BookOpen,
  Calendar,
  CheckCircle,
  ExternalLink,
  Megaphone,
  MessageSquare,
  Tag,
  User,
} from 'lucide-react-native';
import { notificationAPI, userNotificationAPI } from '../../lib/api';
import type { RootStackParamList } from '../../navigation/types';
import { useTheme } from '../../context/ThemeContext';

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
  viewed_at?: string | null;
  creator_full_name?: string | null;
  creator_role?: string | null;
  created_at: string;
}

function formatDateTime(dateString: string): string {
  return new Date(dateString).toLocaleDateString('tr-TR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
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
    label: (n) =>
      `Not isteğin karşılandı: ${n.post_title || 'karşılanan not'}${
        n.actor_username ? ` — ${n.actor_full_name || n.actor_username} tarafından` : ''
      }`,
  },
  supported_req_fulfilled: {
    icon: CheckCircle,
    label: (n) =>
      `"+1" verdiğin not isteği karşılandı: ${n.post_title || 'karşılanan not'}${
        n.actor_username ? ` — ${n.actor_full_name || n.actor_username} tarafından` : ''
      }`,
  },
  comment_reply: {
    icon: MessageSquare,
    label: (n) =>
      `${n.actor_full_name || n.actor_username || 'Bir kullanıcı'} yorumuna yanıt verdi${
        n.faq_question ? `: ${n.faq_question}` : n.suggestion_content ? ' (öneri)' : ''
      }`,
  },
};

function AnnouncementCard({ notif }: { notif: Announcement }) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  return (
    <View className="bg-white dark:bg-darkbgbutton rounded-xl p-3.5 mb-2.5">
      <View className="flex-row items-center flex-wrap gap-1.5 mb-2">
        <View className={`px-2 py-[3px] rounded-full ${notif.is_viewed ? 'bg-gray-100 dark:bg-gray-700/40' : 'bg-brand'}`}>
          <Text className={`text-[10.5px] font-semibold ${notif.is_viewed ? 'text-gray-500 dark:text-gray-400' : 'text-white'}`}>
            {notif.is_viewed ? `Görüntüleme Tarihi${notif.viewed_at ? ` · ${formatDateTime(notif.viewed_at)}` : ''}` : 'Yeni'}
          </Text>
        </View>
        {!!notif.category_name && (
          <View className="flex-row items-center gap-1 bg-brand-light rounded-full px-2 py-[3px]">
            <Tag size={11} color="#fff" />
            <Text className="text-[10.5px] font-semibold text-white">{notif.category_name}</Text>
          </View>
        )}
        {!!notif.creator_full_name && (
          <View className="flex-row items-center gap-1 bg-gray-100 dark:bg-gray-700/40 rounded-full px-2 py-[3px]">
            <User size={11} color={isDark ? '#9ca3af' : '#4b5563'} />
            <Text className="text-[10.5px] font-semibold text-gray-600 dark:text-gray-300">{notif.creator_full_name}</Text>
            {!!notif.creator_role && (
              <View className={`rounded ml-0.5 px-1 ${notif.creator_role === 'admin' ? 'bg-blue-900' : 'bg-blue-100 dark:bg-blue-900/40'}`}>
                <Text className={`text-[9px] font-bold ${notif.creator_role === 'admin' ? 'text-yellow-300' : 'text-blue-700 dark:text-blue-300'}`}>
                  {notif.creator_role}
                </Text>
              </View>
            )}
          </View>
        )}
        <View className="flex-row items-center gap-1 ml-auto">
          <Calendar size={11} color={isDark ? '#6b7280' : '#9ca3af'} />
          <Text className="text-[11px] text-gray-400 dark:text-gray-500">Duyuru Tarihi: {formatDate(notif.created_at)}</Text>
        </View>
      </View>
      <Text className="text-[15.5px] font-bold text-gray-900 dark:text-darktext mb-1.5">{notif.title}</Text>
      <Text className="text-[13.5px] text-gray-600 dark:text-darktext/80 leading-[19px]">{notif.content}</Text>
      {!!notif.link && (
        <Pressable className="flex-row items-center gap-1.5 mt-2.5" onPress={() => Linking.openURL(notif.link!)}>
          <ExternalLink size={14} color={isDark ? '#60a5fa' : '#1d4ed8'} />
          <Text className="text-[13px] text-blue-700 dark:text-blue-400 font-semibold">Daha fazla bilgi</Text>
        </Pressable>
      )}
    </View>
  );
}

function ActivityCard({ notif }: { notif: any }) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const meta = ACTIVITY_TYPE_META[notif.type];
  const Icon = meta?.icon || Bell;
  const label = meta ? meta.label(notif) : 'Yeni aktivite bildirimi';
  const canNavigate = !!notif.post_id || !!notif.faq_entry_id || !!notif.suggestion_id;

  const handlePress = () => {
    if (notif.post_id) navigation.navigate('PostDetail', { postId: notif.post_id });
    else if (notif.faq_entry_id) navigation.navigate('FaqDetail', { id: notif.faq_entry_id });
    else if (notif.suggestion_id) navigation.navigate('SuggestionDetail', { id: notif.suggestion_id });
  };

  return (
    <Pressable className="flex-row items-start gap-2.5 bg-white dark:bg-darkbgbutton rounded-xl p-3 mb-2.5" disabled={!canNavigate} onPress={handlePress}>
      <View className="w-[34px] h-[34px] rounded-[17px] bg-brand/10 dark:bg-brand-light/20 items-center justify-center">
        <Icon size={16} color={isDark ? '#5A9690' : '#2F5755'} />
      </View>
      <View className="flex-1">
        <Text className="text-[13.5px] text-gray-700 dark:text-darktext leading-[19px]">{label}</Text>
        <Text className="text-[11px] text-gray-400 dark:text-gray-500">{formatDate(notif.created_at)}</Text>
      </View>
      {!notif.read_at && <View className="w-2 h-2 rounded-full bg-brand mt-1.5" />}
    </Pressable>
  );
}

export default function NotificationsScreen() {
  const route = useRoute<RouteProp<RootStackParamList, 'Notifications'>>();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [tab, setTab] = useState<'duyurular' | 'aktivite'>(route.params?.initialTab ?? 'duyurular');

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
    <View className="flex-1 bg-gray-50 dark:bg-darkbgbutton">
      <View className="flex-row gap-2 p-3 pb-1">
        <Pressable
          className={`flex-row items-center gap-1.5 border border-brand rounded-[10px] px-3.5 py-2 ${tab === 'duyurular' ? 'bg-brand' : ''}`}
          onPress={() => setTab('duyurular')}
        >
          <Megaphone size={15} color={tab === 'duyurular' ? '#fff' : isDark ? '#5A9690' : '#2F5755'} />
          <Text className={`text-[13px] font-semibold ${tab === 'duyurular' ? 'text-white' : 'text-brand dark:text-brand-light'}`}>Duyurular</Text>
        </Pressable>
        <Pressable
          className={`flex-row items-center gap-1.5 border border-brand rounded-[10px] px-3.5 py-2 ${tab === 'aktivite' ? 'bg-brand' : ''}`}
          onPress={() => setTab('aktivite')}
        >
          <Bell size={15} color={tab === 'aktivite' ? '#fff' : isDark ? '#5A9690' : '#2F5755'} />
          <Text className={`text-[13px] font-semibold ${tab === 'aktivite' ? 'text-white' : 'text-brand dark:text-brand-light'}`}>Aktivite</Text>
        </Pressable>
      </View>

      {tab === 'duyurular' ? (
        <FlatList
          contentContainerClassName="p-3 flex-grow gap-2.5"
          data={announcements}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => <AnnouncementCard notif={item} />}
          ListHeaderComponent={
            categories.length > 0 ? (
              <View className="flex-row flex-wrap gap-2 mb-3">
                <Pressable
                  className={`rounded-full px-3 py-1.5 border ${activeCategory === '' ? 'bg-brand border-brand' : 'bg-white dark:bg-darkbgbutton border-gray-200 dark:border-gray-600'}`}
                  onPress={() => setActiveCategory('')}
                >
                  <Text className={`text-xs font-medium ${activeCategory === '' ? 'text-white' : 'text-gray-500 dark:text-gray-400'}`}>Tümü</Text>
                </Pressable>
                {categories.map((cat) => (
                  <Pressable
                    key={cat.id}
                    className={`rounded-full px-3 py-1.5 border ${activeCategory === cat.slug ? 'bg-brand border-brand' : 'bg-white dark:bg-darkbgbutton border-gray-200 dark:border-gray-600'}`}
                    onPress={() => setActiveCategory(cat.slug)}
                  >
                    <Text className={`text-xs font-medium ${activeCategory === cat.slug ? 'text-white' : 'text-gray-500 dark:text-gray-400'}`}>
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
              <Text className="text-center text-gray-400 dark:text-gray-500 mt-6">Henüz bildirim yok.</Text>
            )
          }
        />
      ) : (
        <FlatList
          contentContainerClassName="p-3 flex-grow gap-2.5"
          data={activity}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => <ActivityCard notif={item} />}
          ListEmptyComponent={
            activityLoading ? (
              <ActivityIndicator style={{ marginTop: 24 }} color="#1d4ed8" />
            ) : (
              <Text className="text-center text-gray-400 dark:text-gray-500 mt-6">Henüz aktivite bildirimi yok.</Text>
            )
          }
        />
      )}
    </View>
  );
}
