import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Share2 } from 'lucide-react-native';
import BackButton from '../layout/BackButton';
import { fileKindLabel } from '../../theme/feedTokens';
import { VIEWER_CHROME, VIEWER_INK, VIEWER_INK_DIM, VIEWER_LINE } from './viewerTokens';

interface Props {
  fileName: string;
  position: number;
  total: number;
  topInset: number;
  sharing: boolean;
  onShare: () => void;
}

// Görüntüleyicinin kendi başlığı. Ortak `AppHeader` bilerek kullanılmıyor: sağ
// tarafında her ekranda sabit duran bildirim zili ve "not ekle" butonunu
// taşıyor (bir PDF okurken ikisinin de işi yok) ve paylaşım aksiyonu için bir
// prop'u yok. Gerekçenin tamamı FileViewerScreen.tsx'in başında.
export default function FileViewerHeader({
  fileName,
  position,
  total,
  topInset,
  sharing,
  onShare,
}: Props) {
  return (
    <View style={[styles.bar, { paddingTop: topInset }]}>
      <View style={styles.row}>
        <View style={styles.side}>
          <BackButton tintColor={VIEWER_INK} />
        </View>

        <View style={styles.center}>
          <Text style={styles.label} numberOfLines={1}>
            {fileKindLabel(fileName)}
          </Text>
          {/* Tek dosyalı gönderide sayaç gürültü. */}
          {total > 1 && (
            <Text style={styles.counter}>
              {position}/{total}
            </Text>
          )}
        </View>

        <View style={[styles.side, styles.sideEnd]}>
          <Pressable
            onPress={onShare}
            disabled={sharing}
            hitSlop={12}
            accessibilityRole="button"
            // "İndir" demiyor: Android'de İndirilenler'e doğrudan yazmıyoruz,
            // paylaşım penceresi zaten "Dosyalara Kaydet"i içeriyor.
            accessibilityLabel="Dosyayı paylaş veya kaydet"
          >
            {sharing ? (
              <ActivityIndicator size="small" color={VIEWER_INK} />
            ) : (
              <Share2 size={22} color={VIEWER_INK} strokeWidth={2} />
            )}
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: VIEWER_CHROME,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: VIEWER_LINE,
  },
  row: { height: 52, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12 },
  // Sol ve sağ eşit genişlikte: ortadaki etiket, geri tuşu görünsün ya da
  // görünmesin tam ortada kalıyor.
  side: { width: 44, justifyContent: 'center' },
  sideEnd: { alignItems: 'flex-end' },
  center: { flex: 1, alignItems: 'center', gap: 1 },
  label: { color: VIEWER_INK, fontSize: 15, fontWeight: '600' },
  counter: { color: VIEWER_INK_DIM, fontSize: 11, fontWeight: '600' },
});
