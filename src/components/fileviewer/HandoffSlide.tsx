import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { FileSpreadsheet, FileText, Presentation, File as FileIcon } from 'lucide-react-native';
import { fileKind, fileKindLabel } from '../../theme/feedTokens';
import { VIEWER_ACCENT, VIEWER_INK, VIEWER_INK_DIM } from './viewerTokens';

interface Props {
  fileName: string;
  onOpen: () => void;
  busy: boolean;
  /** Bir üst katman (ör. açılamayan resim) buraya düştüyse gösterilecek sebep. */
  reason?: string;
}

const ICON_BY_KIND = {
  word: FileText,
  sheet: FileSpreadsheet,
  slide: Presentation,
  pdf: FileText,
  image: FileIcon,
  other: FileIcon,
} as const;

// Uygulama içinde gösterilemeyen dosyaların son durağı: dosya cihaza iniyor ve
// kullanıcının kendi uygulamasına (Word, Drive, WPS…) devrediliyor.
//
// doc/docx/xls/xlsx/ppt/pptx buraya normalde GELMİYOR, OfficeSlide çiziyor;
// yalnızca görüntüleyicinin boyut sınırını aşarlarsa düşüyorlar. Buraya asıl
// düşenler odt/rtf/txt/csv, `other` (zip, uzantısız, tanınmayan) ve
// çözülemeyen resimler — hiçbir dosya türü kullanıcıyı çıkmaza sokmuyor.
export default function HandoffSlide({ fileName, onOpen, busy, reason }: Props) {
  const kind = fileKind(fileName);
  const Icon = ICON_BY_KIND[kind] ?? FileIcon;
  const label = fileKindLabel(fileName);

  return (
    <View style={styles.wrap}>
      <Icon size={52} color={VIEWER_INK_DIM} strokeWidth={1.25} />
      <Text style={styles.title}>{label} dosyası</Text>
      <Text style={styles.message}>
        {reason ?? 'Bu tür dosyalar uygulama içinde gösterilemiyor.'}
      </Text>

      <Pressable
        style={[styles.button, busy && styles.buttonBusy]}
        onPress={onOpen}
        disabled={busy}
        accessibilityRole="button"
        accessibilityLabel={`${label} dosyasını başka bir uygulamada aç`}
      >
        {busy ? (
          <ActivityIndicator size="small" color="#FFFFFF" />
        ) : (
          <Text style={styles.buttonText}>Uygulamada aç</Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 32 },
  title: { color: VIEWER_INK, fontSize: 17, fontWeight: '600' },
  message: { color: VIEWER_INK_DIM, fontSize: 13, textAlign: 'center', lineHeight: 19 },
  button: {
    marginTop: 10,
    minWidth: 150,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 22,
    borderRadius: 12,
    backgroundColor: VIEWER_ACCENT,
  },
  buttonBusy: { opacity: 0.7 },
  buttonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
});
