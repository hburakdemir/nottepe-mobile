import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

// Android 8+'da her bildirimin bir kanalı olmak zorunda; kanalsız gönderilen
// bildirim hiç görünmez. Kanallar ilk token'dan ve ilk bildirimden ÖNCE
// kurulmalı.
//
// ⚠️ Bir kanal oluşturulduktan sonra yalnızca adı ve açıklaması değişebilir —
// importance, ses ve titreşim OS tarafından dondurulur. Sonradan değiştirmek
// yeni bir kanal id'si (`default_v2`) ve göç demek, üstelik kullanıcı eski
// kanalı elle kapatmışsa o ayar da kaybolur. Bu yüzden değerler ilk seferde
// doğru seçildi.
export const PUSH_CHANNEL_DEFAULT = 'default';
export const PUSH_CHANNEL_ANNOUNCEMENTS = 'announcements';

// Kanallar birden çok yerden (kayıt akışı, AppState dönüşü) tetikleniyor;
// söz tek sefer kurulup paylaşılıyor ki her çağrıda native tarafa gidilmesin.
let ensured: Promise<void> | null = null;

export function ensureNotificationChannels(): Promise<void> {
  if (Platform.OS !== 'android') return Promise.resolve();
  if (ensured) return ensured;

  ensured = (async () => {
    // MAX: kişiye özel bildirimler (yorum, cevap) — ekranın üstünde belirmesi
    // beklenen tek grup bunlar.
    await Notifications.setNotificationChannelAsync(PUSH_CHANNEL_DEFAULT, {
      name: 'Bildirimler',
      description: 'Gönderilerine gelen yorumlar ve sana yönelik diğer bildirimler.',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#2F5755',
      showBadge: true,
    });

    // DEFAULT: duyurular kişiye özel değil ve toplu gidiyor; MAX'ta olsalardı
    // her duyuru bütün kullanıcıların ekranını kesiyor olurdu. Kullanıcı bu
    // kanalı tek başına kısabilsin diye ayrı tutuluyor.
    await Notifications.setNotificationChannelAsync(PUSH_CHANNEL_ANNOUNCEMENTS, {
      name: 'Duyurular',
      description: 'Nottepe genel duyuruları.',
      importance: Notifications.AndroidImportance.DEFAULT,
      lightColor: '#2F5755',
      showBadge: true,
    });
  })().catch((error) => {
    // Kanal kurulamazsa bir sonraki denemede tekrar şansı olsun.
    ensured = null;
    if (__DEV__) console.warn('[push] Bildirim kanalları kurulamadı:', error);
  });

  return ensured;
}
