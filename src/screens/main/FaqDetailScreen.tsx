import React, { useCallback, useEffect, useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { useRoute } from '@react-navigation/native';
import { HelpCircle, ThumbsDown, ThumbsUp } from 'lucide-react-native';
import { Pressable } from 'react-native';
import { faqAPI } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import ForumCommentList, { type ForumComment } from '../../components/forum/ForumCommentList';
import type { RootStackParamList } from '../../navigation/types';
import StateView from '../../components/StateView';

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
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const canModerate = user?.role === 'admin' || user?.role === 'moderator';

  const [entry, setEntry] = useState<FaqEntryDetail | null>(null);
  const [comments, setComments] = useState<ForumComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [commentsLoading, setCommentsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setCommentsLoading(true);
    setLoadError(false);
    try {
      const [entryRes, commentsRes] = await Promise.all([faqAPI.getById(id), faqAPI.getComments(id)]);
      setEntry(entryRes.data.entry);
      setComments(commentsRes.data.comments || []);
    } catch {
      // Eskiden `Alert.alert('Hata', ...)` gösterip ekranı boş bırakıyordu —
      // uyarı kapanınca kullanıcı "Kayıt bulunamadı." ile baş başa kalıyordu,
      // sanki kayıt gerçekten yokmuş gibi. Artık gerçek hata durumu ayrı ve
      // "Tekrar dene" ile kurtarılabilir.
      setLoadError(true);
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
      <View className="flex-1 items-center justify-center">
        <StateView kind="loading" loadingColor={isDark ? '#5A9690' : '#2F5755'} />
      </View>
    );
  }

  if (loadError) {
    return (
      <View className="flex-1 items-center justify-center">
        <StateView kind="error" title="Kayıt yüklenemedi." onAction={fetchAll} />
      </View>
    );
  }

  if (!entry) {
    return (
      <View className="flex-1 items-center justify-center">
        <StateView kind="empty" title="Kayıt bulunamadı." />
      </View>
    );
  }

  return (
    <ScrollView showsVerticalScrollIndicator={false} className="flex-1 bg-ground" contentContainerClassName="p-4 pb-[110px]">
      <View className="bg-surface rounded-2xl p-4 mb-3.5">
        <View className="flex-row gap-2.5">
          <HelpCircle size={20} color={isDark ? '#5A9690' : '#2F5755'} style={{ marginTop: 2 }} />
          <Text className="flex-1 text-lg font-bold text-ink leading-6">{entry.question}</Text>
        </View>
        <Text className="text-sm text-ink2 mt-3 leading-5">{entry.answer}</Text>
        <View className="flex-row gap-2 mt-3">
          <Pressable
            className={`flex-row items-center gap-[5px] border rounded-lg px-2.5 py-1.5 ${entry.my_vote === 1 ? 'border-accent' : 'border-line'}`}
            onPress={() => handleVoteAnswer(1)}
          >
            <ThumbsUp size={14} color={entry.my_vote === 1 ? (isDark ? '#5A9690' : '#2F5755') : isDark ? '#9ca3af' : '#6b7280'} />
            <Text className={`text-xs font-semibold ${entry.my_vote === 1 ? 'text-accent' : 'text-muted'}`}>{entry.upvotes || 0}</Text>
          </Pressable>
          <Pressable
            className={`flex-row items-center gap-[5px] border rounded-lg px-2.5 py-1.5 ${entry.my_vote === -1 ? 'border-red-600' : 'border-line'}`}
            onPress={() => handleVoteAnswer(-1)}
          >
            <ThumbsDown size={14} color={entry.my_vote === -1 ? '#dc2626' : isDark ? '#9ca3af' : '#6b7280'} />
            <Text className={`text-xs font-semibold ${entry.my_vote === -1 ? 'text-red-600' : 'text-muted'}`}>{entry.downvotes || 0}</Text>
          </Pressable>
        </View>
        {!!entry.author_name && (
          <Text className="text-[11px] text-muted2 mt-3">
            {entry.author_name} tarafından {formatDate(entry.created_at)}
          </Text>
        )}
      </View>

      <View className="bg-surface rounded-2xl p-4 mb-3.5">
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
