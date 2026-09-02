import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  Text,
  TextInput,
  View,
} from 'react-native';
import { keepPreviousData, useInfiniteQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ArrowRight, ChevronDown, HeartHandshake, Search, X } from 'lucide-react-native';
import { noteRequestAPI, postsAPI } from '../../lib/api';
import PostCard from '../../components/PostCard';
import DepartmentQuickNav from '../../components/home/DepartmentQuickNav';
import { useTheme } from '../../context/ThemeContext';
import { faculties as ALL_FACULTIES } from '../../data/departments';
import type { RootStackParamList } from '../../navigation/types';
import type { Post } from '../../types/post';

interface PostsPage {
  posts: Post[];
  total: number;
}

const SHADOW_MD = {
  shadowColor: '#000',
  shadowOpacity: 0.1,
  shadowRadius: 8,
  shadowOffset: { width: 0, height: 3 },
  elevation: 3,
};

export default function HomeScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
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
    // Arama/fakülte değişince queryKey değişiyor (search, faculty) — bu olmadan
    // react-query önceki sonuçları anında boşaltıp `isLoading`'i true yapıyor,
    // liste VE arama kutusu birlikte kocaman bir spinner'la değişiyordu. Önceki
    // sonuçlar ekranda kalırken arka planda yenisi gelince yerini alıyor artık.
    placeholderData: keepPreviousData,
  });

  const posts = useMemo(() => data?.pages.flatMap((p) => p.posts) ?? [], [data]);
  const total = data?.pages[0]?.total ?? 0;
  const hasMore = posts.length < total;

  const filterBar = (
    <View>
      <Text className="text-2xl font-extrabold text-gray-900 dark:text-darktext mb-1">Tüm Notlar</Text>
      <Text className="text-[13px] text-gray-500 dark:text-darktext mb-4">Öğrenciler tarafından paylaşılan ders notlarını inceleyin</Text>

      <DepartmentQuickNav />

      <Pressable
        className="flex-row items-center gap-3 bg-primary dark:bg-darkbgbutton rounded-lg p-3.5 mb-3 border border-gray-100 dark:border-gray-700"
        style={SHADOW_MD}
        onPress={() => navigation.navigate('NoteRequests')}
      >
        <View className="w-[38px] h-[38px] rounded-[10px] bg-brand/10 dark:bg-brand-light/20 items-center justify-center">
          <HeartHandshake size={18} color={isDark ? '#5A9690' : '#2F5755'} />
        </View>
        <View className="flex-1">
          <Text className="text-[13.5px] font-bold text-gray-900 dark:text-darktext">Not İstekleri</Text>
          <Text className="text-[11px] text-gray-500 dark:text-darktext/80 mt-0.5">Aradığın notu bulamadın mı? İste, elinde olan karşılasın.</Text>
        </View>
        <View className="flex-row items-center gap-1">
          <Text className="text-[11.5px] font-semibold text-brand dark:text-brand-light">
            {openRequestCount !== null && openRequestCount > 0 ? `${openRequestCount} açık istek` : 'Panoya git'}
          </Text>
          <ArrowRight size={14} color={isDark ? '#5A9690' : '#2F5755'} />
        </View>
      </Pressable>

      <View className="bg-primary dark:bg-darkbgbutton rounded-lg p-4 mb-3.5" style={SHADOW_MD}>
        <View className="flex-row items-center gap-2 bg-gray-50 dark:bg-darkbg border border-gray-200 dark:border-gray-600 rounded-[10px] px-3 mb-2.5">
          <Search size={16} color="#5A9690" />
          <TextInput
            className="flex-1 py-2.5 text-[13.5px] text-gray-900 dark:text-darktext"
            value={searchInput}
            onChangeText={setSearchInput}
            placeholder="Başlık, açıklama veya bölüm ara..."
            placeholderTextColor="#9ca3af"
          />
        </View>

        <Pressable
          className="flex-row items-center justify-between border border-gray-200 dark:border-gray-600 rounded-[10px] px-3 py-2.5"
          onPress={() => setShowFacultyPicker(true)}
        >
          <Text className={`text-[13.5px] ${faculty ? 'text-gray-900 dark:text-darktext' : 'text-gray-500 dark:text-gray-400'}`}>
            {faculty || 'Tüm Fakülteler'}
          </Text>
          <ChevronDown size={16} color={isDark ? '#9ca3af' : '#6b7280'} />
        </Pressable>
      </View>
    </View>
  );

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center py-16">
        <ActivityIndicator size="large" color="#2F5755" />
      </View>
    );
  }

  if (isError) {
    return (
      <View className="flex-1 items-center justify-center py-16">
        <Text className="text-gray-500 dark:text-gray-400 text-sm">Notlar yüklenemedi.</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-primary dark:bg-darkbgbutton">
      <FlatList
        className="flex-1"
        contentContainerStyle={{ padding: 12, flexGrow: 1 }}
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
            <Text className="text-center text-[12.5px] text-gray-400 dark:text-gray-500 py-5">Tüm notlar yüklendi ({total} not)</Text>
          ) : null
        }
        ListEmptyComponent={
          <View className="flex-1 items-center justify-center py-16">
            <Text className="text-gray-500 dark:text-gray-400 text-sm">
              {search || faculty ? 'Arama sonucu bulunamadı.' : 'Henüz not paylaşılmamış.'}
            </Text>
          </View>
        }
      />

      <Modal visible={showFacultyPicker} transparent animationType="fade" onRequestClose={() => setShowFacultyPicker(false)}>
        <Pressable className="flex-1 bg-black/50 justify-end" onPress={() => setShowFacultyPicker(false)}>
          <View className="bg-primary dark:bg-darkbgbutton rounded-t-[18px] max-h-[70%] p-4">
            <View className="flex-row items-center justify-between mb-2">
              <Text className="text-base font-bold text-gray-900 dark:text-darktext">Fakülte seç</Text>
              <Pressable onPress={() => setShowFacultyPicker(false)} hitSlop={8}>
                <X size={20} color={isDark ? '#9ca3af' : '#6b7280'} />
              </Pressable>
            </View>
            <FlatList
              data={['', ...faculties]}
              keyExtractor={(item) => item || 'all'}
              renderItem={({ item }) => (
                <Pressable
                  className="py-3 border-b border-gray-100 dark:border-gray-700/40"
                  onPress={() => {
                    setFaculty(item);
                    setShowFacultyPicker(false);
                  }}
                >
                  <Text className={`text-sm ${faculty === item ? 'text-brand dark:text-brand-light font-bold' : 'text-gray-700 dark:text-darktext'}`}>
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
