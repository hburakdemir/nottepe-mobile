import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ArrowRight, ChevronDown, HeartHandshake, Search, X } from 'lucide-react-native';
import { noteRequestAPI, postsAPI } from '../../lib/api';
import PostCard from '../../components/PostCard';
import ErrorState from '../../components/ErrorState';
import { faculties as ALL_FACULTIES } from '../../data/departments';
import type { RootStackParamList } from '../../navigation/types';
import type { Post } from '../../types/post';

interface PostsPage {
  posts: Post[];
  total: number;
}

export default function HomeScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [faculty, setFaculty] = useState('');
  const [showFacultyPicker, setShowFacultyPicker] = useState(false);
  const [faculties, setFaculties] = useState<string[]>(ALL_FACULTIES);
  const [openRequestCount, setOpenRequestCount] = useState<number | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    noteRequestAPI
      .getAll({ page: 1, limit: 1, status: 'open' })
      .then((res) => setOpenRequestCount(res.data?.total ?? null))
      .catch(() => {});
  }, []);

  useEffect(() => {
    postsAPI
      .getFaculties()
      .then((res) => {
        if (Array.isArray(res.data?.faculties) && res.data.faculties.length > 0) {
          setFaculties(res.data.faculties);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setSearch(searchInput), 500);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchInput]);

  const {
    data,
    isLoading,
    isError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
    isRefetching,
  } = useInfiniteQuery({
    queryKey: ['posts', search, faculty],
    queryFn: async ({ pageParam }) => {
      const res = await postsAPI.getAllPosts({ page: pageParam, search, faculty });
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
  const hasMore = posts.length < total;

  const filterBar = (
    <View>
      <Pressable style={styles.noteRequestCta} onPress={() => navigation.navigate('NoteRequests')}>
        <View style={styles.noteRequestIconWrap}>
          <HeartHandshake size={18} color="#2F5755" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.noteRequestTitle}>Not İstekleri</Text>
          <Text style={styles.noteRequestSubtitle}>Aradığın notu bulamadın mı? İste, elinde olan karşılasın.</Text>
        </View>
        <View style={styles.noteRequestLinkRow}>
          <Text style={styles.noteRequestLinkText}>
            {openRequestCount !== null && openRequestCount > 0 ? `${openRequestCount} açık istek` : 'Panoya git'}
          </Text>
          <ArrowRight size={14} color="#2F5755" />
        </View>
      </Pressable>

      <View style={styles.filterCard}>
      <Text style={styles.pageTitle}>Tüm Notlar</Text>
      <Text style={styles.pageSubtitle}>Öğrenciler tarafından paylaşılan ders notlarını inceleyin</Text>

      <View style={styles.searchRow}>
        <Search size={16} color="#4f7d7a" />
        <TextInput
          style={styles.searchInput}
          value={searchInput}
          onChangeText={setSearchInput}
          placeholder="Başlık, açıklama veya bölüm ara..."
          placeholderTextColor="#9ca3af"
        />
      </View>

      <Pressable style={styles.facultyRow} onPress={() => setShowFacultyPicker(true)}>
        <Text style={[styles.facultyText, !faculty && styles.facultyPlaceholder]}>
          {faculty || 'Tüm Fakülteler'}
        </Text>
        <ChevronDown size={16} color="#6b7280" />
      </Pressable>
      </View>
    </View>
  );

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2F5755" />
      </View>
    );
  }

  if (isError) {
    return <ErrorState message="Notlar yüklenemedi." onRetry={refetch} />;
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#f9fafb' }}>
      <FlatList
        style={styles.list}
        contentContainerStyle={styles.listContent}
        data={posts}
        keyExtractor={(item) => String(item.id ?? item.post_id)}
        renderItem={({ item }) => <PostCard post={item} />}
        ListHeaderComponent={filterBar}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
        onEndReachedThreshold={0.4}
        onEndReached={() => {
          if (hasNextPage && !isFetchingNextPage) fetchNextPage();
        }}
        ListFooterComponent={
          isFetchingNextPage ? (
            <ActivityIndicator style={{ marginVertical: 16 }} color="#2F5755" />
          ) : !hasMore && posts.length > 0 ? (
            <Text style={styles.footerText}>Tüm notlar yüklendi ({total} not)</Text>
          ) : null
        }
        ListEmptyComponent={
          <View style={styles.center}>
            <Text style={styles.errorText}>
              {search || faculty ? 'Arama sonucu bulunamadı.' : 'Henüz not paylaşılmamış.'}
            </Text>
          </View>
        }
      />

      <Modal visible={showFacultyPicker} transparent animationType="fade" onRequestClose={() => setShowFacultyPicker(false)}>
        <Pressable style={styles.overlay} onPress={() => setShowFacultyPicker(false)}>
          <View style={styles.sheet}>
            <View style={styles.sheetHeaderRow}>
              <Text style={styles.sheetTitle}>Fakülte seç</Text>
              <Pressable onPress={() => setShowFacultyPicker(false)} hitSlop={8}>
                <X size={20} color="#6b7280" />
              </Pressable>
            </View>
            <FlatList
              data={['', ...faculties]}
              keyExtractor={(item) => item || 'all'}
              renderItem={({ item }) => (
                <Pressable
                  style={styles.optionRow}
                  onPress={() => {
                    setFaculty(item);
                    setShowFacultyPicker(false);
                  }}
                >
                  <Text style={[styles.optionText, faculty === item && styles.optionTextActive]}>
                    {item || 'Tüm Fakülteler'}
                  </Text>
                </Pressable>
              )}
            />
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  list: { flex: 1 },
  listContent: { padding: 12, flexGrow: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  errorText: { color: '#6b7280', fontSize: 14 },
  noteRequestCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
  },
  noteRequestIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#2F575519',
    alignItems: 'center',
    justifyContent: 'center',
  },
  noteRequestTitle: { fontSize: 13.5, fontWeight: '700', color: '#111827' },
  noteRequestSubtitle: { fontSize: 11, color: '#6b7280', marginTop: 2 },
  noteRequestLinkRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  noteRequestLinkText: { fontSize: 11.5, fontWeight: '600', color: '#2F5755' },
  filterCard: { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 14 },
  pageTitle: { fontSize: 21, fontWeight: '800', color: '#111827' },
  pageSubtitle: { fontSize: 12.5, color: '#6b7280', marginTop: 4, marginBottom: 14 },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    paddingHorizontal: 12,
    marginBottom: 10,
  },
  searchInput: { flex: 1, paddingVertical: 10, fontSize: 13.5, color: '#111827' },
  facultyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  facultyText: { fontSize: 13.5, color: '#111827' },
  facultyPlaceholder: { color: '#6b7280' },
  footerText: { textAlign: 'center', fontSize: 12.5, color: '#9ca3af', paddingVertical: 20 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 18, borderTopRightRadius: 18, maxHeight: '70%', padding: 16 },
  sheetHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  sheetTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },
  optionRow: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  optionText: { fontSize: 14, color: '#374151' },
  optionTextActive: { color: '#2F5755', fontWeight: '700' },
});
