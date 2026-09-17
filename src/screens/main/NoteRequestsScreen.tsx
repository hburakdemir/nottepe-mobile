import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, ScrollView, Text, View } from 'react-native';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, HeartHandshake, Inbox, Plus, Upload, User } from 'lucide-react-native';
import { noteRequestAPI } from '../../lib/api';
import { faculties, departments } from '../../data/departments';
import { Skeleton, SkeletonGroup } from '../../components/Skeleton';
import RequestCard, { type NoteRequest } from '../../components/requests/RequestCard';
import CreateRequestModal from '../../components/requests/CreateRequestModal';
import FulfillModal from '../../components/requests/FulfillModal';
import { useTheme } from '../../context/ThemeContext';
import OptionSheet from '../../components/layout/OptionSheet';

const PAGE_LIMIT = 10;

type ViewMode = 'board' | 'mine';
type Status = 'open' | 'fulfilled';
type Sort = 'new' | 'top';

const NOTE_REQUESTS_STALE_MS = 60 * 1000;

const MINE_KEY = ['noteRequests', 'mine'] as const;

interface BoardPage {
  requests: NoteRequest[];
  total: number;
}

const EMPTY_REQUESTS: NoteRequest[] = [];

export default function NoteRequestsScreen() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [view, setView] = useState<ViewMode>('board');
  const [status, setStatus] = useState<Status>('open');
  const [sort, setSort] = useState<Sort>('new');
  const [faculty, setFaculty] = useState('');
  const [department, setDepartment] = useState('');
  const [showFacultyPicker, setShowFacultyPicker] = useState(false);
  const [showDeptPicker, setShowDeptPicker] = useState(false);

  const [showCreate, setShowCreate] = useState(false);
  const [fulfillTarget, setFulfillTarget] = useState<NoteRequest | null>(null);
  const queryClient = useQueryClient();

  // BÜTÜN FİLTRELER ANAHTARIN PARÇASI. Kazanç burada çok somut: kullanıcı
  // "açık"tan "kapalı"ya geçip geri döndüğünde, ya da bir fakülte seçip
  // temizlediğinde, her kombinasyon kendi cache'inde duruyor — eskiden her
  // dokunuş listeyi boşaltıp sıfırdan istek atıyordu.
  const boardKey = useMemo(
    () => ['noteRequests', 'board', { faculty, department, status, sort }] as const,
    [faculty, department, status, sort]
  );

  const board = useInfiniteQuery({
    queryKey: boardKey,
    queryFn: async ({ pageParam }) => {
      const res = await noteRequestAPI.getAll({ page: pageParam, limit: PAGE_LIMIT, faculty, department, status, sort });
      return res.data as BoardPage;
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => {
      const loaded = allPages.reduce((sum, p) => sum + p.requests.length, 0);
      return loaded < lastPage.total ? allPages.length + 1 : undefined;
    },
    enabled: view === 'board',
    staleTime: NOTE_REQUESTS_STALE_MS,
  });

  const mine = useQuery({
    queryKey: MINE_KEY,
    queryFn: async () => {
      const res = await noteRequestAPI.getMine();
      return (res.data.requests || []) as NoteRequest[];
    },
    enabled: view === 'mine',
    staleTime: NOTE_REQUESTS_STALE_MS,
  });

  const boardRequests = useMemo(() => board.data?.pages.flatMap((p) => p.requests) ?? EMPTY_REQUESTS, [board.data]);
  const requests = view === 'mine' ? mine.data ?? EMPTY_REQUESTS : boardRequests;
  const loading = view === 'mine' ? mine.isLoading : board.isLoading;

  // Kapatma/açma/silme sonrası: iki liste de bayatlıyor (kapatılan istek
  // panodan düşer, "benimkiler"de durumu değişir), o yüzden ikisi birden
  // geçersiz kılınıyor. `noteRequests` ön ekiyle eşleşen tüm filtre
  // kombinasyonları da dahil — kullanıcı filtreyi değiştirdiğinde eski
  // sonucu görmesin.
  const refresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['noteRequests'] });
  }, [queryClient]);

  const handleClose = async (request: NoteRequest) => {
    try {
      await noteRequestAPI.close(request.id);
      refresh();
    } catch (err: any) {
      Alert.alert('Hata', err.response?.data?.message || 'Kapatılamadı');
    }
  };

  const handleReopen = async (request: NoteRequest) => {
    try {
      await noteRequestAPI.reopen(request.id);
      refresh();
    } catch (err: any) {
      Alert.alert('Hata', err.response?.data?.message || 'Yeniden açılamadı');
    }
  };

  const handleDelete = (request: NoteRequest) => {
    Alert.alert('İsteği sil', 'Bu isteği silmek istediğine emin misin?', [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: async () => {
          try {
            await noteRequestAPI.delete(request.id);
            refresh();
          } catch (err: any) {
            Alert.alert('Hata', err.response?.data?.message || 'Silinemedi');
          }
        },
      },
    ]);
  };

  const handleSupport = async (request: NoteRequest) => {
    try {
      const res = request.supported_by_me ? await noteRequestAPI.unsupport(request.id) : await noteRequestAPI.support(request.id);
      const { supporter_count, supported_by_me } = res.data;
      // Destek sayacı iyimser güncelleniyor: hangi listedeysek onun cache'ine
      // yazıyoruz, böylece yeniden istek atmadan sayı anında değişiyor.
      const mapRow = (r: NoteRequest) => (r.id === request.id ? { ...r, supporter_count, supported_by_me } : r);
      queryClient.setQueryData(MINE_KEY, (prev: NoteRequest[] | undefined) => prev?.map(mapRow));
      queryClient.setQueryData(boardKey, (prev: { pages: BoardPage[]; pageParams: unknown[] } | undefined) =>
        prev ? { ...prev, pages: prev.pages.map((pg) => ({ ...pg, requests: pg.requests.map(mapRow) })) } : prev
      );
    } catch (err: any) {
      Alert.alert('Hata', err.response?.data?.message || 'İşlem başarısız');
    }
  };

  const hasMore = view === 'board' && !!board.hasNextPage;

  const header = (
    <View className="mb-4">
      {/* Ekran içi "Not İstekleri" başlığı ve alt yazısı kaldırıldı — üst bar
          zaten sayfa adını yazıyor. Kapsayıcı buton + sekmeler için kaldı. */}
      <Pressable
        className="flex-row items-center justify-center gap-2 bg-brand rounded-lg px-5 py-2.5 self-start"
        onPress={() => setShowCreate(true)}
      >
        <Plus size={18} color="#fff" />
        <Text className="text-white text-[15px] font-bold">İstek Oluştur</Text>
      </Pressable>

      <ScrollView showsVerticalScrollIndicator={false} horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 14 }}>
        <View className="flex-row gap-2">
          {[
            { value: 'open' as const, label: 'Açık İstekler' },
            { value: 'fulfilled' as const, label: 'Karşılananlar' },
          ].map((t) => {
            const active = view === 'board' && status === t.value;
            return (
              <Pressable
                key={t.value}
                className={`rounded-lg px-4 py-2 mr-2 ${active ? 'bg-brand' : 'bg-inset'}`}
                onPress={() => {
                  setView('board');
                  setStatus(t.value);
                }}
              >
                <Text className={`text-sm font-semibold ${active ? 'text-white' : 'text-muted'}`}>{t.label}</Text>
              </Pressable>
            );
          })}
          <Pressable className={`rounded-lg px-4 py-2 mr-2 ${view === 'mine' ? 'bg-brand' : 'bg-inset'}`} onPress={() => setView('mine')}>
            <Text className={`text-sm font-semibold ${view === 'mine' ? 'text-white' : 'text-muted'}`}>İsteklerim</Text>
          </Pressable>
        </View>
      </ScrollView>

      {view === 'board' && (
        <>
          <View className="flex-row gap-1 mt-3 bg-inset rounded-lg p-1 self-end">
            {[
              { value: 'new' as const, label: 'En Yeni' },
              { value: 'top' as const, label: 'En Çok İstenen' },
            ].map((s) => {
              const active = sort === s.value;
              return (
                <Pressable
                  key={s.value}
                  className="px-3 py-1.5 rounded-md"
                  style={active ? (isDark ? SHADOW_SM_DARK : SHADOW_SM) : undefined}
                  onPress={() => setSort(s.value)}
                >
                  <Text className={`text-xs font-semibold ${active ? 'text-accent' : 'text-muted'}`}>{s.label}</Text>
                </Pressable>
              );
            })}
          </View>

          <View className="flex-col gap-3 mt-4 bg-surface rounded-lg p-4" style={SHADOW_MD}>
            <Pressable
              className="flex-row items-center justify-between bg-inset border border-line rounded-lg px-4 py-2.5"
              onPress={() => setShowFacultyPicker(true)}
            >
              <Text className={`text-sm flex-shrink ${faculty ? 'text-ink' : 'text-muted2'}`} numberOfLines={1}>
                {faculty || 'Tüm Fakülteler'}
              </Text>
              <ChevronDown size={16} color={isDark ? '#9ca3af' : '#6b7280'} />
            </Pressable>
            <Pressable
              className={`flex-row items-center justify-between bg-inset border border-line rounded-lg px-4 py-2.5 ${!faculty ? 'opacity-50' : ''}`}
              onPress={() => faculty && setShowDeptPicker(true)}
            >
              <Text className={`text-sm flex-shrink ${department ? 'text-ink' : 'text-muted2'}`} numberOfLines={1}>
                {department || 'Tüm Bölümler'}
              </Text>
              <ChevronDown size={16} color={isDark ? '#9ca3af' : '#6b7280'} />
            </Pressable>
          </View>
        </>
      )}
    </View>
  );

  const renderItem = useCallback(
    ({ item }: { item: NoteRequest }) => (
      <RequestCard
        request={item}
        onFulfill={setFulfillTarget}
        onSupport={handleSupport}
        onClose={handleClose}
        onReopen={handleReopen}
        onDelete={handleDelete}
      />
    ),
    [setFulfillTarget, handleSupport, handleClose, handleReopen, handleDelete]
  );

  return (
    <View className="flex-1 bg-ground">
      {loading ? (
        // İskelet gerçek sayfanın aynısı: üstteki oluştur/sekme/sıralama/filtre
        // bloğu (hepsi sabit, olduğu gibi duruyor) ve altında `RequestCard`
        // yerleşimi — çipler ÜSTTE, eylem butonları ALTTA.
        //
        // Eskiden sıra tersti (başlık → meta → iki küçük rozet) ve üst blok hiç
        // yer tutmuyordu; veri gelince liste birden aşağı kayıyordu.
        <SkeletonGroup>
          <View className="p-4">
            {header}
            {[0, 1].map((i) => (
              <View key={i} className="bg-surface rounded-lg p-4 mb-4" style={SHADOW_MD}>
                <View className="flex-row flex-wrap gap-1.5 mb-2">
                  <Skeleton width={52} height={20} radius={100} />
                  <Skeleton width={44} height={20} radius={100} />
                  <Skeleton width={62} height={20} radius={100} />
                  {i === 0 && <Skeleton width={96} height={20} radius={100} />}
                </View>
                <Skeleton width={i === 0 ? '72%' : '60%'} height={17} />
                <View className="gap-1.5 mt-2 mb-3">
                  <Skeleton width="100%" height={14} />
                  {i === 0 && <Skeleton width="70%" height={14} />}
                </View>
                <View className="flex-row items-center gap-[5px] mb-3.5">
                  <User size={12} color={isDark ? '#4b5563' : '#d1d5db'} />
                  <Skeleton width={158} height={12} />
                </View>
                {/* Eylem butonları sabit: ikon + değişmeyen etiket. */}
                <View className="flex-row flex-wrap gap-2">
                  <View className="flex-row items-center gap-1.5 bg-brand rounded-lg px-3.5 py-[9px]">
                    <HeartHandshake size={14} color="#fff" />
                    <Text className="text-white text-[13px] font-semibold">Karşıla</Text>
                  </View>
                  <View className="flex-row items-center gap-1.5 border border-accent rounded-lg px-3.5 py-[9px]">
                    <Upload size={15} color={isDark ? '#5A9690' : '#2F5755'} />
                    <Text className="text-accent text-[13px] font-semibold">Not Yükle</Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        </SkeletonGroup>
      ) : (
        <FlatList
          showsVerticalScrollIndicator={false}
          contentContainerClassName="p-4 pb-[150px]"
          data={requests}
          keyExtractor={(item) => String(item.id)}
          // `removeClippedSubviews` KALDIRILDI (1.0.15) — gerekçe HomeScreen.tsx.
          maxToRenderPerBatch={6}
          windowSize={7}
          initialNumToRender={6}
          ListHeaderComponent={header}
          renderItem={renderItem}
          ListEmptyComponent={
            <View className="items-center bg-surface rounded-lg py-12 gap-4" style={SHADOW_MD}>
              <Inbox size={64} color={isDark ? '#6b7280' : '#9ca3af'} />
              <Text className="text-muted text-lg">{view === 'mine' ? 'Henüz istek oluşturmadın.' : 'Bu filtrede istek bulunamadı.'}</Text>
            </View>
          }
          ListFooterComponent={
            hasMore ? (
              <Pressable
                className="items-center border border-brand rounded-lg py-2.5 mt-2"
                onPress={() => board.fetchNextPage()}
                disabled={board.isFetchingNextPage}
              >
                {board.isFetchingNextPage ? (
                  <ActivityIndicator color="#2F5755" />
                ) : (
                  <Text className="text-accent text-[13px] font-semibold">Daha Fazla Göster</Text>
                )}
              </Pressable>
            ) : null
          }
        />
      )}

      {showCreate && <CreateRequestModal onClose={() => setShowCreate(false)} onCreated={refresh} />}
      {fulfillTarget && <FulfillModal request={fulfillTarget} onClose={() => setFulfillTarget(null)} onFulfilled={refresh} />}

      <OptionSheet
        visible={showFacultyPicker}
        title="Fakülte"
        options={faculties}
        value={faculty}
        allLabel="Tüm Fakülteler"
        onSelect={(f) => {
          setFaculty(f);
          setDepartment('');
        }}
        onClose={() => setShowFacultyPicker(false)}
      />

      <OptionSheet
        visible={showDeptPicker}
        title="Bölüm"
        options={departments[faculty] || []}
        value={department}
        allLabel="Tüm Bölümler"
        onSelect={setDepartment}
        onClose={() => setShowDeptPicker(false)}
      />
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
  backgroundColor: '#fff',
  shadowColor: '#000',
  shadowOpacity: 0.06,
  shadowRadius: 2,
  shadowOffset: { width: 0, height: 1 },
  elevation: 1,
};

const SHADOW_SM_DARK = {
  ...SHADOW_SM,
  backgroundColor: '#222831',
};
