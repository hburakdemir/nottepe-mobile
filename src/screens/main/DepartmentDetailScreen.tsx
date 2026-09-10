import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native';
import { useRoute } from '@react-navigation/native';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import { Bell, BellOff } from 'lucide-react-native';
import { postsAPI, departmentFollowAPI } from '../../lib/api';
import PostCard from '../../components/PostCard';
import { useFeedTokens } from '../../theme/feedTokens';
import { useTheme } from '../../context/ThemeContext';
import type { RootStackParamList } from '../../navigation/types';
import type { Post } from '../../types/post';
import { TAB_BAR_SAFE_PADDING } from '../../components/layout/tabBarMetrics';
import StateView from '../../components/StateView';

interface PostsPage {
  posts: Post[];
  total: number;
}

export default function DepartmentDetailScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { faculty, department } = route.params as RootStackParamList['DepartmentDetail'];
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const t = useFeedTokens();

  const [isFollowing, setIsFollowing] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);

  const { data: statusData } = useQuery({
    queryKey: ['department-follow-status', faculty, department],
    queryFn: async () => (await departmentFollowAPI.getStatus(faculty, department)).data,
  });

  useEffect(() => {
    if (statusData) setIsFollowing(!!statusData.following);
  }, [statusData]);

  const toggleFollow = async () => {
    if (followBusy) return;
    const next = !isFollowing;
    setIsFollowing(next);
    setFollowBusy(true);
    try {
      if (next) {
        await departmentFollowAPI.follow(faculty, department);
      } else {
        await departmentFollowAPI.unfollow(faculty, department);
      }
    } catch {
      setIsFollowing(!next);
    } finally {
      setFollowBusy(false);
    }
  };

  const { data, isLoading, isError, fetchNextPage, hasNextPage, isFetchingNextPage, refetch } = useInfiniteQuery({
    queryKey: ['department-posts', faculty, department],
    queryFn: async ({ pageParam }) => {
      const res = await postsAPI.getAllPosts({ page: pageParam, faculty, department });
      return res.data as PostsPage;
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => {
      const loaded = allPages.reduce((sum, p) => sum + p.posts.length, 0);
      return loaded < lastPage.total ? allPages.length + 1 : undefined;
    },
  });

  const posts = useMemo(() => data?.pages.flatMap((p) => p.posts) ?? [], [data]);
  const total = data?.pages[0]?.total ?? 0;

  const renderPost = useCallback(({ item }: { item: Post }) => <PostCard post={item} />, []);

  const header = (
    <View className="pb-8 px-4 items-center">
      <View className="flex-row items-center justify-center flex-wrap gap-3">
        <Text className="text-xl font-bold text-ink flex-shrink text-center">{department}</Text>
        <Pressable
          className={`flex-row items-center gap-2 rounded-lg px-4 py-2 ${isFollowing ? 'bg-transparent border border-accent' : 'bg-brand'}`}
          onPress={toggleFollow}
          disabled={followBusy}
        >
          {isFollowing ? <BellOff size={16} color={isDark ? '#5A9690' : '#2F5755'} /> : <Bell size={16} color="#fff" />}
          <Text className={`text-sm font-medium ${isFollowing ? 'text-accent' : 'text-white'}`}>
            {isFollowing ? 'Takibi Bırak' : 'Takip Et'}
          </Text>
        </Pressable>
      </View>
      {/* Fakülte adı artık üst barda yazıyor (bkz. AppHeader.tsx derivedTitle) —
          burada ikinci kez göstermek tekrar oluyordu. */}
      {total > 0 && <Text className="text-sm text-muted2 mt-2 text-center">{total} not bulundu</Text>}
    </View>
  );

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center py-[60px]">
        <StateView kind="loading" loadingColor={isDark ? '#5A9690' : '#1d4ed8'} />
      </View>
    );
  }

  if (isError) {
    return (
      <View className="flex-1 items-center justify-center py-[60px]">
        <StateView kind="error" title="Notlar yüklenemedi." onAction={() => refetch()} />
      </View>
    );
  }

  return (
    <FlatList
      showsVerticalScrollIndicator={false}
      className="flex-1"
      style={{ backgroundColor: t.ground }}
      contentContainerStyle={{ paddingTop: 4, paddingBottom: TAB_BAR_SAFE_PADDING, flexGrow: 1 }}
      data={posts}
      keyExtractor={(item) => String(item.id ?? item.post_id)}
      renderItem={renderPost}
      removeClippedSubviews
      maxToRenderPerBatch={6}
      windowSize={7}
      initialNumToRender={6}
      ListHeaderComponent={header}
      onEndReachedThreshold={0.4}
      onEndReached={() => {
        if (hasNextPage && !isFetchingNextPage) fetchNextPage();
      }}
      ListFooterComponent={
        isFetchingNextPage ? (
          <ActivityIndicator style={{ marginVertical: 16 }} color={isDark ? '#5A9690' : '#1d4ed8'} />
        ) : !hasNextPage && posts.length > 0 ? (
          <Text className="text-center text-sm text-muted2 py-6">Tüm notlar yüklendi ({total} not)</Text>
        ) : null
      }
      ListEmptyComponent={
        <View className="bg-surface rounded-lg p-12 items-center" style={SHADOW_MD}>
          <Text className="text-muted text-lg text-center mb-4">Bu bölüm için henüz not paylaşılmamış.</Text>
          <Pressable className="bg-brand rounded-lg px-4 py-2" onPress={() => navigation.navigate('AddPost')}>
            <Text className="text-white text-base font-medium">İlk Notu Siz Paylaşın</Text>
          </Pressable>
        </View>
      }
    />
  );
}

const SHADOW_MD = {
  shadowColor: '#000',
  shadowOpacity: 0.1,
  shadowRadius: 8,
  shadowOffset: { width: 0, height: 3 },
  elevation: 3,
};
