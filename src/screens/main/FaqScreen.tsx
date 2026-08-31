import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ChevronRight, HelpCircle, Inbox, MessageSquare, Plus, Send, X } from 'lucide-react-native';
import { faqAPI } from '../../lib/api';
import type { RootStackParamList } from '../../navigation/types';

const PAGE_LIMIT = 20;

interface FaqEntry {
  id: number;
  question: string;
  answer: string;
  comment_count: number;
  author_name?: string;
}

export default function FaqScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [entries, setEntries] = useState<FaqEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [askModalOpen, setAskModalOpen] = useState(false);
  const [question, setQuestion] = useState('');
  const [asking, setAsking] = useState(false);

  const fetchEntries = async (targetPage: number, reset = false) => {
    if (reset) setLoading(true);
    else setLoadingMore(true);
    try {
      const res = await faqAPI.getAll({ page: targetPage, limit: PAGE_LIMIT });
      const { entries: rows, total: newTotal } = res.data;
      setEntries((prev) => (reset ? rows : [...prev, ...rows]));
      setTotal(newTotal);
      setPage(targetPage);
    } catch {
      Alert.alert('Hata', 'Sık sorulan sorular yüklenemedi.');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    fetchEntries(1, true);
  }, []);

  const hasMore = entries.length < total;

  const handleAskSubmit = async () => {
    if (!question.trim()) return;
    setAsking(true);
    try {
      await faqAPI.askQuestion(question.trim());
      Alert.alert('Başarılı', 'Sorunuz alındı, incelendikten sonra yayınlanacak.');
      setQuestion('');
      setAskModalOpen(false);
    } catch (err: any) {
      Alert.alert('Hata', err.response?.data?.message || 'Soru gönderilemedi.');
    } finally {
      setAsking(false);
    }
  };

  const header = (
    <View style={styles.headerBlock}>
      <View style={styles.titleRow}>
        <HelpCircle size={22} color="#2F5755" />
        <Text style={styles.title}>Sık Sorulan Sorular</Text>
      </View>
      <Text style={styles.subtitle}>Merak edilenler ve Nottepelilerin bu konulardaki tartışmaları.</Text>
      <Pressable style={styles.askBtn} onPress={() => setAskModalOpen(true)}>
        <Plus size={15} color="#fff" />
        <Text style={styles.askBtnText}>Soru Sor</Text>
      </Pressable>
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
          data={entries}
          keyExtractor={(item) => String(item.id)}
          ListHeaderComponent={header}
          renderItem={({ item }) => (
            <Pressable style={styles.entryCard} onPress={() => navigation.navigate('FaqDetail', { id: item.id })}>
              <View style={{ flex: 1 }}>
                <Text style={styles.entryQuestion}>{item.question}</Text>
                <Text style={styles.entryAnswer} numberOfLines={2}>
                  {item.answer}
                </Text>
                <View style={styles.entryMetaRow}>
                  <MessageSquare size={12} color="#9ca3af" />
                  <Text style={styles.entryMetaText}>{item.comment_count} yorum</Text>
                  {!!item.author_name && <Text style={styles.entryMetaText}>· {item.author_name}</Text>}
                </View>
              </View>
              <ChevronRight size={18} color="#d1d5db" />
            </Pressable>
          )}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Inbox size={40} color="#d1d5db" />
              <Text style={styles.emptyText}>Henüz bir kayıt eklenmemiş.</Text>
            </View>
          }
          ListFooterComponent={
            hasMore ? (
              <Pressable style={styles.loadMoreBtn} onPress={() => fetchEntries(page + 1)} disabled={loadingMore}>
                {loadingMore ? <ActivityIndicator color="#2F5755" /> : <Text style={styles.loadMoreText}>Daha Fazla Göster</Text>}
              </Pressable>
            ) : null
          }
        />
      )}

      <Modal visible={askModalOpen} transparent animationType="fade" onRequestClose={() => setAskModalOpen(false)}>
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <View style={styles.sheetHeaderRow}>
              <Text style={styles.sheetTitle}>Soru Sor</Text>
              <Pressable onPress={() => setAskModalOpen(false)} hitSlop={8}>
                <X size={20} color="#6b7280" />
              </Pressable>
            </View>
            <TextInput
              style={styles.textArea}
              value={question}
              onChangeText={setQuestion}
              maxLength={500}
              multiline
              placeholder="Merak ettiğin soruyu yaz..."
              placeholderTextColor="#9ca3af"
            />
            <Pressable style={[styles.submitBtn, (asking || !question.trim()) && { opacity: 0.6 }]} onPress={handleAskSubmit} disabled={asking || !question.trim()}>
              <Send size={15} color="#fff" />
              <Text style={styles.submitBtnText}>{asking ? 'Gönderiliyor...' : 'Gönder'}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
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
  askBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#2F5755', borderRadius: 10, paddingVertical: 12, marginTop: 14 },
  askBtnText: { color: '#fff', fontSize: 13.5, fontWeight: '700' },
  entryCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10 },
  entryQuestion: { fontSize: 14.5, fontWeight: '700', color: '#111827' },
  entryAnswer: { fontSize: 12.5, color: '#6b7280', marginTop: 4, lineHeight: 17 },
  entryMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 8 },
  entryMetaText: { fontSize: 11, color: '#9ca3af' },
  emptyBox: { alignItems: 'center', paddingVertical: 50, gap: 10 },
  emptyText: { color: '#9ca3af', fontSize: 13.5 },
  loadMoreBtn: { alignItems: 'center', borderWidth: 1, borderColor: '#2F5755', borderRadius: 10, paddingVertical: 12, marginTop: 8 },
  loadMoreText: { color: '#2F5755', fontSize: 13, fontWeight: '600' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 16 },
  sheet: { backgroundColor: '#fff', borderRadius: 16, padding: 20 },
  sheetHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  sheetTitle: { fontSize: 17, fontWeight: '700', color: '#111827' },
  textArea: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: '#111827', minHeight: 90, textAlignVertical: 'top' },
  submitBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#2F5755', borderRadius: 10, paddingVertical: 12, marginTop: 14 },
  submitBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});
