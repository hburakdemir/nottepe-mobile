import React, { useCallback, useEffect, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import type { ShouldStartLoadRequest } from 'react-native-webview/lib/WebViewTypes';
import { fileExtension } from '../../theme/feedTokens';
import HandoffSlide from './HandoffSlide';
import SlideStatus from './SlideStatus';
import { VIEWER_BG } from './viewerTokens';

interface Props {
  fileName: string;
  url: string;
  width: number;
  height: number;
  active: boolean;
  onOpenExternally: () => void;
  sharing: boolean;
}

// Word, Excel ve PowerPoint — platforma göre İKİ AYRI yol.
//
// iOS: WKWebView bu biçimleri KENDİSİ çiziyor (Quick Look'un motoru). Dosya
// adresi doğrudan yükleniyor, üçüncü bir sunucu yok.
//
// Android: sistem WebView'ı Office dosyasını çizemiyor, sadece indirmeye
// çalışıyor. Orada Microsoft'un gömülü görüntüleyicisi kullanılıyor; dosyayı
// Microsoft'un sunucusu kendisi çekiyor. Bu bilinçli bir karar: /uploads
// adresleri zaten herkese açık (eskiden Linking.openURL ile tarayıcıya
// veriliyordu), yani yeni bir kapı açılmıyor. PDF bu yola girmiyor — o cihazda
// pdf.js ile çözülüyor (PdfSlide).
//
// Görüntüleyici açamazsa (boyut sınırı, ağ, bozuk dosya) kullanıcı her zaman
// "Uygulamada aç" ile devretme yoluna düşebiliyor.
export const OFFICE_EXTENSIONS = new Set(['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx']);

const OFFICE_EMBED = 'https://view.officeapps.live.com/op/embed.aspx?src=';

// Microsoft'un gömülü görüntüleyicisinin sınırları: Word ve PowerPoint 10 MB,
// Excel 5 MB. Aşan dosyada görüntüleyici kendi hata sayfasını çiziyor ve bu
// sayfa bir HTTP hatası DEĞİL — WebView'dan yakalanamıyor. O yüzden boyut
// önceden bir HEAD isteğiyle soruluyor.
const OFFICE_LIMIT_BYTES: Record<string, number> = {
  xls: 5 * 1024 * 1024,
  xlsx: 5 * 1024 * 1024,
};
const DEFAULT_LIMIT_BYTES = 10 * 1024 * 1024;

// Microsoft görüntüleyicisinin kendi alt sayfaları bu alan adlarında. Üst
// çerçevede başka bir yere gitmek (ör. "Word'de aç" bağlantısı) engelleniyor:
// kullanıcı görüntüleyicinin içinde yarım bir web sitesine düşmesin.
const ANDROID_ALLOWED_HOSTS = ['officeapps.live.com', 'office.net', 'office.com', 'live.com', 'microsoft.com'];

function hostOf(url: string): string {
  const match = /^https?:\/\/([^/:?#]+)/i.exec(url);
  return match ? match[1].toLowerCase() : '';
}

function isAllowedHost(host: string, allowed: string[]): boolean {
  return allowed.some((domain) => host === domain || host.endsWith(`.${domain}`));
}

type SizeCheck = 'pending' | 'ok' | 'too-large';

export default function OfficeSlide({
  fileName,
  url,
  width,
  height,
  active,
  onOpenExternally,
  sharing,
}: Props) {
  const isAndroid = Platform.OS === 'android';
  const [sizeCheck, setSizeCheck] = useState<SizeCheck>(isAndroid ? 'pending' : 'ok');
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  // WebView'ı yeniden kurmanın tek temiz yolu anahtarını değiştirmek.
  const [attempt, setAttempt] = useState(0);

  // Sadece Android'de ve slayt görünürken. HEAD cevap vermezse ya da
  // Content-Length yoksa denemeye izin veriliyor — yanlış pozitifle dosyayı
  // kapatmaktansa görüntüleyicinin kendi hatasını göstermek daha iyi.
  useEffect(() => {
    if (!isAndroid || !active || sizeCheck !== 'pending') return;
    let alive = true;
    const limit = OFFICE_LIMIT_BYTES[fileExtension(fileName)] ?? DEFAULT_LIMIT_BYTES;

    fetch(url, { method: 'HEAD' })
      .then((res) => {
        const length = Number(res.headers.get('content-length'));
        if (alive) setSizeCheck(length > limit ? 'too-large' : 'ok');
      })
      .catch(() => {
        if (alive) setSizeCheck('ok');
      });

    return () => {
      alive = false;
    };
  }, [isAndroid, active, sizeCheck, url, fileName]);

  // Slayt görünürden çıkınca WebView sökülüyor (aşağıda `active` koşulu);
  // geri gelindiğinde yükleme göstergesi baştan başlamalı.
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

  const onShouldStart = useCallback(
    (request: ShouldStartLoadRequest) => {
      // Alt çerçeveler (görüntüleyicinin kendi iframe'leri) serbest.
      if (request.isTopFrame === false) return true;
      if (request.url === 'about:blank') return true;
      if (isAndroid) return isAllowedHost(hostOf(request.url), ANDROID_ALLOWED_HOSTS);
      return request.url === url;
    },
    [isAndroid, url]
  );

  if (sizeCheck === 'too-large') {
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

  if (failed) {
    return (
      <View style={[styles.slide, { width, height }]}>
        <SlideStatus
          kind="error"
          title="Dosya açılamadı"
          message="İnternet bağlantını kontrol edip tekrar dene."
          onRetry={retry}
          onHandoff={onOpenExternally}
        />
      </View>
    );
  }

  const source = isAndroid ? `${OFFICE_EMBED}${encodeURIComponent(url)}` : url;

  return (
    <View style={[styles.slide, { width, height }]}>
      {/* WebView yalnızca görünür slaytta kurulu: beş Office dosyalı bir
          gönderide hepsini aynı anda yüklemek hem veri hem bellek israfı. */}
      {active && sizeCheck === 'ok' && (
        <WebView
          key={attempt}
          source={{ uri: source }}
          style={styles.web}
          originWhitelist={['https://*']}
          onShouldStartLoadWithRequest={onShouldStart}
          setSupportMultipleWindows={false}
          onLoadEnd={() => setLoading(false)}
          onError={() => setFailed(true)}
          onHttpError={(event) => {
            // Sadece ana belgenin hatası ölümcül; görüntüleyicinin bir alt
            // kaynağının 404'ü sayfayı bozmuyor.
            if (event.nativeEvent.url === source) setFailed(true);
          }}
        />
      )}
      {loading && (
        <View style={[StyleSheet.absoluteFill, styles.slide]}>
          <SlideStatus kind="loading" title="Dosya açılıyor…" />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  slide: { backgroundColor: VIEWER_BG },
  // WebView'ın varsayılan beyaz zemini yüklenirken koyu ekranda parlıyor.
  web: { flex: 1, backgroundColor: VIEWER_BG },
});
