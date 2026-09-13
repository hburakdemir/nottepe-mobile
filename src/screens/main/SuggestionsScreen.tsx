import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, Text, TextInput, View } from 'react-native';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ChevronRight, Inbox, MessageSquare, Send } from 'lucide-react-native';
import { suggestionAPI } from '../../lib/api';
import { useTheme } from '../../context/ThemeContext';
import { Skeleton, SkeletonGroup } from '../../components/Skeleton';
import type { RootStackParamList } from '../../navigation/types';

const PAGE_LIMIT = 20;

interface Suggestion {
  id: number;
  content: string;
  full_name: string;
  comment_count: number;
}

// Öneriler akışı yavaş değişiyor ama kullanıcının kendi önerisi gönderildiği
// anda listenin başında görünmeli — o yüzden gönderimden sonra anahtar
// geçersiz kılınıyor, tazelik süresi de kısa tutulmuyor.
const SUGGESTIONS_STALE_MS = 5 * 60 * 1000;

const SUGGESTIONS_KEY = ['suggestions', 'list'] as const;

interface SuggestionsPage {
  suggestions: Suggestion[];
  total: number;
}

export default function SuggestionsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const queryClient = useQueryClient();

  const { data, isLoading, isError, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: SUGGESTIONS_KEY,
    queryFn: async ({ pageParam }) => {
      const res = await suggestionAPI.getAll({ page: pageParam, limit: PAGE_LIMIT });
      return res.data as SuggestionsPage;
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => {
      const loaded = allPages.reduce((sum, p) => sum + p.suggestions.length, 0);
      return loaded < lastPage.total ? allPages.length + 1 : undefined;
    },
    staleTime: SUGGESTIONS_STALE_MS,
  });

  const suggestions = useMemo(() => data?.pages.flatMap((p) => p.suggestions) ?? [], [data]);

  const handleSubmit = async () => {
    if (!text.trim()) return;
    setSubmitting(true);
    try {
      await suggestionAPI.create(text.trim());
      setText('');
      // Kendi önerisi listenin başında görünsün: tüm sayfalar atılıp ilk
      // sayfa yeniden çekiliyor.
      queryClient.invalidateQueries({ queryKey: SUGGESTIONS_KEY });
    } catch (err: any) {
      Alert.alert('Hata', err.response?.data?.message || 'Öneri paylaşılamadı.');
    } finally {
      setSubmitting(false);
    }
  };

  const header = (
    <View className="mb-3.5">
      {/* Ekran içi "Öneriler" başlığı ve alt yazısı kaldırıldı — üst bar zaten
          sayfa adını yazıyor. Kapsayıcı öneri yazma kutusu için kaldı. */}
      <View className="bg-surface rounded-2xl p-3.5">
        <TextInput
          className="border border-line rounded-[10px] px-3 py-2.5 text-[13.5px] text-ink min-h-[70px]"
          style={{ textAlignVertical: 'top' }}
          value={text}
          onChangeText={setText}
          maxLength={4000}
          multiline
          placeholder="Önerini yaz..."
          placeholderTextColor="#9ca3af"
        />
        <Pressable
          className={`flex-row items-center justify-center gap-2 bg-brand rounded-[10px] py-[11px] mt-2.5 self-end px-[18px] ${submitting || !text.trim() ? 'opacity-60' : ''}`}
          onPress={handleSubmit}
          disabled={submitting || !text.trim()}
        >
          <Send size={14} color="#fff" />
          <Text className="text-white text-[13px] font-bold">Paylaş</Text>
        </Pressable>
      </View>
    </View>
  );

  const renderItem = useCallback(
    ({ item }: { item: Suggestion }) => (
      <Pressable
        className="flex-row items-start gap-2.5 bg-surface rounded-xl p-3.5 mb-2.5"
        onPress={() => navigation.navigate('SuggestionDetail', { id: item.id })}
      >
        <View className="flex-1">
          <Text className="text-[13.5px] text-ink2 leading-[19px]" numberOfLines={3}>
            {item.content}
          </Text>
          <View className="flex-row items-center gap-[5px] mt-2">
            <Text className="text-[11px] text-muted2">{item.full_name}</Text>
            <MessageSquare size={12} color={isDark ? '#6b7280' : '#9ca3af'} />
            <Text className="text-[11px] text-muted2">{item.comment_count} yorum</Text>
          </View>
        </View>
        <ChevronRight size={18} color={isDark ? '#6b7280' : '#d1d5db'} />
      </Pressable>
    ),
    [navigation, isDark]
  );

  return (
    <View className="flex-1 bg-ground">
      {isLoading ? (
        <SkeletonGroup>
          <View className="p-4 gap-2.5">
            {[0, 1, 2, 3, 4].map((i) => (
              <View key={i} className="bg-surface rounded-xl p-3.5 border border-line-soft gap-2">
                <Skeleton width="90%" height={13} />
                <Skeleton width="60%" height={13} />
                <Skeleton width="35%" height={10} />
              </View>
            ))}
          </View>
        </SkeletonGroup>
      ) : (
        <FlatList
          showsVerticalScrollIndicator={false}
          contentContainerClassName="p-4 pb-[110px]"
          data={suggestions}
          keyExtractor={(item) => String(item.id)}
          // KAPALI: satırlar dokunulabilir (detaya gidiyor); bu prop'un
          // Android'de dokunuş yutması bilinen bir sorun.
          removeClippedSubviews={false}
          maxToRenderPerBatch={6}
          windowSize={7}
          initialNumToRender={6}
          ListHeaderComponent={header}
          renderItem={renderItem}
          ListEmptyComponent={
            <View className="items-center py-[50px] gap-2.5">
              <Inbox size={40} color={isDark ? '#6b7280' : '#d1d5db'} />
              <Text className="text-muted2 text-[13.5px]">
                {isError ? 'Öneriler yüklenemedi.' : 'Henüz öneri paylaşılmamış.'}
              </Text>
            </View>
          }
          ListFooterComponent={
            hasNextPage ? (
              <Pressable
                className="items-center border border-accent rounded-[10px] py-3 mt-2"
                onPress={() => fetchNextPage()}
                disabled={isFetchingNextPage}
              >
                {isFetchingNextPage ? (
                  <ActivityIndicator color={isDark ? '#5A9690' : '#2F5755'} />
                ) : (
                  <Text className="text-accent text-[13px] font-semibold">Daha Fazla Göster</Text>
                )}
              </Pressable>
            ) : null
          }
        />
      )}
    </View>
  );
}
