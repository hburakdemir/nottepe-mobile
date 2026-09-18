import { useCallback, useEffect, useRef, useState } from 'react';
import type { File } from 'expo-file-system';
import { ensureCachedFile } from '../lib/fileCache';

export type CachedFileState =
  | { status: 'idle' }
  // `progress` 0-1 arası; sunucu Content-Length göndermezse null (belirsiz
  // gösterge). nottepe.com statik dosyalarda başlığı veriyor ama eski
  // kayıtlar ya da bir proxy için bu dal gerekli.
  | { status: 'downloading'; progress: number | null }
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
    lastPercent.current = -1;
    setState({ status: 'downloading', progress: null });

    ensureCachedFile(remoteName, {
      signal: controller.signal,
      onProgress: ({ bytesWritten, totalBytes }) => {
        if (!alive) return;
        if (totalBytes <= 0) return; // Content-Length yok → belirsiz kalsın
        const ratio = bytesWritten / totalBytes;
        const percent = Math.floor(ratio * 100);
        if (percent === lastPercent.current) return;
        lastPercent.current = percent;
        setState({ status: 'downloading', progress: ratio });
      },
    })
      .then((file) => {
        if (alive) setState({ status: 'ready', file });
      })
      .catch((error: unknown) => {
        // Ekrandan çıkıldığı ya da slayt değiştiği için iptal ettiysek bu bir
        // hata değil: kullanıcıya "dosya açılamadı" göstermek yanlış olurdu.
        if (!alive || controller.signal.aborted) return;
        setState({
          status: 'error',
          message: error instanceof Error ? error.message : 'Dosya indirilemedi',
        });
      });

    return () => {
      alive = false;
      controller.abort();
    };
  }, [remoteName, enabled, attempt]);

  return { ...state, retry };
}
