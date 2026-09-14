import React, { useCallback, useMemo } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRoute } from '@react-navigation/native';
import { HelpCircle, ThumbsDown, ThumbsUp } from 'lucide-react-native';
import { Pressable } from 'react-native';
import { faqAPI } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import ForumCommentList, { type ForumComment } from '../../components/forum/ForumCommentList';
import type { RootStackParamList } from '../../navigation/types';
import StateView from '../../components/StateView';

// Soru ve cevabı moderasyondan geçiyor, sık değişmiyor; ama yorumlar ve oylar
// canlı. Bu yüzden liste ekranının 24 saati yerine daha kısa bir tazelik:
// geri gidip tekrar girince yeni yorum görünsün, ama aynı oturumda ileri-geri
// gidip gelmek yeniden istek atmasın.
const FAQ_DETAIL_STALE_MS = 5 * 60 * 1000;

const faqDetailKey = (id: number) => ['faq', 'detail', id] as const;

// Modül seviyesinde sabit: her render'da yeni `[]` üretilseydi CommentSection'ın
// prop'u sürekli değişir, memo'su hiç tutmazdı.
const EMPTY_COMMENTS: ForumComment[] = [];

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

  const queryClient = useQueryClient();
  const queryKey = useMemo(() => faqDetailKey(id), [id]);

  // Kayıt ve yorumları TEK anahtarda tutuyoruz: ikisi her zaman birlikte
  // çekiliyor ve ekran ikisi olmadan çizilemiyor, dolayısıyla ayırmanın
  // kullanıcıya bir faydası olmazdı — sadece iki ayrı yükleme durumu doğardı.
  // Hata durumu react-query'nin kendi `isError`'ı; eskiden bunun için elle
  // `loadError` bayrağı tutuluyordu.
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey,
    queryFn: async () => {
      const [entryRes, commentsRes] = await Promise.all([faqAPI.getById(id), faqAPI.getComments(id)]);
      return {
        entry: entryRes.data.entry as FaqEntryDetail,
        comments: (commentsRes.data.comments || []) as ForumComment[],
      };
    },
    staleTime: FAQ_DETAIL_STALE_MS,
  });

  const entry = data?.entry ?? null;
  const comments = data?.comments ?? EMPTY_COMMENTS;

  // Aşağıdaki dört işlem cache'i DOĞRUDAN yazıyor (`invalidateQueries` değil):
  // sunucu zaten güncel satırı döndürüyor, yeniden istek atmak hem gereksiz
  // hem de ekranın yanıp sönmesine yol açardı. Oy verme gibi anlık geri
  // bildirim isteyen yerlerde fark belirgin.
  const patch = useCallback(
    (fn: (prev: { entry: FaqEntryDetail; comments: ForumComment[] }) => { entry: FaqEntryDetail; comments: ForumComment[] }) => {
      queryClient.setQueryData(queryKey, (prev: { entry: FaqEntryDetail; comments: ForumComment[] } | undefined) =>
        prev ? fn(prev) : prev
      );
    },
    [queryClient, queryKey]
  );

  const handleAddComment = async (content: string, parentCommentId?: number | null) => {
    try {
      await faqAPI.addComment(id, content, parentCommentId ?? null);
      const res = await faqAPI.getComments(id);
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
            await faqAPI.deleteComment(commentId, '');
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
      const res = await faqAPI.voteComment(commentId, vote);
      patch((prev) => ({ ...prev, comments: prev.comments.map((c) => (c.id === commentId ? { ...c, ...res.data } : c)) }));
    } catch {
      Alert.alert('Hata', 'Oy verilemedi.');
    }
  };

  const handleVoteAnswer = async (vote: number) => {
    try {
      const res = await faqAPI.voteAnswer(id, vote);
      patch((prev) => ({ ...prev, entry: { ...prev.entry, ...res.data } }));
    } catch {
      Alert.alert('Hata', 'Oy verilemedi.');
    }
  };

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center">
        <StateView kind="loading" loadingColor={isDark ? '#5A9690' : '#2F5755'} />
      </View>
    );
  }

  if (isError) {
    return (
      <View className="flex-1 items-center justify-center">
        <StateView kind="error" title="Kayıt yüklenemedi." onAction={refetch} />
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
