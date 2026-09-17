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

// PDF, base64 olarak DOM bileşenine geçiriliyor; köprü JSON taşıdığı için
// 10 MB'lık bir dosya 13,3 MB'lık bir dizgeye dönüşüyor ve o dizge aynı anda
// hem Hermes'te hem WebView'da duruyor. Yükleme sınırı zaten 10 MB
// (AddPostScreen) ama web istemcisinden ya da eski kayıtlardan daha büyüğü
// gelebilir — bu eşik onlar için emniyet supabı, kullanıcıyı çökme yerine
// devretme ekranına düşürüyor.
const MAX_INLINE_BYTES = 8 * 1024 * 1024;

const MESSAGE_BY_CODE: Record<string, string> = {
  password: 'Bu PDF parola korumalı.',
  invalid: 'Dosya bozuk görünüyor ya da bir PDF değil.',
  unknown: 'PDF açılamadı.',
};

export default function PdfSlide({
  fileName,
  width,
  height,
  active,
  onOpenExternally,
  sharing,
}: Props) {
  const download = useCachedFile(fileName, active);
  const [payload, setPayload] = useState<string | null>(null);
  const [failure, setFailure] = useState<{ code: string; message: string } | null>(null);
  const [tooLarge, setTooLarge] = useState(false);

  // Dosya indikten sonra base64'e çevriliyor. Ayrı bir adım olmasının sebebi
  // `base64()` çağrısının kendisinin de zaman alması — kullanıcı o sırada
  // boş ekran değil, hâlâ "hazırlanıyor" görüyor.
  useEffect(() => {
    if (download.status !== 'ready') return;
    let alive = true;

    if (download.file.size > MAX_INLINE_BYTES) {
      setTooLarge(true);
      return;
    }

    download.file
      .base64()
      .then((data) => {
        if (alive) setPayload(data);
      })
      .catch(() => {
        if (alive) setFailure({ code: 'unknown', message: 'Dosya okunamadı.' });
      });

    return () => {
      alive = false;
    };
  }, [download.status, download.status === 'ready' ? download.file : null]);

  // Slayt görünürden çıkınca base64 bırakılıyor: beş dosyalı bir gönderide
  // hepsinin kodlanmış hâlini bellekte tutmak ucuz cihazlarda ölümcül.
  useEffect(() => {
    if (!active) {
      setPayload(null);
      setFailure(null);
    }
  }, [active]);

  const onReady = useCallback(async () => {
    // Belge açıldı; şimdilik ek bir iş yok. İmza köprüde duruyor ki ileride
    // "sayfa 3/12" göstergesi için sayfa sayısı buradan alınabilsin.
  }, []);

  const onFail = useCallback(async (code: string, message: string) => {
    setFailure({ code, message });
  }, []);

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

  if (!payload) {
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
        base64={payload}
        onReady={onReady}
        onFail={onFail}
        dom={{
          style: { flex: 1, backgroundColor: VIEWER_BG },
          // Uzaktan hiçbir şey yüklenmiyor; PDF zaten base64 olarak içeride.
          // Bir bağlantıya basılırsa WebView'da gezinmeye başlamasın.
          setSupportMultipleWindows: false,
          // Android'de varsayılan beyaz zemin, sayfalar gelmeden önce bir kare
          // beyaz parlama yapıyor.
          backgroundColor: VIEWER_BG,
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  slide: { backgroundColor: VIEWER_BG },
});
