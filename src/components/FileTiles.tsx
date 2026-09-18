import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { FileText, Image as ImageIcon, Table2 } from 'lucide-react-native';
import { useOpenFileViewer } from '../hooks/useOpenFileViewer';
import { fileKind, fileKindLabel, useFeedTokens } from '../theme/feedTokens';

interface Props {
  files: string[];
  // Akışta yalnızca ilk iki dosya kutucuğu gösteriliyor; kalanlar tek bir "+N"
  // butonunda toplanıyor. Gönderi ekranında sınır yok.
  maxVisible?: number;
  // Paylaşımda üretilecek okunaklı dosya adının gövdesi — backend orijinal adı
  // saklamıyor (bkz. utils/fileMeta.ts).
  postTitle?: string;
  // Yönlendirmeyi devralmak isteyen nadir çağrı yerleri için kaçış kapısı.
  // Verilmezse FileTiles kendisi görüntüleyiciyi açıyor.
  onPressFile?: (index: number) => void;
}

// Dosyalar artık tek bir "Notu aç" şeridi değil: her dosya kendi kutucuğu,
// altında ne olduğu yazıyor (PDF / Word / Resim). Tür ikonları da ayrışıyor,
// böylece bir resmi bir PDF'ten ayırmak için etiketi okumaya gerek kalmıyor.
//
// Kutucuğa basmak artık dosyayı harici tarayıcıya atmıyor, uygulama içi
// görüntüleyiciyi basılan dosyanın indeksiyle açıyor (bkz. FileViewerScreen).
export default function FileTiles({ files, maxVisible, postTitle, onPressFile }: Props) {
  const t = useFeedTokens();
  const openViewer = useOpenFileViewer();
  if (files.length === 0) return null;

  const limit = maxVisible ?? files.length;
  const visible = files.slice(0, limit);
  const hiddenCount = files.length - visible.length;

  const open = (index: number) =>
    onPressFile ? onPressFile(index) : openViewer(files, index, postTitle);

  return (
    <View style={styles.row}>
      {visible.map((fileName, index) => {
        const kind = fileKind(fileName);
        const Icon = kind === 'image' ? ImageIcon : kind === 'sheet' ? Table2 : FileText;
        return (
          <Pressable
            key={index}
            style={styles.item}
            onPress={() => open(index)}
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
        // "+N dosya" butonu eskiden gönderi detayını açıyordu; kutucuğun
        // vaadi ("3 dosya daha") ile yaptığı iş ("gönderiyi aç") uyuşmuyordu.
        // Artık ilk GİZLİ dosyayı açıyor, kullanıcı oradan kaydırarak hepsini
        // görüyor. Detaya gitme yolu kaybolmuyor: kartın kendisi zaten
        // basılabilir (bkz. PostCardModern.tsx).
        <Pressable
          style={styles.item}
          onPress={() => open(limit)}
          accessibilityLabel={`${hiddenCount} dosya daha`}
        >
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
