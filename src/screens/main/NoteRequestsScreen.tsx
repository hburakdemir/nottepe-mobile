import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, ScrollView, Text, View } from 'react-native';
import { ChevronDown, Inbox, Plus } from 'lucide-react-native';
import { noteRequestAPI } from '../../lib/api';
import { faculties, departments } from '../../data/departments';
import RequestCard, { type NoteRequest } from '../../components/requests/RequestCard';
import CreateRequestModal from '../../components/requests/CreateRequestModal';
import FulfillModal from '../../components/requests/FulfillModal';
import { useTheme } from '../../context/ThemeContext';
import OptionSheet from '../../components/layout/OptionSheet';

const PAGE_LIMIT = 10;

type ViewMode = 'board' | 'mine';
type Status = 'open' | 'fulfilled';
type Sort = 'new' | 'top';

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

  const [requests, setRequests] = useState<NoteRequest[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const [showCreate, setShowCreate] = useState(false);
  const [fulfillTarget, setFulfillTarget] = useState<NoteRequest | null>(null);

  const fetchBoard = useCallback(
    async (pageToFetch: number, reset = false) => {
      if (reset) setLoading(true);
      else setLoadingMore(true);
      try {
        const res = await noteRequestAPI.getAll({ page: pageToFetch, limit: PAGE_LIMIT, faculty, department, status, sort });
        const { requests: rows, total: newTotal } = res.data;
        setRequests((prev) => (reset ? rows : [...prev, ...rows]));
        setTotal(newTotal);
        setPage(pageToFetch);
      } catch {
        Alert.alert('Hata', 'İstekler yüklenemedi');
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [faculty, department, status, sort]
  );

  const fetchMine = useCallback(async () => {
    setLoading(true);
    try {
      const res = await noteRequestAPI.getMine();
      setRequests(res.data.requests || []);
      setTotal((res.data.requests || []).length);
    } catch {
      Alert.alert('Hata', 'İsteklerin yüklenemedi');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (view === 'mine') fetchMine();
    else fetchBoard(1, true);
  }, [view, fetchBoard, fetchMine]);

  const refresh = () => (view === 'mine' ? fetchMine() : fetchBoard(1, true));

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
      setRequests((prev) => prev.map((r) => (r.id === request.id ? { ...r, supporter_count, supported_by_me } : r)));
    } catch (err: any) {
      Alert.alert('Hata', err.response?.data?.message || 'İşlem başarısız');
    }
  };

  const hasMore = view === 'board' && requests.length < total;

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
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#2F5755" />
        </View>
      ) : (
        <FlatList
          showsVerticalScrollIndicator={false}
          contentContainerClassName="p-4 pb-[110px]"
          data={requests}
          keyExtractor={(item) => String(item.id)}
          removeClippedSubviews
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
                onPress={() => fetchBoard(page + 1)}
                disabled={loadingMore}
              >
                {loadingMore ? (
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
