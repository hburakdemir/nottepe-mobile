import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ChevronRight, Inbox, Lightbulb, MessageSquare, Send } from 'lucide-react-native';
import { suggestionAPI } from '../../lib/api';
import type { RootStackParamList } from '../../navigation/types';

const PAGE_LIMIT = 20;

interface Suggestion {
  id: number;
  content: string;
  full_name: string;
  comment_count: number;
}

export default function SuggestionsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchSuggestions = async (targetPage: number, reset = false) => {
    if (reset) setLoading(true);
    else setLoadingMore(true);
    try {
      const res = await suggestionAPI.getAll({ page: targetPage, limit: PAGE_LIMIT });
      const { suggestions: rows, total: newTotal } = res.data;
      setSuggestions((prev) => (reset ? rows : [...prev, ...rows]));
      setTotal(newTotal);
      setPage(targetPage);
    } catch {
      Alert.alert('Hata', 'Öneriler yüklenemedi.');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    fetchSuggestions(1, true);
  }, []);

  const hasMore = suggestions.length < total;

  const handleSubmit = async () => {
    if (!text.trim()) return;
    setSubmitting(true);
    try {
      await suggestionAPI.create(text.trim());
      setText('');
      fetchSuggestions(1, true);
    } catch (err: any) {
      Alert.alert('Hata', err.response?.data?.message || 'Öneri paylaşılamadı.');
    } finally {
      setSubmitting(false);
    }
  };

  const header = (
    <View style={styles.headerBlock}>
      <View style={styles.titleRow}>
        <Lightbulb size={22} color="#2F5755" />
        <Text style={styles.title}>Öneriler</Text>
      </View>
      <Text style={styles.subtitle}>Nottepe'yi nasıl daha iyi yapabiliriz? Önerini paylaş, tartışalım.</Text>

      <View style={styles.formCard}>
        <TextInput
          style={styles.textArea}
          value={text}
          onChangeText={setText}
          maxLength={4000}
          multiline
          placeholder="Önerini yaz..."
          placeholderTextColor="#9ca3af"
        />
        <Pressable style={[styles.submitBtn, (submitting || !text.trim()) && { opacity: 0.6 }]} onPress={handleSubmit} disabled={submitting || !text.trim()}>
          <Send size={14} color="#fff" />
          <Text style={styles.submitBtnText}>Paylaş</Text>
        </Pressable>
      </View>
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
          data={suggestions}
          keyExtractor={(item) => String(item.id)}
          ListHeaderComponent={header}
          renderItem={({ item }) => (
            <Pressable style={styles.entryCard} onPress={() => navigation.navigate('SuggestionDetail', { id: item.id })}>
              <View style={{ flex: 1 }}>
                <Text style={styles.entryContent} numberOfLines={3}>
                  {item.content}
                </Text>
                <View style={styles.entryMetaRow}>
                  <Text style={styles.entryMetaText}>{item.full_name}</Text>
                  <MessageSquare size={12} color="#9ca3af" />
                  <Text style={styles.entryMetaText}>{item.comment_count} yorum</Text>
                </View>
              </View>
              <ChevronRight size={18} color="#d1d5db" />
            </Pressable>
          )}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Inbox size={40} color="#d1d5db" />
              <Text style={styles.emptyText}>Henüz öneri paylaşılmamış.</Text>
            </View>
          }
          ListFooterComponent={
            hasMore ? (
              <Pressable style={styles.loadMoreBtn} onPress={() => fetchSuggestions(page + 1)} disabled={loadingMore}>
                {loadingMore ? <ActivityIndicator color="#2F5755" /> : <Text style={styles.loadMoreText}>Daha Fazla Göster</Text>}
              </Pressable>
            ) : null
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  listContent: { padding: 16, paddingBottom: 40 },
  headerBlock: { marginBottom: 14 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { fontSize: 22, fontWeight: '800', color: '#111827' },
  subtitle: { fontSize: 12.5, color: '#6b7280', marginTop: 6 },
  formCard: { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginTop: 14 },
  textArea: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13.5, color: '#111827', minHeight: 70, textAlignVertical: 'top' },
  submitBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#2F5755', borderRadius: 10, paddingVertical: 11, marginTop: 10, alignSelf: 'flex-end', paddingHorizontal: 18 },
  submitBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  entryCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10 },
  entryContent: { fontSize: 13.5, color: '#1f2937', lineHeight: 19 },
  entryMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 8 },
  entryMetaText: { fontSize: 11, color: '#9ca3af' },
  emptyBox: { alignItems: 'center', paddingVertical: 50, gap: 10 },
  emptyText: { color: '#9ca3af', fontSize: 13.5 },
  loadMoreBtn: { alignItems: 'center', borderWidth: 1, borderColor: '#2F5755', borderRadius: 10, paddingVertical: 12, marginTop: 8 },
  loadMoreText: { color: '#2F5755', fontSize: 13, fontWeight: '600' },
});
