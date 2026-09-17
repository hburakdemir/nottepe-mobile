import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { FileWarning } from 'lucide-react-native';
import { VIEWER_ACCENT, VIEWER_INK, VIEWER_INK_DIM, VIEWER_LINE } from './viewerTokens';

interface Props {
  kind: 'loading' | 'error';
  /** 0-1 arası; null ise belirsiz gösterge (sunucu Content-Length vermemiş). */
  progress?: number | null;
  title?: string;
  message?: string;
  onRetry?: () => void;
  /** "Uygulamada aç" kaçış yolu. Her hata durumunda verilmeli. */
  onHandoff?: () => void;
}

// Görüntüleyicinin yükleme/hata kabuğu.
//
// ⚠️ Buradaki yükleme durumu için ortak `StateView` KULLANILAMIYOR: o bileşen
// `kind="loading"` ile çizildiğinde 1 saniye sonra kendiliğinden "İnternet
// bağlantınız yok" mesajına düşüyor (bkz. StateView.tsx). Bir ek indirmesi bu
// eşiği rutin olarak aşıyor ve kullanıcı bağlantısı gayet yerindeyken hata
// okuyordu. Hata durumunda ise StateView'ın kendi zemini açık temada beyaz;
// bu ekran koyu olduğu için görsel olarak da uymuyor.
export default function SlideStatus({ kind, progress, title, message, onRetry, onHandoff }: Props) {
  return (
    <View style={styles.wrap}>
      {kind === 'loading' ? (
        <>
          <ActivityIndicator size="large" color={VIEWER_ACCENT} />
          <Text style={styles.title}>{title ?? 'Dosya hazırlanıyor…'}</Text>
          {progress != null && (
            <View style={styles.track}>
              <View style={[styles.fill, { width: `${Math.round(progress * 100)}%` }]} />
            </View>
          )}
        </>
      ) : (
        <>
          <FileWarning size={40} color={VIEWER_INK_DIM} strokeWidth={1.5} />
          <Text style={styles.title}>{title ?? 'Dosya açılamadı'}</Text>
          {message ? <Text style={styles.message}>{message}</Text> : null}

          <View style={styles.actions}>
            {onRetry && (
              <Pressable style={styles.primary} onPress={onRetry} accessibilityRole="button">
                <Text style={styles.primaryText}>Tekrar dene</Text>
              </Pressable>
            )}
            {onHandoff && (
              <Pressable style={styles.secondary} onPress={onHandoff} accessibilityRole="button">
                <Text style={styles.secondaryText}>Uygulamada aç</Text>
              </Pressable>
            )}
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, paddingHorizontal: 32 },
  title: { color: VIEWER_INK, fontSize: 16, fontWeight: '600', textAlign: 'center' },
  message: { color: VIEWER_INK_DIM, fontSize: 13, textAlign: 'center', lineHeight: 19 },
  track: { width: 180, height: 3, borderRadius: 2, backgroundColor: VIEWER_LINE, overflow: 'hidden' },
  fill: { height: 3, borderRadius: 2, backgroundColor: VIEWER_ACCENT },
  actions: { flexDirection: 'row', gap: 10, marginTop: 6 },
  primary: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 12, backgroundColor: VIEWER_ACCENT },
  primaryText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
  secondary: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: VIEWER_LINE,
  },
  secondaryText: { color: VIEWER_INK, fontSize: 14, fontWeight: '600' },
});
