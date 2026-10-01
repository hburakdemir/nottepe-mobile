import React, { useEffect, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FileText, Trash2, X } from 'lucide-react-native';
import { useThemeColors } from '../../context/ThemeContext';
import { clearFileCache, deleteCachedFile, listCachedFiles, type CachedFileEntry } from '../../lib/fileCache';
import { fileKindLabel } from '../../theme/feedTokens';

interface Props {
  visible: boolean;
  onClose: () => void;
}

/** "12,4 MB" / "830 KB" — Türkçe ondalık virgülüyle. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toLocaleString('tr-TR', { maximumFractionDigits: 1 })} MB`;
}

function formatDate(ms: number): string {
  if (!ms) return '';
  return new Date(ms).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' });
}

// Görüntüleyicide açılan eklerin önbelleği (bkz. lib/fileCache.ts). Kabuk
// NotificationSettingsSheet ile aynı ölçülerde — Ayarlar'daki paneller yan
// yana aynı bileşen gibi dursun.
export default function FileCacheSheet({ visible, onClose }: Props) {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const [entries, setEntries] = useState<CachedFileEntry[]>([]);

  const reload = () => setEntries(listCachedFiles());

  useEffect(() => {
    if (visible) reload();
  }, [visible]);

  const total = entries.reduce((sum, e) => sum + e.size, 0);

  const confirmClear = () => {
    Alert.alert('Tümünü temizle', 'İndirilen dosyalar silinecek. Tekrar açtığında internetten yeniden indirilir.', [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Temizle',
        style: 'destructive',
        onPress: () => {
          clearFileCache();
          reload();
        },
      },
    ]);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable className="flex-1 justify-end" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} onPress={onClose}>
        <Pressable
          className="bg-surface rounded-t-[18px] px-4 pt-4 max-h-[85%]"
          style={{ paddingBottom: Math.max(insets.bottom, 16) + 8 }}
          onPress={() => {}}
        >
          <View className="flex-row items-center justify-between mb-1">
            <Text className="text-ink text-base font-bold flex-1" numberOfLines={1}>
              İndirilen dosyalar
            </Text>
            <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Kapat">
              <X size={20} color={colors.muted} />
            </Pressable>
          </View>
          <Text className="text-muted text-[12.5px] leading-[17px] mb-3">
            Açtığın notlar internetsiz de açılabilsin diye telefonda tutuluyor. 14 günden eskiler kendiliğinden siliniyor.
          </Text>

          {entries.length === 0 ? (
            <Text className="text-muted text-[13.5px] text-center my-8">Telefonda tutulan dosya yok.</Text>
          ) : (
            <>
              <ScrollView showsVerticalScrollIndicator={false}>
                {entries.map((entry) => (
                  <View key={entry.key} className="flex-row items-center gap-3 py-2.5 border-b border-line-soft">
                    <FileText size={18} color={colors.muted} />
                    <View className="flex-1">
                      <Text className="text-ink text-[14px] font-semibold" numberOfLines={1}>
                        {entry.title ?? fileKindLabel(entry.key)}
                      </Text>
                      <Text className="text-muted text-[12px] mt-0.5">
                        {[formatBytes(entry.size), formatDate(entry.at)].filter(Boolean).join(' · ')}
                      </Text>
                    </View>
                    <Pressable
                      hitSlop={10}
                      accessibilityLabel="Sil"
                      onPress={() => {
                        deleteCachedFile(entry.key);
                        reload();
                      }}
                    >
                      <Trash2 size={18} color={colors.danger} />
                    </Pressable>
                  </View>
                ))}
              </ScrollView>

              <Pressable
                onPress={confirmClear}
                className="mt-4 flex-row items-center justify-center gap-2 rounded-[12px] py-3 bg-danger-soft border border-danger-line active:opacity-80"
              >
                <Trash2 size={16} color={colors.danger} />
                <Text className="text-danger text-[14px] font-bold">Tümünü temizle ({formatBytes(total)})</Text>
              </Pressable>
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}
