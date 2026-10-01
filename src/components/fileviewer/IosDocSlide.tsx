import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import type { ShouldStartLoadRequest } from 'react-native-webview/lib/WebViewTypes';
import { useCachedFile } from '../../hooks/useCachedFile';
import { cachedFilesDirUri } from '../../lib/fileCache';
import SlideStatus from './SlideStatus';
import { VIEWER_BG } from './viewerTokens';

interface Props {
  fileName: string;
  width: number;
  height: number;
  active: boolean;
  onOpenExternally: () => void;
}

// iPhone'da PDF ve Office dosyaları — DİSKE İNDİRİLİP WKWebView'ın KENDİ
// motoruyla açılıyor (Safari'nin ve Dosyalar uygulamasının kullandığı aynı
// motor).
//
// Önceki iki yol iPhone'da boş ekran veriyordu:
//   • PDF (PdfDom, pdf.js 6) → belge ayrıştırılıyor, `onReady` geliyor ama
//     sayfalar çizilmiyordu; siyah zemin kalıyordu. pdf.js yolu yalnızca
//     Android'de doğrulanmıştı.
//   • Office → dosya adresi doğrudan yükleniyordu; sunucu /uploads altındaki
//     belgeleri `Content-Disposition: attachment` ile veriyor ve sayfa beyaz
//     kalıyordu.
// Dosya önce diske indiğinde ikisi de devre dışı: sunucu başlığı önemsiz,
// pdf.js hiç devreye girmiyor. Bonusu, açılmış bir dosyanın çevrimdışı da
// açılması. Android bu bileşene GİRMİYOR (bkz. FileSlide) — orada sistem
// WebView'ı ne PDF ne Office çizebiliyor.
export default function IosDocSlide({ fileName, width, height, active, onOpenExternally }: Props) {
  const download = useCachedFile(fileName, active);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!active) {
      setLoading(true);
      setFailed(false);
    }
  }, [active]);

  const retry = useCallback(() => {
    setFailed(false);
    setLoading(true);
    setAttempt((n) => n + 1);
  }, []);

  const fileUri = download.status === 'ready' ? download.file.uri : null;

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

  return (
    <View style={[styles.slide, { width, height }]}>
      {active && fileUri && (
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
      {(loading || !fileUri) && (
        <View style={[StyleSheet.absoluteFill, styles.slide]}>
          <SlideStatus
            kind="loading"
            progress={download.status === 'downloading' ? download.progress : null}
            title={download.status === 'ready' ? 'Dosya açılıyor…' : 'Dosya indiriliyor…'}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  slide: { backgroundColor: VIEWER_BG },
  web: { flex: 1, backgroundColor: VIEWER_BG },
});
