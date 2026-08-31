import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
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
    <View style={styles.headerBlock}>
      <View style={styles.titleRow}>
        <HeartHandshake size={22} color="#2F5755" />
        <Text style={styles.title}>Not İstekleri</Text>
      </View>
      <Text style={styles.subtitle}>Aradığın notu bulamadın mı? İste — elinde olan varsa karşılasın.</Text>

      <Pressable style={styles.createBtn} onPress={() => setShowCreate(true)}>
        <Plus size={16} color="#fff" />
        <Text style={styles.createBtnText}>İstek Oluştur</Text>
      </Pressable>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 14 }}>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {[
            { value: 'open' as const, label: 'Açık İstekler' },
            { value: 'fulfilled' as const, label: 'Karşılananlar' },
          ].map((t) => (
            <Pressable
              key={t.value}
              style={[styles.filterChip, view === 'board' && status === t.value && styles.filterChipActive]}
              onPress={() => {
                setView('board');
                setStatus(t.value);
              }}
            >
              <Text style={[styles.filterChipText, view === 'board' && status === t.value && styles.filterChipTextActive]}>
                {t.label}
              </Text>
            </Pressable>
          ))}
          <Pressable style={[styles.filterChip, view === 'mine' && styles.filterChipActive]} onPress={() => setView('mine')}>
            <Text style={[styles.filterChipText, view === 'mine' && styles.filterChipTextActive]}>İsteklerim</Text>
          </Pressable>
        </View>
      </ScrollView>

      {view === 'board' && (
        <>
          <View style={styles.sortRow}>
            {[
              { value: 'new' as const, label: 'En Yeni' },
              { value: 'top' as const, label: 'En Çok İstenen' },
            ].map((s) => (
              <Pressable key={s.value} style={[styles.sortBtn, sort === s.value && styles.sortBtnActive]} onPress={() => setSort(s.value)}>
                <Text style={[styles.sortBtnText, sort === s.value && styles.sortBtnTextActive]}>{s.label}</Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.filterCard}>
            <Pressable style={styles.selectBox} onPress={() => setShowFacultyPicker(true)}>
              <Text style={faculty ? styles.selectText : styles.selectPlaceholder} numberOfLines={1}>
                {faculty || 'Tüm Fakülteler'}
              </Text>
              <ChevronDown size={15} color="#6b7280" />
            </Pressable>
            <Pressable
              style={[styles.selectBox, !faculty && { opacity: 0.5 }]}
              onPress={() => faculty && setShowDeptPicker(true)}
            >
              <Text style={department ? styles.selectText : styles.selectPlaceholder} numberOfLines={1}>
                {department || 'Tüm Bölümler'}
              </Text>
              <ChevronDown size={15} color="#6b7280" />
            </Pressable>
          </View>
        </>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#2F5755" />
        </View>
      ) : (
        <FlatList
          contentContainerStyle={styles.listContent}
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
            <View style={styles.emptyBox}>
              <Inbox size={40} color="#d1d5db" />
              <Text style={styles.emptyText}>{view === 'mine' ? 'Henüz istek oluşturmadın.' : 'Bu filtrede istek bulunamadı.'}</Text>
            </View>
          }
          ListFooterComponent={
            hasMore ? (
              <Pressable style={styles.loadMoreBtn} onPress={() => fetchBoard(page + 1)} disabled={loadingMore}>
                {loadingMore ? <ActivityIndicator color="#2F5755" /> : <Text style={styles.loadMoreText}>Daha Fazla Göster</Text>}
              </Pressable>
            ) : null
          }
        />
      )}

      {showCreate && <CreateRequestModal onClose={() => setShowCreate(false)} onCreated={refresh} />}
      {fulfillTarget && <FulfillModal request={fulfillTarget} onClose={() => setFulfillTarget(null)} onFulfilled={refresh} />}

      <Modal visible={showFacultyPicker} transparent animationType="slide" onRequestClose={() => setShowFacultyPicker(false)}>
        <Pressable style={styles.pickerOverlay} onPress={() => setShowFacultyPicker(false)}>
          <View style={styles.pickerSheet}>
            <View style={styles.pickerHeaderRow}>
              <Text style={styles.pickerTitle}>Fakülte</Text>
              <Pressable onPress={() => setShowFacultyPicker(false)} hitSlop={8}>
                <X size={20} color="#6b7280" />
              </Pressable>
            </View>
            <ScrollView>
              <Pressable
                style={styles.pickerOption}
                onPress={() => {
                  setFaculty('');
                  setDepartment('');
                  setShowFacultyPicker(false);
                }}
              >
                <Text style={styles.pickerOptionText}>Tüm Fakülteler</Text>
              </Pressable>
              {faculties.map((f) => (
                <Pressable
                  key={f}
                  style={styles.pickerOption}
                  onPress={() => {
                    setFaculty(f);
                    setDepartment('');
                    setShowFacultyPicker(false);
                  }}
                >
                  <Text style={styles.pickerOptionText}>{f}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>

      <Modal visible={showDeptPicker} transparent animationType="slide" onRequestClose={() => setShowDeptPicker(false)}>
        <Pressable style={styles.pickerOverlay} onPress={() => setShowDeptPicker(false)}>
          <View style={styles.pickerSheet}>
            <View style={styles.pickerHeaderRow}>
              <Text style={styles.pickerTitle}>Bölüm</Text>
              <Pressable onPress={() => setShowDeptPicker(false)} hitSlop={8}>
                <X size={20} color="#6b7280" />
              </Pressable>
            </View>
            <ScrollView>
              <Pressable
                style={styles.pickerOption}
                onPress={() => {
                  setDepartment('');
                  setShowDeptPicker(false);
                }}
              >
                <Text style={styles.pickerOptionText}>Tüm Bölümler</Text>
              </Pressable>
              {(departments[faculty] || []).map((d) => (
                <Pressable
                  key={d}
                  style={styles.pickerOption}
                  onPress={() => {
                    setDepartment(d);
                    setShowDeptPicker(false);
                  }}
                >
                  <Text style={styles.pickerOptionText}>{d}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  listContent: { padding: 16, paddingBottom: 40 },
  headerBlock: { marginBottom: 16 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { fontSize: 22, fontWeight: '800', color: '#111827' },
  subtitle: { fontSize: 12.5, color: '#6b7280', marginTop: 6 },
  createBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#2F5755', borderRadius: 10, paddingVertical: 12, marginTop: 14 },
  createBtnText: { color: '#fff', fontSize: 13.5, fontWeight: '700' },
  filterChip: { backgroundColor: '#fff', borderRadius: 100, paddingHorizontal: 14, paddingVertical: 9, marginRight: 8 },
  filterChipActive: { backgroundColor: '#2F5755' },
  filterChipText: { fontSize: 12.5, fontWeight: '600', color: '#4b5563' },
  filterChipTextActive: { color: '#fff' },
  sortRow: { flexDirection: 'row', gap: 6, marginTop: 12, backgroundColor: '#fff', borderRadius: 10, padding: 4, alignSelf: 'flex-start' },
  sortBtn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8 },
  sortBtnActive: { backgroundColor: '#2F575519' },
  sortBtnText: { fontSize: 11.5, fontWeight: '600', color: '#9ca3af' },
  sortBtnTextActive: { color: '#2F5755' },
  filterCard: { flexDirection: 'row', gap: 10, marginTop: 12 },
  selectBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  selectText: { fontSize: 12.5, color: '#111827', flexShrink: 1 },
  selectPlaceholder: { fontSize: 12.5, color: '#9ca3af', flexShrink: 1 },
  emptyBox: { alignItems: 'center', paddingVertical: 50, gap: 10 },
  emptyText: { color: '#9ca3af', fontSize: 13.5 },
  loadMoreBtn: { alignItems: 'center', borderWidth: 1, borderColor: '#2F5755', borderRadius: 10, paddingVertical: 12, marginTop: 8 },
  loadMoreText: { color: '#2F5755', fontSize: 13, fontWeight: '600' },
  pickerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  pickerSheet: { backgroundColor: '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 16, maxHeight: '75%' },
  pickerHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  pickerTitle: { fontSize: 15, fontWeight: '700', color: '#111827' },
  pickerOption: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  pickerOptionText: { fontSize: 14, color: '#374151' },
});
