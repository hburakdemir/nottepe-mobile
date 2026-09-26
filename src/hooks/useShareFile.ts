import { useCallback, useRef, useState } from 'react';
import { Alert, Platform } from 'react-native';
import * as Sharing from 'expo-sharing';
import * as IntentLauncher from 'expo-intent-launcher';
import { getContentUriAsync } from 'expo-file-system/legacy';
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

  // "Cihazda aç": PDF'i telefonun kendi PDF uygulamasıyla açar.
  //
  // Android'de paylaşım penceresi (ACTION_SEND) bunun yerine GEÇMİYOR: PDF
  // okuyucuların çoğu SEND değil VIEW dinliyor, pencerede hiç çıkmıyorlar. Dosya
  // bir `content://` adresine çevrilip okuma izniyle ACTION_VIEW gönderiliyor
  // (FLAG_GRANT_READ_URI_PERMISSION = 1); cihazda PDF uygulaması yoksa
  // ActivityNotFound fırlıyor ve kullanıcıya söyleniyor.
  //
  // iOS'ta ayrı bir native yol yok: paylaşım penceresinin "Birlikte aç"
  // satırı (Kitaplar, Dosyalar, Acrobat...) tam olarak bu işi görüyor.
  const openInDeviceApp = useCallback(
    async (remoteName: string, index: number, postTitle?: string) => {
      if (Platform.OS !== 'android') {
        await share(remoteName, index, postTitle);
        return;
      }
      if (busy.current) return;
      busy.current = true;
      setSharing(true);

      try {
        const file = await ensureCachedFile(remoteName);
        const pretty = await stageForSharing(file, shareFileName(remoteName, index, postTitle));
        const contentUri = await getContentUriAsync(pretty.uri);
        try {
          await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
            data: contentUri,
            type: mimeTypeFor(remoteName, file.type),
            flags: 1,
          });
        } catch {
          Alert.alert('Uygulama bulunamadı', 'Bu cihazda dosyayı açabilecek bir uygulama yok.');
        }
      } catch {
        Alert.alert('Hata', 'Dosya hazırlanamadı. İnternet bağlantını kontrol et.');
      } finally {
        busy.current = false;
        setSharing(false);
      }
    },
    [share]
  );

  return { share, openInDeviceApp, sharing };
}
