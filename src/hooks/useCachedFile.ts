import { useCallback, useEffect, useRef, useState } from 'react';
import type { File } from 'expo-file-system';
import { cachedFile, ensureCachedFile } from '../lib/fileCache';

export type CachedFileState =
  | { status: 'idle' }
  // `progress` 0-1 arası; sunucu Content-Length göndermezse null (belirsiz
  // gösterge). nottepe.com statik dosyalarda başlığı veriyor ama eski
  // kayıtlar ya da bir proxy için bu dal gerekli.
  | { status: 'downloading'; progress: number | null; bytesWritten: number; totalBytes: number | null }
  | { status: 'ready'; file: File }
  | { status: 'error'; message: string };

/**
 * Bir gönderi ekini diske indirip durumunu izler.
 *
 * `enabled` görüntüleyicinin AKTİF slaytını işaret ediyor. Beş dosyalı bir
 * gönderide beş slayt da mount oluyor; hepsi aynı anda indirmeye başlarsa hem
 * bant genişliği hem bellek boşa gidiyor, düşük RAM'li cihazda uygulama
 * ölüyor. Bu yüzden indirme yalnızca kullanıcının baktığı slaytta başlıyor.
 */
export function useCachedFile(
  remoteName: string,
  enabled: boolean
): CachedFileState & { retry: () => void } {
  const [state, setState] = useState<CachedFileState>({ status: 'idle' });
  const [attempt, setAttempt] = useState(0);

  // Yüzde her ilerleme olayında değil, tam sayı basamağı değiştiğinde
  // state'e yazılıyor: `onProgress` saniyede onlarca kez tetikleniyor ve her
  // biri bir render demek olurdu.
  const lastPercent = useRef(-1);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  useEffect(() => {
    if (!enabled) return;

    const controller = new AbortController();
    let alive = true;
    // %100 BEKÇİSİ. Son bayt geldikten sonra 6 sn içinde indirme
    // sonuçlanmazsa diske bakılıyor — dosya yerindeyse açılıyor, değilse
    // "tekrar dene" hatası. iPhone'daki %100 takılmasının asıl sebebi geç gelen
    // ilerleme olayıydı (bkz. onProgress); bekçi beklenmedik başka bir askıya
    // karşı emniyet olarak duruyor.
    let settled = false;
    let watchdog: ReturnType<typeof setTimeout> | null = null;
    const armWatchdog = () => {
      if (watchdog) return;
      watchdog = setTimeout(() => {
        if (!alive || settled) return;
        settled = true;
        try {
          const file = cachedFile(remoteName);
          if (file.exists && (file.size ?? 0) > 0) {
            setState({ status: 'ready', file });
            return;
          }
        } catch {
          // aşağıdaki hataya düş
        }
        controller.abort();
        setState({ status: 'error', message: 'İndirme tamamlanamadı' });
      }, 6000);
    };
    lastPercent.current = -1;
    setState({ status: 'downloading', progress: null, bytesWritten: 0, totalBytes: null });

    ensureCachedFile(remoteName, {
      signal: controller.signal,
      onProgress: ({ bytesWritten, totalBytes }) => {
        // `settled` şart: iPhone'da legacy indiricinin SON ilerleme olayı
        // `downloadAsync` çözüldükten SONRA geliyor. Bu kontrol yokken o geç
        // olay 'ready' durumunun üstüne 'downloading %100' yazıyor, ekran
        // %100'de kalıyordu (1.0.28-1.0.30; 1.0.30'daki adım izinde "%100"
        // satırı "hazır"dan sonra görüldü). Android'de sıra tersine.
        if (!alive || settled) return;
        // Content-Length yoksa yüzde belirsiz; inen MB yine gösteriliyor
        // (64 KB'lık basamaklarla — her olayda render olmasın).
        if (totalBytes <= 0) {
          const step = Math.floor(bytesWritten / 65536);
          if (step === lastPercent.current) return;
          lastPercent.current = step;
          setState({ status: 'downloading', progress: null, bytesWritten, totalBytes: null });
          return;
        }
        if (bytesWritten >= totalBytes) armWatchdog();
        const ratio = bytesWritten / totalBytes;
        const percent = Math.floor(ratio * 100);
        if (percent === lastPercent.current) return;
        lastPercent.current = percent;
        setState({ status: 'downloading', progress: ratio, bytesWritten, totalBytes });
      },
    })
      .then((file) => {
        if (!alive || settled) return;
        settled = true;
        setState({ status: 'ready', file });
      })
      .catch((error: unknown) => {
        // Ekrandan çıkıldığı ya da slayt değiştiği için iptal ettiysek bu bir
        // hata değil: kullanıcıya "dosya açılamadı" göstermek yanlış olurdu.
        if (!alive || settled || controller.signal.aborted) return;
        settled = true;
        setState({
          status: 'error',
          message: error instanceof Error ? error.message : 'Dosya indirilemedi',
        });
      });

    return () => {
      alive = false;
      if (watchdog) clearTimeout(watchdog);
      controller.abort();
    };
  }, [remoteName, enabled, attempt]);

  return { ...state, retry };
}
