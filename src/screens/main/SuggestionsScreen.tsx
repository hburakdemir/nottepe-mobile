import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, Text, TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ChevronRight, Inbox, Lightbulb, MessageSquare, Send } from 'lucide-react-native';
import { suggestionAPI } from '../../lib/api';
import { useTheme } from '../../context/ThemeContext';
import type { RootStackParamList } from '../../navigation/types';

const PAGE_LIMIT = 20;

interface Suggestion {
  id: number;
  content: string;
  full_name: string;
  comment_count: number;
}

export default function SuggestionsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchSuggestions = async (targetPage: number, reset = false) => {
    if (reset) setLoading(true);
    else setLoadingMore(true);
    try {
      const res = await suggestionAPI.getAll({ page: targetPage, limit: PAGE_LIMIT });
      const { suggestions: rows, total: newTotal } = res.data;
      setSuggestions((prev) => (reset ? rows : [...prev, ...rows]));
      setTotal(newTotal);
      setPage(targetPage);
    } catch {
      Alert.alert('Hata', 'Öneriler yüklenemedi.');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    fetchSuggestions(1, true);
  }, []);

  const hasMore = suggestions.length < total;

  const handleSubmit = async () => {
    if (!text.trim()) return;
    setSubmitting(true);
    try {
      await suggestionAPI.create(text.trim());
      setText('');
      fetchSuggestions(1, true);
    } catch (err: any) {
      Alert.alert('Hata', err.response?.data?.message || 'Öneri paylaşılamadı.');
    } finally {
      setSubmitting(false);
    }
  };

  const header = (
    <View className="mb-3.5">
      <View className="flex-row items-center gap-2.5">
        <Lightbulb size={22} color={isDark ? '#5A9690' : '#2F5755'} />
        <Text className="text-[22px] font-extrabold text-gray-900 dark:text-darktext">Öneriler</Text>
      </View>
      <Text className="text-[12.5px] text-gray-500 dark:text-gray-400 mt-1.5">Nottepe'yi nasıl daha iyi yapabiliriz? Önerini paylaş, tartışalım.</Text>

      <View className="bg-white dark:bg-darkbgbutton rounded-2xl p-3.5 mt-3.5">
        <TextInput
          className="border border-gray-300 dark:border-gray-600 rounded-[10px] px-3 py-2.5 text-[13.5px] text-gray-900 dark:text-darktext min-h-[70px]"
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

  return (
    <View className="flex-1 bg-gray-50 dark:bg-darkbg">
      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={isDark ? '#5A9690' : '#2F5755'} />
        </View>
      ) : (
        <FlatList
          contentContainerClassName="p-4 pb-10"
          data={suggestions}
          keyExtractor={(item) => String(item.id)}
          ListHeaderComponent={header}
          renderItem={({ item }) => (
            <Pressable className="flex-row items-start gap-2.5 bg-white dark:bg-darkbgbutton rounded-xl p-3.5 mb-2.5" onPress={() => navigation.navigate('SuggestionDetail', { id: item.id })}>
              <View className="flex-1">
                <Text className="text-[13.5px] text-gray-800 dark:text-darktext leading-[19px]" numberOfLines={3}>
                  {item.content}
                </Text>
                <View className="flex-row items-center gap-[5px] mt-2">
                  <Text className="text-[11px] text-gray-400 dark:text-gray-500">{item.full_name}</Text>
                  <MessageSquare size={12} color={isDark ? '#6b7280' : '#9ca3af'} />
                  <Text className="text-[11px] text-gray-400 dark:text-gray-500">{item.comment_count} yorum</Text>
                </View>
              </View>
              <ChevronRight size={18} color={isDark ? '#6b7280' : '#d1d5db'} />
            </Pressable>
          )}
          ListEmptyComponent={
            <View className="items-center py-[50px] gap-2.5">
              <Inbox size={40} color={isDark ? '#6b7280' : '#d1d5db'} />
              <Text className="text-gray-400 dark:text-gray-500 text-[13.5px]">Henüz öneri paylaşılmamış.</Text>
            </View>
          }
          ListFooterComponent={
            hasMore ? (
              <Pressable className="items-center border border-brand dark:border-brand-light rounded-[10px] py-3 mt-2" onPress={() => fetchSuggestions(page + 1)} disabled={loadingMore}>
                {loadingMore ? <ActivityIndicator color={isDark ? '#5A9690' : '#2F5755'} /> : <Text className="text-brand dark:text-brand-light text-[13px] font-semibold">Daha Fazla Göster</Text>}
              </Pressable>
            ) : null
          }
        />
      )}
    </View>
  );
}
