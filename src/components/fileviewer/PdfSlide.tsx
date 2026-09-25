import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useCachedFile } from '../../hooks/useCachedFile';
import HandoffSlide from './HandoffSlide';
import PdfDom from './PdfDom';
import SlideStatus from './SlideStatus';
import { VIEWER_BG } from './viewerTokens';

interface Props {
  fileName: string;
  width: number;
  height: number;
  active: boolean;
  onOpenExternally: () => void;
  sharing: boolean;
}

// PDF DOM bileşenine DOSYA YOLU olarak veriliyor; WebView onu diskten kendisi
// okuyor (bkz. PdfDom `readLocalFile`). Eskiden base64 olarak geçiyordu:
// köprü JSON taşıdığı için 9,3 MB'lık bir ders notu 12,4 MB'lık bir dizgeye
// dönüşüyor, o dizge JS thread'inde üretilip aynı anda hem Hermes'te hem
// WebView'da duruyordu. Bu yüzden 8 MB'lık bir tavan vardı ve web
// istemcisinden yüklenmiş sıradan notlar "açılamayacak kadar büyük" ekranına
// düşüyordu.
//
// Base64 yolu YEDEK olarak duruyor: yerel okuma bir cihazda başarısız olursa
// (WebView dosya erişimi kısıtlıysa) küçük dosyalar yine uygulama içinde
// açılabilsin. Eşiği eski gerekçesiyle aynı.
const MAX_INLINE_BYTES = 8 * 1024 * 1024;

// Yerel okumada Hermes'e bir şey girmiyor, ama pdf.js belgeyi WebView'ın
// belleğinde tutuyor. Yükleme sınırı 10 MB (AddPostScreen); bu tavan yalnızca
// web istemcisinden ya da eski kayıtlardan gelebilecek aşırı büyük dosyalar
// için emniyet supabı.
const MAX_LOCAL_BYTES = 40 * 1024 * 1024;

const MESSAGE_BY_CODE: Record<string, string> = {
  password: 'Bu PDF parola korumalı.',
  invalid: 'Dosya bozuk görünüyor ya da bir PDF değil.',
  unknown: 'PDF açılamadı.',
};

export default function PdfSlide({ fileName, width, height, active, onOpenExternally, sharing }: Props) {
  const download = useCachedFile(fileName, active);
  // `uri` varsayılan, `base64` yalnızca yerel okuma başarısız olunca dolar.
  const [source, setSource] = useState<{ uri: string } | { base64: string } | null>(null);
  const [failure, setFailure] = useState<{ code: string; message: string } | null>(null);
  const [tooLarge, setTooLarge] = useState(false);
  // WebView kurulduktan sonra pdf.js belgeyi ayrıştırana kadar birkaç saniye
  // geçiyor (9 MB'lık bir notta emülatörde ~4 sn). O arada gösterge kalkarsa
  // kullanıcı boş siyah bir ekran görüyor — PdfDom `onReady` diyene kadar
  // gösterge WebView'ın ÜSTÜNDE kalıyor.
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (download.status !== 'ready') return;
    if (download.file.size > MAX_LOCAL_BYTES) {
      setTooLarge(true);
      return;
    }
    setSource({ uri: download.file.uri });
  }, [download.status, download.status === 'ready' ? download.file : null]);

  // Slayt görünürden çıkınca kaynak bırakılıyor: WebView sökülüyor ve beş
  // dosyalı bir gönderide hepsinin belgesi bellekte kalmıyor.
  useEffect(() => {
    if (!active) {
      setSource(null);
      setFailure(null);
    }
  }, [active]);

  useEffect(() => {
    setReady(false);
  }, [source]);

  // Yerel okuma başarısız → küçük dosyada base64 yedeği, büyükte devretme.
  // `base64()` çağrısının kendisi de zaman aldığı için bu sırada kullanıcı
  // "hazırlanıyor" görüyor (`source` null'a çekiliyor).
  const fallBackToBase64 = useCallback(() => {
    if (download.status !== 'ready') return;
    if (download.file.size > MAX_INLINE_BYTES) {
      setTooLarge(true);
      return;
    }
    setSource(null);
    download.file
      .base64()
      .then((data) => setSource({ base64: data }))
      .catch(() => setFailure({ code: 'unknown', message: 'Dosya okunamadı.' }));
  }, [download]);

  const onReady = useCallback(async () => {
    // Sayfa sayısı da geliyor ama şimdilik kullanılmıyor; imza köprüde duruyor
    // ki ileride "sayfa 3/12" göstergesi için buradan alınabilsin.
    setReady(true);
  }, []);

  const onFail = useCallback(
    async (code: string, message: string) => {
      if (code === 'local-read') {
        fallBackToBase64();
        return;
      }
      setFailure({ code, message });
    },
    [fallBackToBase64]
  );

  if (tooLarge) {
    return (
      <View style={[styles.slide, { width, height }]}>
        <HandoffSlide
          fileName={fileName}
          onOpen={onOpenExternally}
          busy={sharing}
          reason="Bu dosya uygulama içinde açılamayacak kadar büyük."
        />
      </View>
    );
  }

  if (failure) {
    return (
      <View style={[styles.slide, { width, height }]}>
        <SlideStatus
          kind="error"
          title="PDF açılamadı"
          message={MESSAGE_BY_CODE[failure.code] ?? MESSAGE_BY_CODE.unknown}
          onRetry={failure.code === 'unknown' ? download.retry : undefined}
          onHandoff={onOpenExternally}
        />
      </View>
    );
  }

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

  if (!source) {
    return (
      <View style={[styles.slide, { width, height }]}>
        <SlideStatus
          kind="loading"
          progress={download.status === 'downloading' ? download.progress : null}
          title={download.status === 'ready' ? 'Sayfalar hazırlanıyor…' : 'Dosya indiriliyor…'}
        />
      </View>
    );
  }

  return (
    <View style={[styles.slide, { width, height }]}>
      <PdfDom
        {...source}
        onReady={onReady}
        onFail={onFail}
        dom={{
          // Android'de WebView'ın varsayılan zemini beyaz ve sayfalar gelmeden
          // önce bir kare beyaz parlama yapıyor; koyu zemin buradan veriliyor.
          //
          // SDK 54'te bunun AYRI bir `backgroundColor` prop'u YOK: `DOMProps`
          // burada `Omit<RNWebViewProps,'source'>`'tan türüyor, yani
          // react-native-webview'ın prop'ları geçerli ve zemin `style` ile
          // veriliyor. (`backgroundColor` prop'u @expo/dom-webview'a ait ve o
          // SDK 56+ ile geliyor.) PdfDom'un kendi CSS'i de html/body zeminini
          // aynı renge boyuyor — ikisi birlikte parlamayı kapatıyor.
          style: { flex: 1, backgroundColor: VIEWER_BG },
          // Uzaktan hiçbir şey yüklenmiyor; PDF diskten ya da base64 olarak geliyor.
          // Bir bağlantıya basılırsa WebView'da gezinmeye başlamasın.
          setSupportMultipleWindows: false,
        }}
      />
      {!ready && (
        <View style={[StyleSheet.absoluteFill, styles.slide]}>
          <SlideStatus kind="loading" title="Sayfalar hazırlanıyor…" />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  slide: { backgroundColor: VIEWER_BG },
});
