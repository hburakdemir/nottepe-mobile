import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Modal, Pressable, Text, TextInput, View } from 'react-native';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ChevronRight, Inbox, MessageSquare, Plus, Send, X } from 'lucide-react-native';
import { faqAPI } from '../../lib/api';
import { useTheme } from '../../context/ThemeContext';
import KeyboardAvoider from '../../components/layout/KeyboardAvoider';
import { Skeleton, SkeletonGroup } from '../../components/Skeleton';
import type { RootStackParamList } from '../../navigation/types';

const PAGE_LIMIT = 20;

// SSS neredeyse statik: sorular moderasyondan geçerek yayınlanıyor, gün içinde
// değişmesi beklenmiyor. 24 saat taze — ekrana her girişte liste anında geliyor.
const FAQ_STALE_MS = 24 * 60 * 60 * 1000;

interface FaqPage {
  entries: FaqEntry[];
  total: number;
}

interface FaqEntry {
  id: number;
  question: string;
  answer: string;
  comment_count: number;
  author_name?: string;
}

export default function FaqScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [askModalOpen, setAskModalOpen] = useState(false);
  const [question, setQuestion] = useState('');
  const [asking, setAsking] = useState(false);

  // Sayfalama artık elle tutulan `page`/`total`/`entries` üçlüsüyle değil,
  // useInfiniteQuery ile. Kazanç yalnızca kod sadeliği değil: ekrandan çıkıp
  // geri gelindiğinde OKUNMUŞ SAYFALAR CACHE'TE DURUYOR — kullanıcı "Daha
  // Fazla Göster"e üç kez bastıysa, geri döndüğünde yine üç sayfayı da görüyor
  // ve hiçbiri yeniden istenmiyor. Eskiden liste her girişte 1. sayfaya
  // sıfırlanıyordu.
  const { data, isLoading, isError, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ['faq', 'list'],
    queryFn: async ({ pageParam }) => {
      const res = await faqAPI.getAll({ page: pageParam, limit: PAGE_LIMIT });
      return res.data as FaqPage;
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => {
      const loaded = allPages.reduce((sum, p) => sum + p.entries.length, 0);
      return loaded < lastPage.total ? allPages.length + 1 : undefined;
    },
    staleTime: FAQ_STALE_MS,
  });

  const entries = useMemo(() => data?.pages.flatMap((p) => p.entries) ?? [], [data]);

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
    <View className="mb-3.5">
      {/* Ekran içi "Sizin Sorularınız" başlığı ve alt yazısı kaldırıldı — üst
          bar zaten sayfa adını yazıyor. Kapsayıcı "Soru Sor" butonu için kaldı. */}
      <Pressable
        className="flex-row items-center justify-center gap-2 bg-brand rounded-[10px] py-3"
        onPress={() => setAskModalOpen(true)}
      >
        <Plus size={15} color="#fff" />
        <Text className="text-white text-[13.5px] font-bold">Soru Sor</Text>
      </Pressable>
    </View>
  );

  const renderItem = useCallback(
    ({ item }: { item: FaqEntry }) => (
      <Pressable
        className="flex-row items-start gap-2.5 bg-surface rounded-xl p-3.5 mb-2.5"
        onPress={() => navigation.navigate('FaqDetail', { id: item.id })}
      >
        <View className="flex-1">
          <Text className="text-[14.5px] font-bold text-ink">{item.question}</Text>
          <Text className="text-[12.5px] text-muted mt-1 leading-[17px]" numberOfLines={2}>
            {item.answer}
          </Text>
          <View className="flex-row items-center gap-[5px] mt-2">
            <MessageSquare size={12} color={isDark ? '#9ca3af' : '#6b7280'} />
            <Text className="text-[11px] text-muted2">{item.comment_count} yorum</Text>
            {!!item.author_name && <Text className="text-[11px] text-muted2">· {item.author_name}</Text>}
          </View>
        </View>
        <ChevronRight size={18} color={isDark ? '#4b5563' : '#d1d5db'} />
      </Pressable>
    ),
    [navigation, isDark]
  );

  return (
    <View className="flex-1 bg-ground">
      {isLoading ? (
        // Çark yerine listenin kendi şekli: aynı kart yüksekliği, aynı iki
        // satırlık metin bloğu. Veri gelince yerleşim yerinden oynamıyor.
        <SkeletonGroup>
          <View className="p-4 gap-2.5">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <View key={i} className="bg-surface rounded-xl p-3.5 border border-line-soft gap-2">
                <Skeleton width="85%" height={14} />
                <Skeleton width="45%" height={11} />
              </View>
            ))}
          </View>
        </SkeletonGroup>
      ) : (
        <FlatList
          showsVerticalScrollIndicator={false}
          contentContainerClassName="p-4 pb-[110px]"
          data={entries}
          keyExtractor={(item) => String(item.id)}
          // KAPALI: satırlar dokunulabilir (detaya gidiyor) ve bu prop'un
          // Android'de ekrandan çıkıp giren satırlarda dokunuş yutması bilinen
          // bir sorun. Aynı gerekçe Fakülteler, Profil ve Liderlik'te de yazılı.
          removeClippedSubviews={false}
          maxToRenderPerBatch={6}
          windowSize={7}
          initialNumToRender={6}
          ListHeaderComponent={header}
          renderItem={renderItem}
          ListEmptyComponent={
            // Hata ile "gerçekten boş" ayrı ayrı söyleniyor. Eskiden hata
            // durumunda `Alert` çıkıyordu; arka planda sessizce tazelenen bir
            // sorgu için uyarı kutusu açmak yanlış — hata listenin yerinde
            // durmalı, kullanıcının önünü kesmemeli.
            <View className="items-center py-[50px] gap-2.5">
              <Inbox size={40} color={isDark ? '#4b5563' : '#d1d5db'} />
              <Text className="text-muted2 text-[13.5px]">
                {isError ? 'Sorular yüklenemedi.' : 'Henüz bir kayıt eklenmemiş.'}
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

      <Modal visible={askModalOpen} transparent animationType="fade" onRequestClose={() => setAskModalOpen(false)}>
        <KeyboardAvoider>
          <View className="flex-1 bg-black/50 justify-center p-4">
            <View className="bg-surface rounded-2xl p-5">
              <View className="flex-row items-center justify-between mb-3.5">
                <Text className="text-base font-bold text-ink">Soru Sor</Text>
                <Pressable onPress={() => setAskModalOpen(false)} hitSlop={8}>
                  <X size={20} color={isDark ? '#9ca3af' : '#6b7280'} />
                </Pressable>
              </View>
              <TextInput
                className="border border-line rounded-[10px] px-3 py-2.5 text-sm text-ink min-h-[90px]"
                style={{ textAlignVertical: 'top' }}
                value={question}
                onChangeText={setQuestion}
                maxLength={500}
                multiline
                placeholder="Merak ettiğin soruyu yaz..."
                placeholderTextColor="#9ca3af"
              />
              <Pressable
                className={`flex-row items-center justify-center gap-2 bg-brand rounded-[10px] py-3 mt-3.5 ${asking || !question.trim() ? 'opacity-60' : ''}`}
                onPress={handleAskSubmit}
                disabled={asking || !question.trim()}
              >
                <Send size={15} color="#fff" />
                <Text className="text-white text-sm font-bold">{asking ? 'Gönderiliyor...' : 'Gönder'}</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoider>
      </Modal>
    </View>
  );
}
