import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRoute } from '@react-navigation/native';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { Bell, BellOff } from 'lucide-react-native';
import { postsAPI, departmentFollowAPI } from '../../lib/api';
import PostCard from '../../components/PostCard';
import type { RootStackParamList } from '../../navigation/types';
import type { Post } from '../../types/post';

interface PostsPage {
  posts: Post[];
  total: number;
}

export default function DepartmentDetailScreen() {
  const route = useRoute<any>();
  const { faculty, department } = route.params as RootStackParamList['DepartmentDetail'];

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

  const {
    data,
    isLoading,
    isError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
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

  const header = (
    <View style={styles.header}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>{department}</Text>
        <Pressable
          style={[styles.followBtn, isFollowing && styles.followBtnActive]}
          onPress={toggleFollow}
          disabled={followBusy}
        >
          {isFollowing ? <BellOff size={14} color="#2F5755" /> : <Bell size={14} color="#fff" />}
          <Text style={[styles.followBtnText, isFollowing && styles.followBtnTextActive]}>
            {isFollowing ? 'Takibi Bırak' : 'Takip Et'}
          </Text>
        </Pressable>
      </View>
      <Text style={styles.subtitle}>{faculty}</Text>
      {total > 0 && <Text style={styles.count}>{total} not bulundu</Text>}
    </View>
  );

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#1d4ed8" />
      </View>
    );
  }

  if (isError) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Notlar yüklenemedi.</Text>
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
      onEndReachedThreshold={0.4}
      onEndReached={() => {
        if (hasNextPage && !isFetchingNextPage) fetchNextPage();
      }}
      ListFooterComponent={
        isFetchingNextPage ? <ActivityIndicator style={{ marginVertical: 16 }} color="#1d4ed8" /> : null
      }
      ListEmptyComponent={
        <View style={styles.center}>
          <Text style={styles.errorText}>Bu bölüm için henüz not paylaşılmamış.</Text>
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  list: { flex: 1, backgroundColor: '#f9fafb' },
  listContent: { padding: 12, flexGrow: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  errorText: { color: '#6b7280', fontSize: 14 },
  header: { paddingHorizontal: 4, paddingBottom: 14 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  title: { fontSize: 21, fontWeight: '700', color: '#111827', flexShrink: 1 },
  subtitle: { fontSize: 13.5, color: '#6b7280', marginTop: 4 },
  count: { fontSize: 12, color: '#9ca3af', marginTop: 2 },
  followBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#2F5755',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  followBtnActive: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#2F5755' },
  followBtnText: { color: '#fff', fontSize: 12.5, fontWeight: '600' },
  followBtnTextActive: { color: '#2F5755' },
});
