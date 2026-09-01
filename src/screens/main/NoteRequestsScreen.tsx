import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { ChevronDown, HeartHandshake, Inbox, Plus, X } from 'lucide-react-native';
import { noteRequestAPI } from '../../lib/api';
import { faculties, departments } from '../../data/departments';
import RequestCard, { type NoteRequest } from '../../components/requests/RequestCard';
import CreateRequestModal from '../../components/requests/CreateRequestModal';
import FulfillModal from '../../components/requests/FulfillModal';

const PAGE_LIMIT = 10;

type ViewMode = 'board' | 'mine';
type Status = 'open' | 'fulfilled';
type Sort = 'new' | 'top';

export default function NoteRequestsScreen() {
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
      <View className="flex-row items-center gap-2.5">
        <HeartHandshake size={32} color="#2F5755" />
        <Text className="text-3xl font-bold text-gray-900">Not İstekleri</Text>
      </View>
      <Text className="text-base text-gray-600 mt-2">Aradığın notu bulamadın mı? İste — elinde olan varsa karşılasın.</Text>

      <Pressable className="flex-row items-center justify-center gap-2 bg-brand rounded-lg px-5 py-2.5 mt-4 self-start" onPress={() => setShowCreate(true)}>
        <Plus size={18} color="#fff" />
        <Text className="text-white text-[15px] font-bold">İstek Oluştur</Text>
      </Pressable>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 14 }}>
        <View className="flex-row gap-2">
          {[
            { value: 'open' as const, label: 'Açık İstekler' },
            { value: 'fulfilled' as const, label: 'Karşılananlar' },
          ].map((t) => {
            const active = view === 'board' && status === t.value;
            return (
              <Pressable
                key={t.value}
                className={`rounded-lg px-4 py-2 mr-2 ${active ? 'bg-brand' : 'bg-gray-100'}`}
                onPress={() => {
                  setView('board');
                  setStatus(t.value);
                }}
              >
                <Text className={`text-sm font-semibold ${active ? 'text-white' : 'text-gray-600'}`}>{t.label}</Text>
              </Pressable>
            );
          })}
          <Pressable className={`rounded-lg px-4 py-2 mr-2 ${view === 'mine' ? 'bg-brand' : 'bg-gray-100'}`} onPress={() => setView('mine')}>
            <Text className={`text-sm font-semibold ${view === 'mine' ? 'text-white' : 'text-gray-600'}`}>İsteklerim</Text>
          </Pressable>
        </View>
      </ScrollView>

      {view === 'board' && (
        <>
          <View className="flex-row gap-1 mt-3 bg-gray-100 rounded-lg p-1 self-end">
            {[
              { value: 'new' as const, label: 'En Yeni' },
              { value: 'top' as const, label: 'En Çok İstenen' },
            ].map((s) => {
              const active = sort === s.value;
              return (
                <Pressable
                  key={s.value}
                  className="px-3 py-1.5 rounded-md"
                  style={active ? SHADOW_SM : undefined}
                  onPress={() => setSort(s.value)}
                >
                  <Text className={`text-xs font-semibold ${active ? 'text-brand' : 'text-gray-500'}`}>{s.label}</Text>
                </Pressable>
              );
            })}
          </View>

          <View className="flex-col gap-3 mt-4 bg-white rounded-lg p-4" style={SHADOW_MD}>
            <Pressable className="flex-row items-center justify-between bg-white border border-gray-300 rounded-lg px-4 py-2.5" onPress={() => setShowFacultyPicker(true)}>
              <Text className={`text-sm flex-shrink ${faculty ? 'text-gray-900' : 'text-gray-400'}`} numberOfLines={1}>
                {faculty || 'Tüm Fakülteler'}
              </Text>
              <ChevronDown size={16} color="#6b7280" />
            </Pressable>
            <Pressable
              className={`flex-row items-center justify-between bg-white border border-gray-300 rounded-lg px-4 py-2.5 ${!faculty ? 'opacity-50' : ''}`}
              onPress={() => faculty && setShowDeptPicker(true)}
            >
              <Text className={`text-sm flex-shrink ${department ? 'text-gray-900' : 'text-gray-400'}`} numberOfLines={1}>
                {department || 'Tüm Bölümler'}
              </Text>
              <ChevronDown size={16} color="#6b7280" />
            </Pressable>
          </View>
        </>
      )}
    </View>
  );

  return (
    <View className="flex-1 bg-primary">
      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#2F5755" />
        </View>
      ) : (
        <FlatList
          contentContainerClassName="p-4 pb-10"
          data={requests}
          keyExtractor={(item) => String(item.id)}
          ListHeaderComponent={header}
          renderItem={({ item }) => (
            <RequestCard
              request={item}
              onFulfill={setFulfillTarget}
              onSupport={handleSupport}
              onClose={handleClose}
              onReopen={handleReopen}
              onDelete={handleDelete}
            />
          )}
          ListEmptyComponent={
            <View className="items-center bg-white rounded-lg py-12 gap-4" style={SHADOW_MD}>
              <Inbox size={64} color="#9ca3af" />
              <Text className="text-gray-500 text-lg">{view === 'mine' ? 'Henüz istek oluşturmadın.' : 'Bu filtrede istek bulunamadı.'}</Text>
            </View>
          }
          ListFooterComponent={
            hasMore ? (
              <Pressable className="items-center border border-brand rounded-lg py-2.5 mt-2" onPress={() => fetchBoard(page + 1)} disabled={loadingMore}>
                {loadingMore ? <ActivityIndicator color="#2F5755" /> : <Text className="text-brand text-[13px] font-semibold">Daha Fazla Göster</Text>}
              </Pressable>
            ) : null
          }
        />
      )}

      {showCreate && <CreateRequestModal onClose={() => setShowCreate(false)} onCreated={refresh} />}
      {fulfillTarget && <FulfillModal request={fulfillTarget} onClose={() => setFulfillTarget(null)} onFulfilled={refresh} />}

      <Modal visible={showFacultyPicker} transparent animationType="slide" onRequestClose={() => setShowFacultyPicker(false)}>
        <Pressable className="flex-1 bg-black/40 justify-end" onPress={() => setShowFacultyPicker(false)}>
          <View className="bg-white rounded-t-2xl p-4 max-h-[75%]">
            <View className="flex-row items-center justify-between mb-2.5">
              <Text className="text-[15px] font-bold text-gray-900">Fakülte</Text>
              <Pressable onPress={() => setShowFacultyPicker(false)} hitSlop={8}>
                <X size={20} color="#6b7280" />
              </Pressable>
            </View>
            <ScrollView>
              <Pressable
                className="py-3 border-b border-gray-100"
                onPress={() => {
                  setFaculty('');
                  setDepartment('');
                  setShowFacultyPicker(false);
                }}
              >
                <Text className="text-sm text-gray-700">Tüm Fakülteler</Text>
              </Pressable>
              {faculties.map((f) => (
                <Pressable
                  key={f}
                  className="py-3 border-b border-gray-100"
                  onPress={() => {
                    setFaculty(f);
                    setDepartment('');
                    setShowFacultyPicker(false);
                  }}
                >
                  <Text className="text-sm text-gray-700">{f}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>

      <Modal visible={showDeptPicker} transparent animationType="slide" onRequestClose={() => setShowDeptPicker(false)}>
        <Pressable className="flex-1 bg-black/40 justify-end" onPress={() => setShowDeptPicker(false)}>
          <View className="bg-white rounded-t-2xl p-4 max-h-[75%]">
            <View className="flex-row items-center justify-between mb-2.5">
              <Text className="text-[15px] font-bold text-gray-900">Bölüm</Text>
              <Pressable onPress={() => setShowDeptPicker(false)} hitSlop={8}>
                <X size={20} color="#6b7280" />
              </Pressable>
            </View>
            <ScrollView>
              <Pressable
                className="py-3 border-b border-gray-100"
                onPress={() => {
                  setDepartment('');
                  setShowDeptPicker(false);
                }}
              >
                <Text className="text-sm text-gray-700">Tüm Bölümler</Text>
              </Pressable>
              {(departments[faculty] || []).map((d) => (
                <Pressable
                  key={d}
                  className="py-3 border-b border-gray-100"
                  onPress={() => {
                    setDepartment(d);
                    setShowDeptPicker(false);
                  }}
                >
                  <Text className="text-sm text-gray-700">{d}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
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
