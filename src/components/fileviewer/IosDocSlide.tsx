import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import type { ShouldStartLoadRequest } from 'react-native-webview/lib/WebViewTypes';
import { viewDocument } from '@react-native-documents/viewer';
import { useCachedFile } from '../../hooks/useCachedFile';
import { cachedFilesDirUri } from '../../lib/fileCache';
import { fileExtension, fileKindLabel } from '../../theme/feedTokens';
import { mimeTypeFor } from '../../utils/fileMeta';
import DocLoader from './DocLoader';
import SlideStatus from './SlideStatus';
import { VIEWER_ACCENT, VIEWER_BG, VIEWER_INK, VIEWER_INK_DIM } from './viewerTokens';

interface Props {
  fileName: string;
  /** Quick Look başlığı; yoksa dosya türü ("PowerPoint"). */
  title?: string;
  width: number;
  height: number;
  active: boolean;
  onOpenExternally: () => void;
}

// iPhone'da PDF ve Office dosyaları — önce DİSKE İNİYOR, sonra:
//
//   • PDF   → WKWebView'ın kendi PDF motoru (Safari/Dosyalar ile aynı). Bu yol
//             TestFlight 1.0.27'de doğrulandı.
//   • Office → QUICK LOOK (QLPreviewController, @react-native-documents/viewer).
//             1.0.27'de Office de WKWebView'dan açılıyordu; Word/Excel bozuk,
//             PowerPoint yarım görünüyordu. WKWebView Office'i Quick Look'un
//             KISITLI bir web gömmesiyle çiziyor; asıl Quick Look ekranı
//             Dosyalar ve Mail'in kullandığı tam önizleyici. Quick Look tam
//             ekran bir sistem ekranı olduğu için slaytın İÇİNE gömülemiyor:
//             indirme bitince kendiliğinden açılıyor, kapatılınca slaytta
//             "Tekrar aç" kartı kalıyor. Açılamazsa (beklenmedik bir native
//             hata) eski WKWebView yolu yedek.
//
// Önceki yollar ve neden bırakıldıkları:
//   • PDF (PdfDom, pdf.js 6) → belge ayrıştırılıyor ama sayfalar çizilmiyordu.
//   • Office doğrudan URL'den → sunucu `Content-Disposition: attachment`
//     veriyor, sayfa beyaz kalıyordu.
// Android bu bileşene GİRMİYOR (bkz. FileSlide).
export default function IosDocSlide({ fileName, title, width, height, active, onOpenExternally }: Props) {
  const download = useCachedFile(fileName, active);
  const isPdf = fileExtension(fileName) === 'pdf';
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  // Office: Quick Look açılamadıysa WebView yedeğine geçiliyor.
  const [quickLookFailed, setQuickLookFailed] = useState(false);
  // Aynı indirme için Quick Look'u yalnızca BİR KEZ kendiliğinden aç; kullanıcı
  // kapattıktan sonra slayt görünür kalırken tekrar tekrar açılmasın.
  const autoOpenedFor = useRef<string | null>(null);

  useEffect(() => {
    if (!active) {
      setLoading(true);
      setFailed(false);
      autoOpenedFor.current = null;
    }
  }, [active]);

  const retry = useCallback(() => {
    setFailed(false);
    setLoading(true);
    setAttempt((n) => n + 1);
  }, []);

  const fileUri = download.status === 'ready' ? download.file.uri : null;
  const useWebView = isPdf || quickLookFailed;

  const openQuickLook = useCallback(async () => {
    if (!fileUri) return;
    try {
      await viewDocument({
        uri: fileUri,
        mimeType: mimeTypeFor(fileName),
        headerTitle: title ?? fileKindLabel(fileName),
        presentationStyle: 'fullScreen',
      });
    } catch {
      setQuickLookFailed(true);
    }
  }, [fileUri, fileName, title]);

  useEffect(() => {
    if (useWebView || !active || !fileUri || autoOpenedFor.current === fileUri) return;
    autoOpenedFor.current = fileUri;
    void openQuickLook();
  }, [useWebView, active, fileUri, openQuickLook]);

  // Yalnızca yerel dosyaya gidilebiliyor; belgedeki bir bağlantıya basılırsa
  // görüntüleyici yarım bir web sayfasına dönmesin. `fileUri` ile birebir
  // karşılaştırılmıyor: WKWebView adresi yüzde-kodlamasını değiştirerek
  // bildirebiliyor ve eşleşmezse dosyanın kendisi engellenirdi. Okuma izni
  // zaten `allowingReadAccessToURL` ile ek dizinine sınırlı.
  const onShouldStart = useCallback(
    (request: ShouldStartLoadRequest) => request.isTopFrame === false || request.url.startsWith('file://'),
    []
  );

  if (download.status === 'error') {
    return (
      <View style={[styles.slide, { width, height }]}>
        <SlideStatus
          kind="error"
          title="Dosya indirilemedi"
          message="İnternet bağlantını kontrol edip tekrar dene."
          onRetry={download.retry}
          onHandoff={onOpenExternally}
        />
      </View>
    );
  }

  if (failed) {
    return (
      <View style={[styles.slide, { width, height }]}>
        <SlideStatus
          kind="error"
          title="Dosya açılamadı"
          message="Dosya bozuk olabilir ya da bu biçim desteklenmiyor."
          onRetry={retry}
          onHandoff={onOpenExternally}
        />
      </View>
    );
  }

  if (!fileUri) {
    return (
      <View style={[styles.slide, { width, height }]}>
        <SlideStatus
          kind="loading"
          fileName={fileName}
          progress={download.status === 'downloading' ? download.progress : null}
          bytesWritten={download.status === 'downloading' ? download.bytesWritten : undefined}
          totalBytes={download.status === 'downloading' ? download.totalBytes : undefined}
          title="Dosya indiriliyor…"
        />
      </View>
    );
  }

  if (!useWebView) {
    // Quick Look'un arkasında ve kapatıldıktan sonra görünen kart.
    return (
      <View style={[styles.slide, styles.card, { width, height }]}>
        <DocLoader fileName={fileName} progress={1} />
        <Text style={styles.cardTitle} numberOfLines={2}>
          {title ?? fileKindLabel(fileName)}
        </Text>
        <Text style={styles.cardHint}>Dosya telefonuna indi.</Text>
        <Pressable style={styles.primary} onPress={openQuickLook} accessibilityRole="button">
          <Text style={styles.primaryText}>Tekrar aç</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.slide, { width, height }]}>
      {active && (
        <WebView
          key={attempt}
          source={{ uri: fileUri }}
          // Okuma izni yalnızca önbellekteki ek dizinine — tüm sandbox'a değil.
          allowingReadAccessToURL={cachedFilesDirUri()}
          allowFileAccess
          originWhitelist={['file://*']}
          onShouldStartLoadWithRequest={onShouldStart}
          setSupportMultipleWindows={false}
          style={styles.web}
          onLoadEnd={() => setLoading(false)}
          onError={() => setFailed(true)}
        />
      )}
      {loading && (
        <View style={[StyleSheet.absoluteFill, styles.slide]}>
          <SlideStatus kind="loading" fileName={fileName} title="Dosya açılıyor…" />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  slide: { backgroundColor: VIEWER_BG },
  web: { flex: 1, backgroundColor: VIEWER_BG },
  card: { alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 32 },
  cardTitle: { color: VIEWER_INK, fontSize: 16, fontWeight: '600', textAlign: 'center' },
  cardHint: { color: VIEWER_INK_DIM, fontSize: 13, textAlign: 'center' },
  primary: { marginTop: 6, paddingHorizontal: 22, paddingVertical: 11, borderRadius: 12, backgroundColor: VIEWER_ACCENT },
  primaryText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
});
