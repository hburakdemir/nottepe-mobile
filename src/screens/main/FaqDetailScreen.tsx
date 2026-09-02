import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, Text, View } from 'react-native';
import { useRoute } from '@react-navigation/native';
import { HelpCircle, ThumbsDown, ThumbsUp } from 'lucide-react-native';
import { Pressable } from 'react-native';
import { faqAPI } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
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
  const { theme } = useTheme();
  const isDark = theme === 'dark';
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
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" color={isDark ? '#5A9690' : '#2F5755'} />
      </View>
    );
  }

  if (!entry) {
    return (
      <View className="flex-1 items-center justify-center">
        <Text className="text-gray-500 dark:text-gray-400 text-sm">Kayıt bulunamadı.</Text>
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-gray-50 dark:bg-darkbgbutton" contentContainerClassName="p-4 pb-10">
      <View className="bg-white dark:bg-darkbgbutton rounded-2xl p-4 mb-3.5">
        <View className="flex-row gap-2.5">
          <HelpCircle size={20} color={isDark ? '#5A9690' : '#2F5755'} style={{ marginTop: 2 }} />
          <Text className="flex-1 text-lg font-bold text-gray-900 dark:text-darktext leading-6">{entry.question}</Text>
        </View>
        <Text className="text-sm text-gray-700 dark:text-darktext mt-3 leading-5">{entry.answer}</Text>
        <View className="flex-row gap-2 mt-3">
          <Pressable
            className={`flex-row items-center gap-[5px] border rounded-lg px-2.5 py-1.5 ${entry.my_vote === 1 ? 'border-brand dark:border-brand-light' : 'border-gray-200 dark:border-gray-600'}`}
            onPress={() => handleVoteAnswer(1)}
          >
            <ThumbsUp size={14} color={entry.my_vote === 1 ? (isDark ? '#5A9690' : '#2F5755') : (isDark ? '#9ca3af' : '#6b7280')} />
            <Text className={`text-xs font-semibold ${entry.my_vote === 1 ? 'text-brand dark:text-brand-light' : 'text-gray-500 dark:text-gray-400'}`}>{entry.upvotes || 0}</Text>
          </Pressable>
          <Pressable
            className={`flex-row items-center gap-[5px] border rounded-lg px-2.5 py-1.5 ${entry.my_vote === -1 ? 'border-red-600' : 'border-gray-200 dark:border-gray-600'}`}
            onPress={() => handleVoteAnswer(-1)}
          >
            <ThumbsDown size={14} color={entry.my_vote === -1 ? '#dc2626' : (isDark ? '#9ca3af' : '#6b7280')} />
            <Text className={`text-xs font-semibold ${entry.my_vote === -1 ? 'text-red-600' : 'text-gray-500 dark:text-gray-400'}`}>{entry.downvotes || 0}</Text>
          </Pressable>
        </View>
        {!!entry.author_name && (
          <Text className="text-[11px] text-gray-400 dark:text-gray-500 mt-3">
            {entry.author_name} tarafından {formatDate(entry.created_at)}
          </Text>
        )}
      </View>

      <View className="bg-white dark:bg-darkbgbutton rounded-2xl p-4 mb-3.5">
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
