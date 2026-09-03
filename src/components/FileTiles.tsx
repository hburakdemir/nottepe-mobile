import React from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { FileText, Image as ImageIcon, Table2 } from 'lucide-react-native';
import { getFileUrl } from '../lib/config';
import { fileKind, fileKindLabel, useFeedTokens } from '../theme/feedTokens';

interface Props {
  files: string[];
  // Akışta yalnızca ilk iki dosya kutucuğu gösteriliyor; kalanlar tek bir "+N"
  // butonunda toplanıyor (basınca onPressMore). Gönderi ekranında sınır yok.
  maxVisible?: number;
  onPressMore?: () => void;
}

// Dosyalar artık tek bir "Notu aç" şeridi değil: her dosya kendi kutucuğu,
// altında ne olduğu yazıyor (PDF / Word / Resim). Tür ikonları da ayrışıyor,
// böylece bir resmi bir PDF'ten ayırmak için etiketi okumaya gerek kalmıyor.
export default function FileTiles({ files, maxVisible, onPressMore }: Props) {
  const t = useFeedTokens();
  if (files.length === 0) return null;

  const limit = maxVisible ?? files.length;
  const visible = files.slice(0, limit);
  const hiddenCount = files.length - visible.length;

  return (
    <View style={styles.row}>
      {visible.map((fileName, index) => {
        const kind = fileKind(fileName);
        const Icon = kind === 'image' ? ImageIcon : kind === 'sheet' ? Table2 : FileText;
        return (
          <Pressable
            key={index}
            style={styles.item}
            onPress={() => Linking.openURL(getFileUrl(fileName))}
            accessibilityLabel={`${fileKindLabel(fileName)} dosyasını aç`}
          >
            <View style={[styles.tile, { backgroundColor: t.accent }]}>
              <Icon size={22} color={t.onAccent} strokeWidth={2} />
            </View>
            <Text style={[styles.label, { color: t.ink3 }]} numberOfLines={1}>
              {fileKindLabel(fileName)}
            </Text>
          </Pressable>
        );
      })}

      {hiddenCount > 0 && (
        <Pressable style={styles.item} onPress={onPressMore} accessibilityLabel={`${hiddenCount} dosya daha`}>
          <View style={[styles.tile, styles.tileMore, { backgroundColor: t.inset, borderColor: t.line }]}>
            <Text style={[styles.moreText, { color: t.ink2 }]}>+{hiddenCount}</Text>
          </View>
          <Text style={[styles.label, { color: t.ink3 }]} numberOfLines={1}>
            dosya
          </Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  item: { alignItems: 'center', gap: 6, width: 54 },
  tile: { width: 54, height: 54, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  tileMore: { borderWidth: 1 },
  moreText: { fontSize: 16, fontWeight: '700' },
  label: { fontSize: 11, fontWeight: '600' },
});
