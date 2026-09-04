import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { userNotificationAPI, type PushDeviceRegistration } from '../api';
import { ensureNotificationChannels } from './channels';
import { setPushActive } from './pushState';

// Token yaşam döngüsünün tamamı burada: izin → kanal → token → (gerekiyorsa) POST.
// Kayıt her ön plana dönüşte tekrar çağrılıyor, bu yüzden ucuz olması ve
// kendini elemesi şart.

const TOKEN_KEY = 'nottepe_push_token';
const TOKEN_OWNER_KEY = 'nottepe_push_token_owner';
const PERMISSION_ASKED_KEY = 'nottepe_push_permission_asked';

function log(message: string, ...rest: unknown[]): void {
  if (__DEV__) console.warn(`[push] ${message}`, ...rest);
}

function currentLocale(): string | undefined {
  // expo-localization kurulu değil; Hermes'in Intl'i bu iş için yeterli.
  try {
    return Intl.DateTimeFormat().resolvedOptions().locale;
  } catch {
    return undefined;
  }
}

/**
 * İzin akışı. Cold start'ta DEĞİL, ilk başarılı girişten sonra çağrılıyor —
 * uygulamayı ilk açan kişiye ne olduğunu anlamadan sistem dialogu göstermek
 * reddedilme oranını uçuruyor.
 *
 * ⚠️ Bir kez sorulup reddedildiyse bir daha SORULMUYOR: Android 13, ikinci
 * reddetmeden sonra dialogu hiç göstermiyor (çağrı sessizce `denied` dönüyor) ve
 * o noktadan sonra tek kurtarma yolu sistem ayarları. Bayrağı kendimiz tutmak,
 * `canAskAgain`'in platformlar arası tutarsızlığına bağımlı kalmamayı sağlıyor.
 */
export async function ensurePushPermission(): Promise<boolean> {
  if (!Device.isDevice) return false;

  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;

  const asked = await AsyncStorage.getItem(PERMISSION_ASKED_KEY);
  if (asked) return false;

  // İstemeden ÖNCE işaretliyoruz: istek sırasında uygulama öldürülürse bile
  // kullanıcı ikinci bir dialogla karşılaşmasın.
  await AsyncStorage.setItem(PERMISSION_ASKED_KEY, '1');
  const result = await Notifications.requestPermissionsAsync();
  return result.granted;
}

/**
 * Token'ı alır ve gerekiyorsa sunucuya kaydeder. Zaten kayıtlıysa hiçbir ağ
 * isteği atmaz — her açılışta ve her ön plana dönüşte çağrılabilir.
 */
export async function registerToken(userId: number | null | undefined): Promise<boolean> {
  if (!userId) return false;

  // Emülatörde `getExpoPushTokenAsync` fırlatıyor (FCM kaydı yok) → kırmızı ekran.
  if (!Device.isDevice) {
    log('Gerçek cihaz değil, push kaydı atlandı.');
    setPushActive(false);
    return false;
  }

  const permission = await Notifications.getPermissionsAsync();
  if (!permission.granted) {
    setPushActive(false);
    return false;
  }

  // Kanallar token'dan ÖNCE: ilk bildirim, kanalı henüz olmayan bir cihaza
  // düşerse hiç görünmüyor.
  await ensureNotificationChannels();

  const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
  if (!projectId) {
    // ⚠️ Bu kısa devre şu an DAİMA tetikleniyor: `eas init` henüz çalıştırılmadı,
    // yani app.json'da `extra.eas.projectId` yok. Paketin kendi hatası
    // (ERR_NOTIFICATIONS_NO_EXPERIENCE_ID) tanınmaz olduğu için burada açıkça
    // yazıyoruz — push'un çalışmamasının sebebi kod değil, eksik yapılandırma.
    log('extra.eas.projectId yok (eas init çalıştırılmamış) — push kaydı yapılamıyor.');
    setPushActive(false);
    return false;
  }

  let token: string;
  try {
    token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  } catch (error) {
    // Çevrimdışıyken de fırlatıyor; bir sonraki ön plana dönüşte tekrar denenecek.
    log('Expo push token alınamadı:', error);
    setPushActive(false);
    return false;
  }

  const [[, storedToken], [, storedOwner]] = await AsyncStorage.multiGet([TOKEN_KEY, TOKEN_OWNER_KEY]);
  // Sahibi de karşılaştırıyoruz: ortak cihazda hesap değişiminde token aynı
  // kalıyor, sunucu onu yeni kullanıcıya yeniden atamalı — yoksa önceki sahip
  // yenisinin bildirimlerini almaya devam eder.
  if (storedToken === token && storedOwner === String(userId)) {
    setPushActive(true);
    return true;
  }

  const payload: PushDeviceRegistration = {
    token,
    provider: 'expo',
    platform: Platform.OS === 'ios' ? 'ios' : 'android',
    app_version: Constants.expoConfig?.version ?? undefined,
    os_version: Device.osVersion ?? undefined,
    device_name: Device.modelName ?? undefined,
    locale: currentLocale(),
  };

  try {
    await userNotificationAPI.registerDevice(payload);
  } catch (error) {
    log('Cihaz kaydı başarısız:', error);
    setPushActive(false);
    return false;
  }

  await AsyncStorage.multiSet([
    [TOKEN_KEY, token],
    [TOKEN_OWNER_KEY, String(userId)],
  ]);
  setPushActive(true);
  return true;
}

/**
 * Çıkışta çağrılıyor — `authAPI.logout()`'tan ÖNCE, çünkü POST'un canlı Bearer'a
 * ihtiyacı var (bkz. AuthContext.logout).
 */
export async function unregisterToken(): Promise<void> {
  setPushActive(false);

  let token: string | null = null;
  try {
    token = await AsyncStorage.getItem(TOKEN_KEY);
  } catch {
    return;
  }

  // Yerel kaydı her hâlükârda siliyoruz: sunucu isteği başarısız olsa bile bu
  // cihazda "kayıtlı" görünmesin, sonraki girişte tekrar POST edilsin.
  await AsyncStorage.multiRemove([TOKEN_KEY, TOKEN_OWNER_KEY]).catch(() => {});

  if (!token) return;
  try {
    await userNotificationAPI.unregisterDevice(token);
  } catch (error) {
    // Ağ hatası veya 401 — kalan temizlik backend'in receipt taraması
    // (DeviceNotRegistered) üzerinden yapılıyor (bkz. plan 3.4).
    log('Cihaz kaydı silinemedi:', error);
  }
}
