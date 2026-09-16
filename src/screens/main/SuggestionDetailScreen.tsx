import React, { useCallback, useMemo } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRoute } from '@react-navigation/native';
import { Lightbulb } from 'lucide-react-native';
import { suggestionAPI } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useGoToUserProfile } from '../../hooks/useGoToUserProfile';
import ForumCommentList, { type ForumComment } from '../../components/forum/ForumCommentList';
import type { RootStackParamList } from '../../navigation/types';
import StateView from '../../components/StateView';
import { useDelayedLoading } from '../../hooks/useDelayedLoading';

const SUGGESTION_DETAIL_STALE_MS = 5 * 60 * 1000;

const suggestionDetailKey = (id: number) => ['suggestions', 'detail', id] as const;

// Modül seviyesinde sabit: her render'da yeni `[]` üretilseydi yorum listesinin
// prop'u sürekli değişir, memo'su hiç tutmazdı.
const EMPTY_COMMENTS: ForumComment[] = [];

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
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const goToUserProfile = useGoToUserProfile();
  const canModerate = user?.role === 'admin' || user?.role === 'moderator';

  const queryClient = useQueryClient();
  const queryKey = useMemo(() => suggestionDetailKey(id), [id]);

  // FaqDetailScreen ile aynı kalıp: öneri ve yorumları tek anahtarda, çünkü
  // ikisi her zaman birlikte çekiliyor ve ekran ikisi olmadan çizilemiyor.
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey,
    queryFn: async () => {
      const [suggestionRes, commentsRes] = await Promise.all([suggestionAPI.getById(id), suggestionAPI.getComments(id)]);
      return {
        suggestion: suggestionRes.data.suggestion as SuggestionDetail,
        comments: (commentsRes.data.comments || []) as ForumComment[],
      };
    },
    staleTime: SUGGESTION_DETAIL_STALE_MS,
  });
  // bkz. HomeScreen.tsx — aynı gecikmeli yükleme kuralı.
  const showLoading = useDelayedLoading(isLoading);

  const suggestion = data?.suggestion ?? null;
  const comments = data?.comments ?? EMPTY_COMMENTS;

  const patch = useCallback(
    (fn: (prev: { suggestion: SuggestionDetail; comments: ForumComment[] }) => { suggestion: SuggestionDetail; comments: ForumComment[] }) => {
      queryClient.setQueryData(queryKey, (prev: { suggestion: SuggestionDetail; comments: ForumComment[] } | undefined) =>
        prev ? fn(prev) : prev
      );
    },
    [queryClient, queryKey]
  );

  const handleAddComment = async (content: string, parentCommentId?: number | null) => {
    try {
      await suggestionAPI.addComment(id, content, parentCommentId ?? null);
      const res = await suggestionAPI.getComments(id);
      patch((prev) => ({ ...prev, comments: (res.data.comments || []) as ForumComment[] }));
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
            patch((prev) => ({ ...prev, comments: prev.comments.filter((c) => c.id !== commentId) }));
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
      patch((prev) => ({ ...prev, comments: prev.comments.map((c) => (c.id === commentId ? { ...c, ...res.data } : c)) }));
    } catch {
      Alert.alert('Hata', 'Oy verilemedi.');
    }
  };

  if (showLoading) {
    return (
      <View className="flex-1 items-center justify-center">
        <StateView kind="loading" loadingColor={isDark ? '#5A9690' : '#2F5755'} />
      </View>
    );
  }
  // bkz. FaqDetailScreen.tsx — gecikme dolmadan "bulunamadı" yanlışlıkla
  // yanıp sönmesin diye ara boş görünüm.
  if (isLoading) {
    return <View className="flex-1 bg-ground" />;
  }

  if (isError) {
    return (
      <View className="flex-1 items-center justify-center">
        <StateView kind="error" title="Öneri yüklenemedi." onAction={refetch} />
      </View>
    );
  }

  if (!suggestion) {
    return (
      <View className="flex-1 items-center justify-center">
        <StateView kind="empty" title="Öneri bulunamadı." />
      </View>
    );
  }

  return (
    <ScrollView showsVerticalScrollIndicator={false} className="flex-1 bg-ground" contentContainerClassName="p-4 pb-[110px]">
      <View className="bg-surface rounded-2xl p-4 mb-3.5">
        <View className="flex-row gap-2.5">
          <Lightbulb size={20} color={isDark ? '#5A9690' : '#2F5755'} style={{ marginTop: 2 }} />
          <Text className="flex-1 text-[15.5px] text-ink leading-[22px]">{suggestion.content}</Text>
        </View>
        <Pressable onPress={() => goToUserProfile(suggestion.username)}>
          <Text className="text-[11.5px] text-muted2 mt-3.5">
            <Text className="text-accent font-semibold">{suggestion.full_name}</Text> tarafından {formatDate(suggestion.created_at)}
          </Text>
        </Pressable>
      </View>

      <View className="bg-surface rounded-2xl p-4 mb-3.5">
        <ForumCommentList
          comments={comments}
          loading={isLoading}
          canModerate={canModerate}
          onAddComment={handleAddComment}
          onDeleteComment={handleDeleteComment}
          onVoteComment={handleVoteComment}
        />
      </View>
    </ScrollView>
  );
}
