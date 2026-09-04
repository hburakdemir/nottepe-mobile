import React, { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Check, Search, X } from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';
import KeyboardAvoider from './KeyboardAvoider';

export interface OptionItem {
  value: string;
  label: string;
}

interface Props {
  visible: boolean;
  title: string;
  options: readonly (string | OptionItem)[];
  value?: string;
  onSelect: (value: string) => void;
  onClose: () => void;
  /** Listenin en üstüne "hepsi/temizle" satırı ekler; seçilince '' döner. */
  allLabel?: string;
  /** Arama kutusu. Verilmezse 8'den uzun listelerde otomatik açılır. */
  searchable?: boolean;
  searchPlaceholder?: string;
  emptyText?: string;
}

const AUTO_SEARCH_THRESHOLD = 8;

function toItem(o: string | OptionItem): OptionItem {
  return typeof o === 'string' ? { value: o, label: o } : o;
}

// Uygulamadaki TEK "listeden bir şey seç" arayüzü.
//
// Öncesinde aynı iş 9 ayrı yerde 9 farklı şekilde yazılmıştı: kimi FlatList
// kimi ScrollView, kiminde başlık vardı kiminde yoktu, kiminde X vardı, sadece
// birinde seçili satır tik alıyordu, birinde zemine dokununca kapanmıyordu,
// yükseklik sınırı 70%/75%/420px/380px olarak dört farklı değerdeydi. Artık
// hepsi buradan geliyor: alttan açılan tek bir sayfa, başlık + kapat, uzun
// listelerde arama, seçili satırda tik.
export default function OptionSheet({
  visible,
  title,
  options,
  value,
  onSelect,
  onClose,
  allLabel,
  searchable,
  searchPlaceholder = 'Ara...',
  emptyText = 'Sonuç bulunamadı',
}: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');

  const items = useMemo(() => options.map(toItem), [options]);
  const showSearch = searchable ?? items.length > AUTO_SEARCH_THRESHOLD;

  const data = useMemo(() => {
    const base = allLabel ? [{ value: '', label: allLabel }, ...items] : items;
    const q = query.trim().toLocaleLowerCase('tr');
    if (!q) return base;
    return base.filter((o) => o.label.toLocaleLowerCase('tr').includes(q));
  }, [items, allLabel, query]);

  const close = () => {
    setQuery('');
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <KeyboardAvoider>
        {/* Zemine dokunmak kapatıyor — eskiden bazı seçicilerde çalışıyor,
            bazılarında (KvkkGateModal) hiç çalışmıyordu. */}
        <Pressable className="flex-1 justify-end" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} onPress={close}>
          {/* İç panelde onPress'i yutuyoruz ki panele dokunmak sayfayı kapatmasın. */}
          {/* Alt güvenli alan payı: jest çubuğu olan cihazlarda son satır
              çubuğun altında kalmasın. */}
          <Pressable
            className="bg-surface rounded-t-[18px] px-4 pt-4 max-h-[75%]"
            style={{ paddingBottom: Math.max(insets.bottom, 16) + 8 }}
            onPress={() => {}}
          >
            <View className="flex-row items-center justify-between mb-2">
              <Text className="text-ink text-base font-bold flex-1" numberOfLines={1}>
                {title}
              </Text>
              <Pressable onPress={close} hitSlop={10} accessibilityLabel="Kapat">
                <X size={20} color={colors.muted} />
              </Pressable>
            </View>

            {showSearch && (
              <View className="flex-row items-center gap-2 bg-inset border border-line rounded-[10px] px-3 mb-2">
                <Search size={16} color={colors.muted2} />
                <TextInput
                  className="flex-1 py-2.5 text-[13.5px] text-ink"
                  value={query}
                  onChangeText={setQuery}
                  placeholder={searchPlaceholder}
                  placeholderTextColor={colors.muted2}
                />
              </View>
            )}

            <FlatList
              showsVerticalScrollIndicator={false}
              data={data}
              keyExtractor={(item) => item.value || '__all__'}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={<Text className="text-muted2 text-[13px] text-center py-6">{emptyText}</Text>}
              renderItem={({ item }) => {
                const selected = value === item.value;
                return (
                  <Pressable
                    className="flex-row items-center gap-3 py-3 border-b border-line-soft active:bg-inset"
                    onPress={() => {
                      onSelect(item.value);
                      close();
                    }}
                  >
                    <Text className={`flex-1 text-sm ${selected ? 'text-accent font-bold' : 'text-ink2'}`} numberOfLines={2}>
                      {item.label}
                    </Text>
                    {selected && <Check size={18} color={colors.accent} />}
                  </Pressable>
                );
              }}
            />
          </Pressable>
        </Pressable>
      </KeyboardAvoider>
    </Modal>
  );
}
