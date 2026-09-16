import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { FileText, HeartHandshake, Search, Upload, X } from 'lucide-react-native';
import { noteRequestAPI, postsAPI } from '../../lib/api';
import type { RootStackParamList, NoteRequestSummary } from '../../navigation/types';
import type { Post } from '../../types/post';
import type { NoteRequest } from './RequestCard';
import { useTheme } from '../../context/ThemeContext';
import KeyboardAvoider from '../layout/KeyboardAvoider';

interface Props {
  request: NoteRequest;
  onClose: () => void;
  onFulfilled: () => void;
}

export default function FulfillModal({ request, onClose, onFulfilled }: Props) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const brandColor = isDark ? '#5A9690' : '#2F5755';
  const mutedColor = isDark ? '#9ca3af' : '#6b7280';
  const [mode, setMode] = useState<'existing' | 'new'>('existing');
  const [myPosts, setMyPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const showLoading = loading;
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
    navigation.navigate('AddPost', { noteRequest });
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoider>
        <View style={styles.overlay}>
          <View className="bg-surface" style={styles.sheet}>
            <View style={styles.headerRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <HeartHandshake size={20} color={brandColor} />
                <Text className="text-ink" style={styles.title}>
                  İsteği Karşıla
                </Text>
              </View>
              <Pressable onPress={onClose} hitSlop={8}>
                <X size={20} color={mutedColor} />
              </Pressable>
            </View>
            <Text className="text-muted" style={styles.subtitle}>
              "{request.course_name}" isteğini mevcut bir notunla karşıla veya yeni not yükle.
            </Text>

            <View style={styles.tabRow}>
              <Pressable
                className="bg-inset"
                style={[styles.tabBtn, mode === 'existing' && { backgroundColor: brandColor }]}
                onPress={() => setMode('existing')}
              >
                <Text
                  className={mode === 'existing' ? undefined : 'text-muted'}
                  style={[styles.tabBtnText, mode === 'existing' && { color: '#fff' }]}
                >
                  Mevcut Not
                </Text>
              </Pressable>
              <Pressable
                className="bg-inset"
                style={[styles.tabBtn, mode === 'new' && { backgroundColor: brandColor }]}
                onPress={() => setMode('new')}
              >
                <Text
                  className={mode === 'new' ? undefined : 'text-muted'}
                  style={[styles.tabBtnText, mode === 'new' && { color: '#fff' }]}
                >
                  Yeni Not
                </Text>
              </Pressable>
            </View>

            {mode === 'new' ? (
              <View style={styles.newModeBox}>
                <Upload size={40} color={brandColor} />
                <Text className="text-muted" style={styles.newModeText}>
                  Bu istek için yeni bir not yükle. Fakülte ve bölüm bilgileri otomatik doldurulur; notun onaylanınca istek otomatik olarak
                  karşılanır.
                </Text>
                <Pressable className="bg-accent" style={styles.submitBtn} onPress={handleUploadNew}>
                  <Text style={styles.submitBtnText}>Yeni Not Yükle</Text>
                </Pressable>
              </View>
            ) : showLoading ? (
              <ActivityIndicator style={{ marginVertical: 24 }} color={brandColor} />
            ) : myPosts.length === 0 ? (
              <Text className="text-muted" style={styles.emptyText}>
                Henüz onaylı notun yok. "Yeni Not" sekmesinden bu istek için not yükleyebilirsin.
              </Text>
            ) : (
              <>
                <View className="border-line" style={styles.searchRow}>
                  <Search size={15} color={mutedColor} />
                  <TextInput
                    className="text-ink"
                    style={styles.searchInput}
                    value={search}
                    onChangeText={setSearch}
                    placeholder="Notlarında ara..."
                    placeholderTextColor={isDark ? '#6b7280' : '#9ca3af'}
                  />
                </View>
                <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 260 }}>
                  {filteredPosts.length === 0 ? (
                    <Text className="text-muted" style={styles.emptyText}>
                      Aramanla eşleşen not bulunamadı.
                    </Text>
                  ) : (
                    filteredPosts.map((post) => {
                      const id = post.id ?? post.post_id!;
                      const selected = selectedId === id;
                      return (
                        <Pressable
                          key={id}
                          className="border-line"
                          style={[
                            styles.postOption,
                            selected && {
                              borderColor: brandColor,
                              backgroundColor: isDark ? 'rgba(90,150,144,0.18)' : 'rgba(47,87,85,0.10)',
                            },
                          ]}
                          onPress={() => setSelectedId(id)}
                        >
                          <FileText size={16} color={brandColor} />
                          <View style={{ flex: 1 }}>
                            <Text className="text-ink" style={styles.postOptionTitle} numberOfLines={1}>
                              {post.title}
                            </Text>
                            <Text className="text-muted" style={styles.postOptionMeta}>
                              {post.faculty} · {post.department}
                            </Text>
                          </View>
                        </Pressable>
                      );
                    })
                  )}
                </ScrollView>
                <Pressable
                  className="bg-accent"
                  style={[styles.submitBtn, (!selectedId || saving) && { opacity: 0.6 }]}
                  onPress={handleFulfill}
                  disabled={!selectedId || saving}
                >
                  <Text style={styles.submitBtnText}>{saving ? 'Karşılanıyor...' : 'Seçili Notla Karşıla'}</Text>
                </Pressable>
              </>
            )}
          </View>
        </View>
      </KeyboardAvoider>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 16 },
  sheet: { borderRadius: 12, padding: 24, maxHeight: '85%' },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 20, fontWeight: '800' },
  subtitle: { fontSize: 14, marginTop: 8, marginBottom: 14, lineHeight: 19 },
  tabRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  tabBtn: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 8 },
  tabBtnText: { fontSize: 14, fontWeight: '600' },
  newModeBox: { alignItems: 'center', paddingVertical: 12, gap: 10 },
  newModeText: { fontSize: 14, textAlign: 'center', lineHeight: 19 },
  emptyText: { fontSize: 13, textAlign: 'center', paddingVertical: 20 },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    marginBottom: 10,
  },
  searchInput: { flex: 1, paddingVertical: 9, fontSize: 14 },
  postOption: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 8, padding: 10, marginBottom: 8 },
  postOptionTitle: { fontSize: 14, fontWeight: '600' },
  postOptionMeta: { fontSize: 12, marginTop: 2 },
  submitBtn: { borderRadius: 8, alignItems: 'center', paddingVertical: 10, marginTop: 6, width: '100%' },
  submitBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
});
