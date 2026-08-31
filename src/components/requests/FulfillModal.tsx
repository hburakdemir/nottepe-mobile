import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { FileText, HeartHandshake, Search, Upload, X } from 'lucide-react-native';
import { noteRequestAPI, postsAPI } from '../../lib/api';
import type { RootStackParamList, NoteRequestSummary } from '../../navigation/types';
import type { Post } from '../../types/post';
import type { NoteRequest } from './RequestCard';

interface Props {
  request: NoteRequest;
  onClose: () => void;
  onFulfilled: () => void;
}

export default function FulfillModal({ request, onClose, onFulfilled }: Props) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [mode, setMode] = useState<'existing' | 'new'>('existing');
  const [myPosts, setMyPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<number | string | null>(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    postsAPI
      .getMyPosts()
      .then((res) => setMyPosts((res.data || []).filter((p: Post) => p.status === 'approved')))
      .catch(() => setMyPosts([]))
      .finally(() => setLoading(false));
  }, []);

  const query = search.trim().toLocaleLowerCase('tr');
  const filteredPosts = query
    ? myPosts.filter((p) => `${p.title || ''} ${p.faculty || ''} ${p.department || ''}`.toLocaleLowerCase('tr').includes(query))
    : myPosts;

  const handleFulfill = async () => {
    if (!selectedId) {
      Alert.alert('Hata', 'Bir not seç');
      return;
    }
    setSaving(true);
    try {
      await noteRequestAPI.fulfill(request.id, selectedId);
      onFulfilled();
      onClose();
    } catch (err: any) {
      Alert.alert('Hata', err.response?.data?.message || 'Karşılama başarısız');
    } finally {
      setSaving(false);
    }
  };

  const handleUploadNew = () => {
    onClose();
    const noteRequest: NoteRequestSummary = {
      id: request.id,
      faculty: request.faculty,
      department: request.department,
      course_name: request.course_name,
    };
    navigation.navigate('MainTabs', { screen: 'AddPost', params: { noteRequest } } as any);
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.headerRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <HeartHandshake size={18} color="#2F5755" />
              <Text style={styles.title}>İsteği Karşıla</Text>
            </View>
            <Pressable onPress={onClose} hitSlop={8}>
              <X size={20} color="#6b7280" />
            </Pressable>
          </View>
          <Text style={styles.subtitle}>"{request.course_name}" isteğini mevcut bir notunla karşıla veya yeni not yükle.</Text>

          <View style={styles.tabRow}>
            <Pressable style={[styles.tabBtn, mode === 'existing' && styles.tabBtnActive]} onPress={() => setMode('existing')}>
              <Text style={[styles.tabBtnText, mode === 'existing' && styles.tabBtnTextActive]}>Mevcut Not</Text>
            </Pressable>
            <Pressable style={[styles.tabBtn, mode === 'new' && styles.tabBtnActive]} onPress={() => setMode('new')}>
              <Text style={[styles.tabBtnText, mode === 'new' && styles.tabBtnTextActive]}>Yeni Not</Text>
            </Pressable>
          </View>

          {mode === 'new' ? (
            <View style={styles.newModeBox}>
              <Upload size={32} color="#2F5755" />
              <Text style={styles.newModeText}>
                Bu istek için yeni bir not yükle. Fakülte ve bölüm bilgileri otomatik doldurulur; notun onaylanınca
                istek otomatik olarak karşılanır.
              </Text>
              <Pressable style={styles.submitBtn} onPress={handleUploadNew}>
                <Text style={styles.submitBtnText}>Yeni Not Yükle</Text>
              </Pressable>
            </View>
          ) : loading ? (
            <ActivityIndicator style={{ marginVertical: 24 }} color="#2F5755" />
          ) : myPosts.length === 0 ? (
            <Text style={styles.emptyText}>
              Henüz onaylı notun yok. "Yeni Not" sekmesinden bu istek için not yükleyebilirsin.
            </Text>
          ) : (
            <>
              <View style={styles.searchRow}>
                <Search size={15} color="#9ca3af" />
                <TextInput
                  style={styles.searchInput}
                  value={search}
                  onChangeText={setSearch}
                  placeholder="Notlarında ara..."
                  placeholderTextColor="#9ca3af"
                />
              </View>
              <ScrollView style={{ maxHeight: 260 }}>
                {filteredPosts.length === 0 ? (
                  <Text style={styles.emptyText}>Aramanla eşleşen not bulunamadı.</Text>
                ) : (
                  filteredPosts.map((post) => {
                    const id = post.id ?? post.post_id!;
                    const selected = selectedId === id;
                    return (
                      <Pressable key={id} style={[styles.postOption, selected && styles.postOptionSelected]} onPress={() => setSelectedId(id)}>
                        <FileText size={15} color="#2F5755" />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.postOptionTitle} numberOfLines={1}>
                            {post.title}
                          </Text>
                          <Text style={styles.postOptionMeta}>
                            {post.faculty} · {post.department}
                          </Text>
                        </View>
                      </Pressable>
                    );
                  })
                )}
              </ScrollView>
              <Pressable style={[styles.submitBtn, (!selectedId || saving) && { opacity: 0.6 }]} onPress={handleFulfill} disabled={!selectedId || saving}>
                <Text style={styles.submitBtnText}>{saving ? 'Karşılanıyor...' : 'Seçili Notla Karşıla'}</Text>
              </Pressable>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 16 },
  sheet: { backgroundColor: '#fff', borderRadius: 16, padding: 20, maxHeight: '85%' },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 17, fontWeight: '700', color: '#111827' },
  subtitle: { fontSize: 12.5, color: '#6b7280', marginTop: 8, marginBottom: 14, lineHeight: 17 },
  tabRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  tabBtn: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 10, backgroundColor: '#f3f4f6' },
  tabBtnActive: { backgroundColor: '#2F5755' },
  tabBtnText: { fontSize: 13, fontWeight: '600', color: '#6b7280' },
  tabBtnTextActive: { color: '#fff' },
  newModeBox: { alignItems: 'center', paddingVertical: 12, gap: 10 },
  newModeText: { fontSize: 12.5, color: '#4b5563', textAlign: 'center', lineHeight: 18 },
  emptyText: { fontSize: 13, color: '#9ca3af', textAlign: 'center', paddingVertical: 20 },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, paddingHorizontal: 12, marginBottom: 10 },
  searchInput: { flex: 1, paddingVertical: 9, fontSize: 13.5, color: '#111827' },
  postOption: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, padding: 10, marginBottom: 8 },
  postOptionSelected: { borderColor: '#2F5755', backgroundColor: '#2F575519' },
  postOptionTitle: { fontSize: 13, fontWeight: '600', color: '#111827' },
  postOptionMeta: { fontSize: 11, color: '#9ca3af', marginTop: 2 },
  submitBtn: { backgroundColor: '#2F5755', borderRadius: 10, alignItems: 'center', paddingVertical: 13, marginTop: 6, width: '100%' },
  submitBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});
