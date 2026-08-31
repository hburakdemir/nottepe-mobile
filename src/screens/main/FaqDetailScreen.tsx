import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRoute } from '@react-navigation/native';
import { HelpCircle, ThumbsDown, ThumbsUp } from 'lucide-react-native';
import { Pressable } from 'react-native';
import { faqAPI } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import ForumCommentList, { type ForumComment } from '../../components/forum/ForumCommentList';
import type { RootStackParamList } from '../../navigation/types';

interface FaqEntryDetail {
  id: number;
  question: string;
  answer: string;
  author_name?: string;
  created_at: string;
  upvotes?: number;
  downvotes?: number;
  my_vote?: number | null;
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' });
}

export default function FaqDetailScreen() {
  const route = useRoute<any>();
  const { id } = route.params as RootStackParamList['FaqDetail'];
  const { user } = useAuth();
  const canModerate = user?.role === 'admin' || user?.role === 'moderator';

  const [entry, setEntry] = useState<FaqEntryDetail | null>(null);
  const [comments, setComments] = useState<ForumComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [commentsLoading, setCommentsLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setCommentsLoading(true);
    try {
      const [entryRes, commentsRes] = await Promise.all([faqAPI.getById(id), faqAPI.getComments(id)]);
      setEntry(entryRes.data.entry);
      setComments(commentsRes.data.comments || []);
    } catch {
      Alert.alert('Hata', 'Kayıt yüklenemedi.');
    } finally {
      setLoading(false);
      setCommentsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const handleAddComment = async (content: string, parentCommentId?: number | null) => {
    try {
      await faqAPI.addComment(id, content, parentCommentId ?? null);
      const res = await faqAPI.getComments(id);
      setComments(res.data.comments || []);
    } catch (err: any) {
      Alert.alert('Hata', err.response?.data?.message || 'Yorum eklenemedi.');
    }
  };

  const handleDeleteComment = (commentId: number) => {
    Alert.alert('Yorumu sil', 'Bu yorum silinsin mi?', [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: async () => {
          try {
            await faqAPI.deleteComment(commentId, '');
            setComments((prev) => prev.filter((c) => c.id !== commentId));
          } catch {
            Alert.alert('Hata', 'Yorum silinemedi.');
          }
        },
      },
    ]);
  };

  const handleVoteComment = async (commentId: number, vote: number) => {
    try {
      const res = await faqAPI.voteComment(commentId, vote);
      setComments((prev) => prev.map((c) => (c.id === commentId ? { ...c, ...res.data } : c)));
    } catch {
      Alert.alert('Hata', 'Oy verilemedi.');
    }
  };

  const handleVoteAnswer = async (vote: number) => {
    try {
      const res = await faqAPI.voteAnswer(id, vote);
      setEntry((prev) => (prev ? { ...prev, ...res.data } : prev));
    } catch {
      Alert.alert('Hata', 'Oy verilemedi.');
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2F5755" />
      </View>
    );
  }

  if (!entry) {
    return (
      <View style={styles.center}>
        <Text style={styles.notFoundText}>Kayıt bulunamadı.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <HelpCircle size={20} color="#2F5755" style={{ marginTop: 2 }} />
          <Text style={styles.question}>{entry.question}</Text>
        </View>
        <Text style={styles.answer}>{entry.answer}</Text>
        <View style={styles.voteRow}>
          <Pressable style={[styles.voteBtn, entry.my_vote === 1 && styles.voteBtnUp]} onPress={() => handleVoteAnswer(1)}>
            <ThumbsUp size={14} color={entry.my_vote === 1 ? '#2F5755' : '#6b7280'} />
            <Text style={[styles.voteText, entry.my_vote === 1 && { color: '#2F5755' }]}>{entry.upvotes || 0}</Text>
          </Pressable>
          <Pressable style={[styles.voteBtn, entry.my_vote === -1 && styles.voteBtnDown]} onPress={() => handleVoteAnswer(-1)}>
            <ThumbsDown size={14} color={entry.my_vote === -1 ? '#dc2626' : '#6b7280'} />
            <Text style={[styles.voteText, entry.my_vote === -1 && { color: '#dc2626' }]}>{entry.downvotes || 0}</Text>
          </Pressable>
        </View>
        {!!entry.author_name && (
          <Text style={styles.authorText}>
            {entry.author_name} tarafından {formatDate(entry.created_at)}
          </Text>
        )}
      </View>

      <View style={styles.card}>
        <ForumCommentList
          comments={comments}
          loading={commentsLoading}
          canModerate={canModerate}
          onAddComment={handleAddComment}
          onDeleteComment={handleDeleteComment}
          onVoteComment={handleVoteComment}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  content: { padding: 16, paddingBottom: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  notFoundText: { color: '#6b7280', fontSize: 14 },
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 14 },
  question: { flex: 1, fontSize: 18, fontWeight: '700', color: '#111827', lineHeight: 24 },
  answer: { fontSize: 14, color: '#374151', marginTop: 12, lineHeight: 20 },
  voteRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  voteBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  voteBtnUp: { borderColor: '#2F5755' },
  voteBtnDown: { borderColor: '#dc2626' },
  voteText: { fontSize: 12, color: '#6b7280', fontWeight: '600' },
  authorText: { fontSize: 11, color: '#9ca3af', marginTop: 12 },
});
