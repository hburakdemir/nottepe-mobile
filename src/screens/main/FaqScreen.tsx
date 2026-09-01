import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Modal, Pressable, Text, TextInput, View } from 'react-native';
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
    <View className="mb-3.5">
      <View className="flex-row items-center gap-2.5">
        <HelpCircle size={22} color="#2F5755" />
        <Text className="text-[22px] font-extrabold text-gray-900">Sık Sorulan Sorular</Text>
      </View>
      <Text className="text-[12.5px] text-gray-500 mt-1.5">Merak edilenler ve Nottepelilerin bu konulardaki tartışmaları.</Text>
      <Pressable className="flex-row items-center justify-center gap-2 bg-brand rounded-[10px] py-3 mt-3.5" onPress={() => setAskModalOpen(true)}>
        <Plus size={15} color="#fff" />
        <Text className="text-white text-[13.5px] font-bold">Soru Sor</Text>
      </Pressable>
    </View>
  );

  return (
    <View className="flex-1 bg-gray-50">
      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#2F5755" />
        </View>
      ) : (
        <FlatList
          contentContainerClassName="p-4 pb-10"
          data={entries}
          keyExtractor={(item) => String(item.id)}
          ListHeaderComponent={header}
          renderItem={({ item }) => (
            <Pressable className="flex-row items-start gap-2.5 bg-white rounded-xl p-3.5 mb-2.5" onPress={() => navigation.navigate('FaqDetail', { id: item.id })}>
              <View className="flex-1">
                <Text className="text-[14.5px] font-bold text-gray-900">{item.question}</Text>
                <Text className="text-[12.5px] text-gray-500 mt-1 leading-[17px]" numberOfLines={2}>
                  {item.answer}
                </Text>
                <View className="flex-row items-center gap-[5px] mt-2">
                  <MessageSquare size={12} color="#9ca3af" />
                  <Text className="text-[11px] text-gray-400">{item.comment_count} yorum</Text>
                  {!!item.author_name && <Text className="text-[11px] text-gray-400">· {item.author_name}</Text>}
                </View>
              </View>
              <ChevronRight size={18} color="#d1d5db" />
            </Pressable>
          )}
          ListEmptyComponent={
            <View className="items-center py-[50px] gap-2.5">
              <Inbox size={40} color="#d1d5db" />
              <Text className="text-gray-400 text-[13.5px]">Henüz bir kayıt eklenmemiş.</Text>
            </View>
          }
          ListFooterComponent={
            hasMore ? (
              <Pressable className="items-center border border-brand rounded-[10px] py-3 mt-2" onPress={() => fetchEntries(page + 1)} disabled={loadingMore}>
                {loadingMore ? <ActivityIndicator color="#2F5755" /> : <Text className="text-brand text-[13px] font-semibold">Daha Fazla Göster</Text>}
              </Pressable>
            ) : null
          }
        />
      )}

      <Modal visible={askModalOpen} transparent animationType="fade" onRequestClose={() => setAskModalOpen(false)}>
        <View className="flex-1 bg-black/50 justify-center p-4">
          <View className="bg-white rounded-2xl p-5">
            <View className="flex-row items-center justify-between mb-3.5">
              <Text className="text-[17px] font-bold text-gray-900">Soru Sor</Text>
              <Pressable onPress={() => setAskModalOpen(false)} hitSlop={8}>
                <X size={20} color="#6b7280" />
              </Pressable>
            </View>
            <TextInput
              className="border border-gray-300 rounded-[10px] px-3 py-2.5 text-sm text-gray-900 min-h-[90px]"
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
      </Modal>
    </View>
  );
}
