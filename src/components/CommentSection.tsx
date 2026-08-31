import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Send, Star, Trash2, User } from 'lucide-react-native';
import { commentAPI } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useGoToUserProfile } from '../hooks/useGoToUserProfile';
import type { Comment } from '../types/comment';

function formatDateTime(dateString: string): string {
  return new Date(dateString).toLocaleString('tr-TR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function StarPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <View style={styles.starRow}>
      {[1, 2, 3, 4, 5].map((s) => (
        <Pressable key={s} onPress={() => onChange(value === s ? 0 : s)} hitSlop={6}>
          <Star size={22} color="#eab308" fill={value >= s ? '#eab308' : 'none'} />
        </Pressable>
      ))}
    </View>
  );
}

function StarDisplay({ value }: { value: number }) {
  return (
    <View style={styles.starRow}>
      {[1, 2, 3, 4, 5].map((s) => (
        <Star key={s} size={14} color={value >= s ? '#eab308' : '#d1d5db'} fill={value >= s ? '#eab308' : 'none'} />
      ))}
    </View>
  );
}

interface RatingStats {
  avg_rating: number | string;
  rating_count: number;
}

interface Props {
  postId: number;
  postOwnerId: number;
  onRatingChange: (stats: RatingStats) => void;
}

export default function CommentSection({ postId, postOwnerId, onRatingChange }: Props) {
  const { user, isAuthenticated } = useAuth();
  const goToUserProfile = useGoToUserProfile();

  const [comments, setComments] = useState<Comment[]>([]);
  const [total, setTotal] = useState(0);
  const [limit, setLimit] = useState(5);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const [content, setContent] = useState('');
  const [rating, setRating] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const fetchPage = useCallback(
    async (p: number, append: boolean) => {
      try {
        if (append) setLoadingMore(true);
        else setLoading(true);
        const res = await commentAPI.getByPost(postId, p);
        const { comments: rows, total: t, limit: l } = res.data;
        setComments((prev) => (append ? [...prev, ...rows] : rows));
        setTotal(t);
        setLimit(l);
        setPage(p);
      } catch (err) {
        console.error('Yorumlar alınamadı:', err);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [postId]
  );

  React.useEffect(() => {
    fetchPage(1, false);
  }, [fetchPage]);

  const hasMore = comments.length < total;

  const handleSubmit = async () => {
    if (!content.trim() && !rating) {
      setFormError('Yorum veya puan giriniz.');
      return;
    }
    setFormError('');
    setSubmitting(true);
    try {
      const res = await commentAPI.create({ post_id: postId, content: content.trim() || undefined, rating: rating || undefined });
      setContent('');
      setRating(0);
      await fetchPage(1, false);
      if (res.data.ratingStats) onRatingChange(res.data.ratingStats);
    } catch (err: any) {
      setFormError(err.response?.data?.message || 'Yorum gönderilemedi.');
    } finally {
      setSubmitting(false);
    }
  };

  const confirmDelete = (commentId: number) => {
    Alert.alert('Yorumu sil', 'Bu yorumu silmek istediğinize emin misiniz?', [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: async () => {
          try {
            const res = await commentAPI.delete(commentId);
            setComments((prev) => prev.filter((c) => c.id !== commentId));
            setTotal((t) => Math.max(t - 1, 0));
            if (res.data.ratingStats) onRatingChange(res.data.ratingStats);
          } catch {
            Alert.alert('Hata', 'Yorum silinemedi.');
          }
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Yorumlar ({total})</Text>

      {loading ? (
        <ActivityIndicator style={{ marginVertical: 16 }} color="#1d4ed8" />
      ) : comments.length === 0 ? (
        <Text style={styles.empty}>İlk yorumu sen bırak!</Text>
      ) : (
        <View style={{ gap: 10 }}>
          {comments.map((c) => {
            const isOwner = user && String(user.id) === String(c.user_id);
            const isPostOwner = user && String(user.id) === String(postOwnerId);
            return (
              <View key={c.id} style={styles.commentCard}>
                <View style={styles.commentHeader}>
                  <Pressable style={styles.commentUser} onPress={() => goToUserProfile(c.username)}>
                    <View style={styles.avatarFallback}>
                      <User size={14} color="#6b7280" />
                    </View>
                    <View>
                      <Text style={styles.username}>{c.username || 'Anonim'}</Text>
                      <Text style={styles.date}>{formatDateTime(c.created_at)}</Text>
                    </View>
                  </Pressable>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    {!!c.rating && <StarDisplay value={c.rating} />}
                    {(isOwner || isPostOwner) && (
                      <Pressable onPress={() => confirmDelete(c.id)} hitSlop={6}>
                        <Trash2 size={16} color="#dc2626" />
                      </Pressable>
                    )}
                  </View>
                </View>
                {!!c.content && <Text style={styles.commentContent}>{c.content}</Text>}
              </View>
            );
          })}
          {hasMore && (
            <Pressable style={styles.loadMore} onPress={() => fetchPage(page + 1, true)} disabled={loadingMore}>
              {loadingMore ? (
                <ActivityIndicator color="#1d4ed8" />
              ) : (
                <Text style={styles.loadMoreText}>Daha fazla yorum göster</Text>
              )}
            </Pressable>
          )}
        </View>
      )}

      {isAuthenticated && (
        <View style={styles.form}>
          <Text style={styles.formLabel}>Puanın</Text>
          <StarPicker value={rating} onChange={setRating} />
          <TextInput
            style={styles.input}
            value={content}
            onChangeText={setContent}
            placeholder="Yorumunuz..."
            placeholderTextColor="#9ca3af"
            multiline
            maxLength={350}
          />
          {!!formError && <Text style={styles.error}>{formError}</Text>}
          <Pressable
            style={[styles.submitBtn, submitting && { opacity: 0.6 }]}
            onPress={handleSubmit}
            disabled={submitting}
          >
            <Send size={14} color="#fff" />
            <Text style={styles.submitText}>{submitting ? 'Gönderiliyor…' : 'Yorumu Gönder'}</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginTop: 16 },
  header: { fontSize: 15, fontWeight: '700', color: '#111827', marginBottom: 10 },
  empty: { color: '#9ca3af', fontSize: 13, textAlign: 'center', paddingVertical: 16 },
  commentCard: { borderWidth: 1, borderColor: '#f3f4f6', borderRadius: 10, padding: 10 },
  commentHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  commentUser: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  avatarFallback: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  username: { fontSize: 13, fontWeight: '600', color: '#111827' },
  date: { fontSize: 10.5, color: '#9ca3af' },
  commentContent: { fontSize: 13.5, color: '#374151', marginTop: 8, lineHeight: 19 },
  starRow: { flexDirection: 'row', gap: 3 },
  loadMore: { alignItems: 'center', paddingVertical: 10 },
  loadMoreText: { color: '#1d4ed8', fontSize: 13, fontWeight: '600' },
  form: { marginTop: 16, backgroundColor: '#2F5755', borderRadius: 12, padding: 14, gap: 10 },
  formLabel: { color: '#E0D9D9', fontSize: 12, fontWeight: '700' },
  input: {
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#111827',
    minHeight: 70,
    textAlignVertical: 'top',
  },
  error: { color: '#fca5a5', fontSize: 12 },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#12161A',
    borderRadius: 10,
    paddingVertical: 10,
  },
  submitText: { color: '#fff', fontSize: 13, fontWeight: '700' },
});
