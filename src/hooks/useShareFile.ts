import { useCallback, useRef, useState } from 'react';
import { Alert } from 'react-native';
import * as Sharing from 'expo-sharing';
import { ensureCachedFile, stageForSharing } from '../lib/fileCache';
import { fileKindLabel } from '../theme/feedTokens';
import { mimeTypeFor, shareFileName, utiFor } from '../utils/fileMeta';

/**
 * Bir eki sistemin paylaşım penceresine devreder.
 *
 * Görüntüleyicide İKİ yerden çağrılıyor ve ikisi de aynı yolu izliyor: başlıktaki
 * paylaş butonu ve uygulama içinde gösterilemeyen türlerin "Uygulamada aç"
 * butonu. Word/PowerPoint/Excel için bu tek çıkış yolu.
 *
 * Buton "İndir" DEMİYOR, bilerek: Android'de İndirilenler klasörüne doğrudan
 * yazmak expo-media-library/SAF izinleri istiyor ve onu eklemiyoruz. Paylaşım
 * penceresi zaten "Dosyalara Kaydet" / "Drive'a kaydet" seçeneklerini
 * içeriyor — yani karşılığı olmayan bir söz vermeden aynı sonuç alınıyor.
 */
export function useShareFile() {
  const [sharing, setSharing] = useState(false);
  // State'e ek olarak ref: iki hızlı dokunuş arasında setState henüz
  // uygulanmamışken ikinci paylaşımın başlamasını engelliyor.
  const busy = useRef(false);

  const share = useCallback(
    async (remoteName: string, index: number, postTitle?: string) => {
      if (busy.current) return;
      busy.current = true;
      setSharing(true);

      try {
        const file = await ensureCachedFile(remoteName);
        const pretty = await stageForSharing(file, shareFileName(remoteName, index, postTitle));

        if (!(await Sharing.isAvailableAsync())) {
          Alert.alert('Paylaşım yok', 'Bu cihazda paylaşım penceresi açılamıyor.');
          return;
        }

        await Sharing.shareAsync(pretty.uri, {
          // `file.type` OS'un dosyadan okuduğu gerçek MIME; uzantı tanınmazsa
          // (uzantısız eski kayıtlar) devreye giriyor.
          mimeType: mimeTypeFor(remoteName, file.type),
          UTI: utiFor(remoteName),
          dialogTitle: fileKindLabel(remoteName),
        });
      } catch {
        Alert.alert('Hata', 'Dosya hazırlanamadı. İnternet bağlantını kontrol et.');
      } finally {
        busy.current = false;
        setSharing(false);
      }
    },
    []
  );

  return { share, sharing };
}
