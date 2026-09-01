import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { useRoute } from '@react-navigation/native';
import { Lightbulb } from 'lucide-react-native';
import { suggestionAPI } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { useGoToUserProfile } from '../../hooks/useGoToUserProfile';
import ForumCommentList, { type ForumComment } from '../../components/forum/ForumCommentList';
import type { RootStackParamList } from '../../navigation/types';

interface SuggestionDetail {
  id: number;
  content: string;
  username: string;
  full_name: string;
  created_at: string;
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' });
}

export default function SuggestionDetailScreen() {
  const route = useRoute<any>();
  const { id } = route.params as RootStackParamList['SuggestionDetail'];
  const { user } = useAuth();
  const goToUserProfile = useGoToUserProfile();
  const canModerate = user?.role === 'admin' || user?.role === 'moderator';

  const [suggestion, setSuggestion] = useState<SuggestionDetail | null>(null);
  const [comments, setComments] = useState<ForumComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [commentsLoading, setCommentsLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setCommentsLoading(true);
    try {
      const [suggestionRes, commentsRes] = await Promise.all([suggestionAPI.getById(id), suggestionAPI.getComments(id)]);
      setSuggestion(suggestionRes.data.suggestion);
      setComments(commentsRes.data.comments || []);
    } catch {
      Alert.alert('Hata', 'Öneri yüklenemedi.');
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
      await suggestionAPI.addComment(id, content, parentCommentId ?? null);
      const res = await suggestionAPI.getComments(id);
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
            await suggestionAPI.deleteComment(commentId, '');
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
      const res = await suggestionAPI.voteComment(commentId, vote);
      setComments((prev) => prev.map((c) => (c.id === commentId ? { ...c, ...res.data } : c)));
    } catch {
      Alert.alert('Hata', 'Oy verilemedi.');
    }
  };

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" color="#2F5755" />
      </View>
    );
  }

  if (!suggestion) {
    return (
      <View className="flex-1 items-center justify-center">
        <Text className="text-gray-500 text-sm">Öneri bulunamadı.</Text>
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-gray-50" contentContainerClassName="p-4 pb-10">
      <View className="bg-white rounded-2xl p-4 mb-3.5">
        <View className="flex-row gap-2.5">
          <Lightbulb size={20} color="#2F5755" style={{ marginTop: 2 }} />
          <Text className="flex-1 text-[15.5px] text-gray-900 leading-[22px]">{suggestion.content}</Text>
        </View>
        <Pressable onPress={() => goToUserProfile(suggestion.username)}>
          <Text className="text-[11.5px] text-gray-400 mt-3.5">
            <Text className="text-brand font-semibold">{suggestion.full_name}</Text> tarafından {formatDate(suggestion.created_at)}
          </Text>
        </Pressable>
      </View>

      <View className="bg-white rounded-2xl p-4 mb-3.5">
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
