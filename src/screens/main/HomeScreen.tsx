import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, Text, TextInput, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { keepPreviousData, useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ChevronDown, GraduationCap, HeartHandshake, Search, X } from 'lucide-react-native';
import { noteRequestAPI, postsAPI } from '../../lib/api';
import PostCard from '../../components/PostCard';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useCardSurface, useFeedTokens } from '../../theme/feedTokens';
import { faculties as ALL_FACULTIES, departments as DEPARTMENTS_BY_FACULTY } from '../../data/departments';
import type { RootStackParamList } from '../../navigation/types';
import type { Post } from '../../types/post';
import { TAB_BAR_SAFE_PADDING } from '../../components/layout/tabBarMetrics';
import OptionSheet from '../../components/layout/OptionSheet';
import StateView from '../../components/StateView';

const LAST_FACULTY_KEY = 'nottepe_last_faculty';

interface PostsPage {
  posts: Post[];
  total: number;
}

export default function HomeScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user } = useAuth();
  const { colors } = useTheme();
  // Kartlar kalktı, satırlar tek zemin üstünde ince çizgiyle ayrılıyor
  // (bkz. theme/feedTokens.ts + PostCardModern) — liste artık kenardan kenara.
  const t = useFeedTokens();
  const cardSurface = useCardSurface();
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [faculty, setFaculty] = useState('');
  const [showFacultyPicker, setShowFacultyPicker] = useState(false);
  // "Bölümüne Git" karesinin iki adımlı seçimi + en son seçilen fakülte
  // (AsyncStorage'da saklanıyor, kare üzerinde ipucu olarak gösteriliyor).
  const [showDeptFacultyPicker, setShowDeptFacultyPicker] = useState(false);
  const [pendingFaculty, setPendingFaculty] = useState<string | null>(null);
  const [lastFaculty, setLastFaculty] = useState('');
  const [faculties, setFaculties] = useState<string[]>(ALL_FACULTIES);
  const [openRequestCount, setOpenRequestCount] = useState<number | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(LAST_FACULTY_KEY)
      .then((v) => {
        if (v) setLastFaculty(v);
      })
      .catch(() => {});
  }, []);

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

  const queryClient = useQueryClient();
  const queryKey = useMemo(() => ['posts', search, faculty] as const, [search, faculty]);
  const { data, isLoading, isError, fetchNextPage, hasNextPage, isFetchingNextPage, refetch } = useInfiniteQuery({
    queryKey,
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
    // 1 dakika içinde tekrar odaklanmak ağa hiç gitmesin — bkz. aşağıdaki
    // focus efekti.
    staleTime: 60_000,
  });

  // Yalnızca kullanıcının elle aşağı ÇEKMESİ pull-to-refresh spinner'ını
  // döndürür. Eskiden `RefreshControl.refreshing` doğrudan `isRefetching`'e
  // bağlıydı; aşağıdaki odak efekti her `refetch()` çağırdığında (yani HER
  // ana sayfaya dönüşte) üstte spinner beliriyordu — "ana sayfaya her
  // dönüşte tekrar üstte loading dönüyor" şikâyeti buydu.
  const [isManualRefresh, setIsManualRefresh] = useState(false);
  const handleManualRefresh = useCallback(() => {
    setIsManualRefresh(true);
    refetch().finally(() => setIsManualRefresh(false));
  }, [refetch]);

  // Gönderi detayına girip yorum/oy ekleyip geri dönünce bu ekran YENİDEN
  // MOUNT OLMUYOR (Tab.Navigator sekmeleri mount'lu tutuyor, bkz.
  // MainTabsScreen.tsx). Veri hâlâ `staleTime` içindeyse (son 1 dk) hiç istek
  // atılmıyor; bayatladıysa sessizce (görünür spinner olmadan — RefreshControl
  // artık `isManualRefresh`'e bağlı) arka planda tazeleniyor.
  const didFocusOnceRef = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (!didFocusOnceRef.current) {
        didFocusOnceRef.current = true;
        return;
      }
      const state = queryClient.getQueryState(queryKey);
      const isStale = !state || Date.now() - state.dataUpdatedAt > 60_000;
      if (isStale) refetch();
    }, [queryClient, queryKey, refetch])
  );

  const posts = useMemo(() => data?.pages.flatMap((p) => p.posts) ?? [], [data]);
  const total = data?.pages[0]?.total ?? 0;
  const hasMore = posts.length < total;

  // Ana sayfa başlığı yeniden kurgulandı (kullanıcı isteği): EN ÜSTTE arama,
  // hemen altında yan yana iki kare kısayol — "Bölümüne Git" ve "Not İstekleri".
  // Önceki düzende arama en alttaydı, üstünde açılır-kapanır bir bölüm seçici
  // (DepartmentQuickNav) ve tam genişlikte bir istek şeridi vardı.
  const filterBar = (
    <View style={{ paddingHorizontal: 12, paddingTop: 12 }}>
      <View className="p-3.5 mb-3" style={[cardSurface, { borderRadius: 16 }]}>
        <View className="flex-row items-center gap-2 bg-inset border border-line rounded-[10px] px-3">
          <Search size={16} color={colors.accent} />
          <TextInput
            className="flex-1 py-2.5 text-[13.5px] text-ink"
            value={searchInput}
            onChangeText={setSearchInput}
            placeholder="Başlık, açıklama veya bölüm ara..."
            placeholderTextColor={colors.muted2}
          />
          {!!searchInput && (
            <Pressable onPress={() => setSearchInput('')} hitSlop={8} accessibilityLabel="Aramayı temizle">
              <X size={15} color={colors.muted2} />
            </Pressable>
          )}
        </View>

        <Pressable
          className="flex-row items-center justify-between border border-line rounded-[10px] px-3 py-2.5 mt-2.5"
          onPress={() => setShowFacultyPicker(true)}
        >
          <Text className={`text-[13.5px] ${faculty ? 'text-ink' : 'text-muted'}`}>{faculty || 'Tüm Fakülteler'}</Text>
          <ChevronDown size={16} color={colors.muted} />
        </Pressable>
      </View>

      {/* İki kare: eşit genişlikte (flex-1) ve sabit yükseklikte, yani her
          ekran genişliğinde yan yana sığıyorlar. */}
      <View className="flex-row gap-3 mb-1">
        <Pressable
          className="flex-1 p-3.5 justify-between"
          style={[cardSurface, { borderRadius: 16, height: 124 }]}
          onPress={() => {
            // Kullanıcının kendi bölümü profilde ayarlıysa seçim adımlarını
            // atlayıp doğrudan oraya götürüyoruz — fakülte/bölüm seçmek zaten
            // kendi bölümünü aramaktan başka bir şey değil.
            if (user?.faculty && user?.department) {
              navigation.navigate('DepartmentDetail', { faculty: user.faculty, department: user.department });
            } else {
              setShowDeptFacultyPicker(true);
            }
          }}
        >
          <View className="w-[38px] h-[38px] rounded-[10px] bg-accent-soft items-center justify-center">
            <GraduationCap size={19} color={colors.accent} />
          </View>
          <View>
            <Text className="text-[13.5px] font-bold text-ink">Bölümüne Git</Text>
            {/* Sabit yükseklik: iki karenin açıklaması farklı satır sayısında
                olsa da başlıkları aynı hizada kalıyor. */}
            <Text className="text-[11px] text-muted mt-0.5" numberOfLines={2} style={{ height: 30 }}>
              {user?.department ? user.department : lastFaculty ? lastFaculty : 'Fakülteni seç, bölüm notlarına atla.'}
            </Text>
          </View>
        </Pressable>

        <Pressable
          className="flex-1 p-3.5 justify-between"
          style={[cardSurface, { borderRadius: 16, height: 124 }]}
          onPress={() => navigation.navigate('NoteRequests')}
        >
          <View className="w-[38px] h-[38px] rounded-[10px] bg-accent-soft items-center justify-center">
            <HeartHandshake size={19} color={colors.accent} />
          </View>
          <View>
            <Text className="text-[13.5px] font-bold text-ink">Not İstekleri</Text>
            <Text className="text-[11px] text-muted mt-0.5" numberOfLines={2} style={{ height: 30 }}>
              {openRequestCount !== null && openRequestCount > 0 ? `${openRequestCount} açık istek` : 'İste, elinde olan karşılasın.'}
            </Text>
          </View>
        </Pressable>
      </View>
    </View>
  );

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center py-16">
        <StateView kind="loading" loadingColor="#2F5755" />
      </View>
    );
  }

  if (isError) {
    return (
      <View className="flex-1 items-center justify-center py-16">
        <StateView kind="error" title="Notlar yüklenemedi." onAction={() => refetch()} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: t.ground }}>
      <FlatList
        showsVerticalScrollIndicator={false}
        className="flex-1"
        contentContainerStyle={{ paddingBottom: TAB_BAR_SAFE_PADDING, flexGrow: 1 }}
        data={posts}
        keyExtractor={(item) => String(item.id ?? item.post_id)}
        renderItem={({ item }) => <PostCard post={item} />}
        ListHeaderComponent={filterBar}
        refreshControl={<RefreshControl refreshing={isManualRefresh} onRefresh={handleManualRefresh} />}
        onEndReachedThreshold={0.4}
        onEndReached={() => {
          if (hasNextPage && !isFetchingNextPage) fetchNextPage();
        }}
        ListFooterComponent={
          isFetchingNextPage ? (
            <ActivityIndicator style={{ marginVertical: 16 }} color="#2F5755" />
          ) : !hasMore && posts.length > 0 ? (
            <Text className="text-center text-[12.5px] text-muted2 py-5">Tüm notlar yüklendi ({total} not)</Text>
          ) : null
        }
        ListEmptyComponent={
          <View className="flex-1 items-center justify-center py-16">
            <Text className="text-muted text-sm">{search || faculty ? 'Arama sonucu bulunamadı.' : 'Henüz not paylaşılmamış.'}</Text>
          </View>
        }
      />

      <OptionSheet
        visible={showFacultyPicker}
        title="Fakülte seç"
        options={faculties}
        value={faculty}
        allLabel="Tüm Fakülteler"
        onSelect={setFaculty}
        onClose={() => setShowFacultyPicker(false)}
      />

      {/* "Bölümüne Git" iki adım: önce fakülte, sonra o fakültenin bölümü —
          ikisi de aynı OptionSheet. */}
      <OptionSheet
        visible={showDeptFacultyPicker}
        title="Fakülteni seç"
        options={ALL_FACULTIES}
        value={lastFaculty}
        onSelect={(f) => {
          setLastFaculty(f);
          AsyncStorage.setItem(LAST_FACULTY_KEY, f).catch(() => {});
          setPendingFaculty(f);
        }}
        onClose={() => setShowDeptFacultyPicker(false)}
      />

      <OptionSheet
        visible={!!pendingFaculty}
        title={pendingFaculty || 'Bölüm seç'}
        options={pendingFaculty ? DEPARTMENTS_BY_FACULTY[pendingFaculty] || [] : []}
        onSelect={(department) => {
          const f = pendingFaculty;
          setPendingFaculty(null);
          if (f && department) navigation.navigate('DepartmentDetail', { faculty: f, department });
        }}
        onClose={() => setPendingFaculty(null)}
        emptyText="Bu fakülte için bölüm bulunamadı"
      />
    </View>
  );
}
