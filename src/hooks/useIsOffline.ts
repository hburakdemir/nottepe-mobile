import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { getNetworkStateAsync, useNetworkState } from 'expo-network';

// `isConnected` cihazın aktif bir ağ arayüzüne (wifi/hücresel) sahip olup
// olmadığını söylüyor — `isInternetReachable` ilk okumada genelde `undefined`
// olduğu için (henüz doğrulanmadı) onu bekletmek soğuk açılışta gereksiz bir
// "çevrimdışı" yanlış pozitifine yol açıyordu. Sadece `isConnected === false`
// kesin bir sinyal.
//
// HAM okuma gerçek cihazda ara sıra titreşiyor (kısa bir an `false` görünüp
// hemen `true`'ya dönüyor) — bu ham değeri doğrudan kullanan eski
// "OfflineEgoGate" tüm ağacı unmount/remount ediyordu (bkz. RootNavigator.tsx
// içindeki not). Bu yüzden burada iki kural var:
//   1. Uygulama daha önce hiç çevrimiçi OLMADIYSA (soğuk açılış zaten
//      çevrimdışı) — hiç BEKLETMEDEN kilitleniyor. "İnternet yokken açıldığında
//      direkt 130 sayfasına düşmeli" isteği gecikme kaldırmıyor. Tek istisna:
//      mount'tan sonraki ilk COLD_START_GRACE_MS — `expo-network`'ün native
//      tarafı soğuk açılışta ilk ölçümünü henüz doğrulamadan kısa süreliğine
//      `isConnected=false` dönebiliyor; bu pencere içinde gelen `false` bir
//      yanlış pozitif olabileceğinden pay veriliyor. Pencere dolduktan sonra
//      (hâlâ hiç çevrimiçi olunmadıysa) gelen `false` yine gecikmesiz kilitler.
//   2. Uygulama daha önce çevrimiçi OLDUYSA — `false` sinyali 1.5 sn boyunca
//      kesintisiz sürerse kilitleniyor; kısa bir titreşim tüm ağacı
//      unmount/remount etmiyor. Çevrimiçiye dönüş her koşulda ANINDA.
const OFFLINE_DEBOUNCE_MS = 1500;
// Soğuk açılışta native ağ durumunun oturması için tanınan doğrulama payı.
// Bu süre boyunca "hiç çevrimiçi olunmadı" dalı anında kilitlemek yerine
// bekliyor; gerçekten çevrimdışıysa yine de bu kısa payın sonunda kilitleniyor.
const COLD_START_GRACE_MS = 1200;

// ANDROID'DE OLAY AKIŞI TEK BAŞINA GÜVENİLİR DEĞİL — bu yüzden düzenli taze
// okuma yapılıyor. Sebep `expo-network`'ün (8.0.8) iki platformdaki native
// implementasyonunun farkı:
//
//   iOS (NetworkModule.swift) `NWPathMonitor` kullanıyor; `pathUpdateHandler`
//   yeni path'i ARGÜMAN olarak veriyor ve `isConnected` doğrudan o yükten
//   hesaplanıyor. Yeniden sorgu yok.
//
//   Android (NetworkModule.kt) `onLost` tetiklendiğinde olayın yükünü
//   kullanmıyor; `connectivityManager.activeNetwork`'ü YENİDEN SORGULUYOR.
//   `onLost` çağrıldığı anda `activeNetwork`'ün çoktan `null` olduğuna dair bir
//   sıralama garantisi yok — ölmekte olan ağı hâlâ döndürebiliyor, o zaman
//   `isConnected: true` yayınlanıyor. Uçak modunda bir daha yeni ağ
//   gelmeyeceği için `onAvailable` de hiç tetiklenmiyor: JS tarafı sonsuza
//   kadar bayat `true` ile kalıyor ve çevrimdışı kilidi hiç devreye girmiyor.
//
// `getNetworkStateAsync()` her çağrıldığında sistemi taze okuduğu için bu yarışı
// tamamen atlıyor. SADECE Android: iOS'ta aynı fonksiyon path argümanı olmadan
// çağrıldığında geçici bir `NWPathMonitor` kurup semafor üzerinde 5 sn'ye kadar
// BLOKLUYOR (NetworkModule.swift `getNetworkPathAsync`) — orada olay akışı zaten
// doğru çalıştığı için yoklamaya hiç girmiyoruz.
const ANDROID_POLL_MS = 2000;

export function useIsOffline(): boolean {
  const { isConnected: eventIsConnected } = useNetworkState();
  const [polledIsConnected, setPolledIsConnected] = useState<boolean | undefined>(undefined);
  const isAndroid = Platform.OS === 'android';
  // Android'de tek doğruluk kaynağı yoklama: olay akışı yukarıda anlatıldığı gibi
  // bayat `true`da takılabiliyor, dolayısıyla ikisini "true ise çevrimiçi" diye
  // birleştirmek hatayı geri getirirdi. Olay yine de işe yarıyor — aşağıdaki
  // efekt onu anında yeniden okuma tetikleyicisi olarak kullanıyor, böylece
  // bağlantı geri geldiğinde bir yoklama turu beklenmiyor.
  const isConnected = isAndroid ? polledIsConnected : eventIsConnected;

  // Başlangıç değeri her zaman `false`: `isConnected === false` ile başlamak,
  // soğuk açılıştaki doğrulanmamış native okumayı ilk render'da anında
  // "çevrimdışı" kilidine çeviriyordu (yanlış pozitif). Gerçek durum aşağıdaki
  // efekt içinde, COLD_START_GRACE_MS payı gözetilerek belirleniyor.
  const [debouncedOffline, setDebouncedOffline] = useState(false);
  const hasBeenOnlineRef = useRef(isConnected === true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Soğuk başlangıç doğrulama penceresinin hangi zamanda dolacağını hesaplamak
  // için mount anını bir kere sabitliyoruz.
  const mountedAtRef = useRef(Date.now());

  const readNetworkState = useCallback(async () => {
    try {
      const state = await getNetworkStateAsync();
      setPolledIsConnected(state.isConnected);
    } catch {
      // Okuma başarısızsa son bilinen değer korunuyor: burada `false`'a düşmek
      // ağ durumu hakkında bilgi vermeyen bir hatayı çevrimdışı kilidine
      // çevirirdi.
    }
  }, []);

  useEffect(() => {
    if (!isAndroid) return;

    readNetworkState();
    const interval = setInterval(() => {
      // Arka plandayken yoklamanın anlamı yok; öne dönüşte aşağıdaki AppState
      // dinleyicisi zaten hemen taze okuma yapıyor.
      if (AppState.currentState === 'active') readNetworkState();
    }, ANDROID_POLL_MS);
    const appStateSub = AppState.addEventListener('change', (next) => {
      if (next === 'active') readNetworkState();
    });

    return () => {
      clearInterval(interval);
      appStateSub.remove();
    };
  }, [isAndroid, readNetworkState]);

  useEffect(() => {
    if (!isAndroid) return;
    readNetworkState();
  }, [isAndroid, eventIsConnected, readNetworkState]);

  useEffect(() => {
    if (isConnected === true) {
      hasBeenOnlineRef.current = true;
    }
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    if (isConnected === false) {
      if (!hasBeenOnlineRef.current) {
        // Hiç çevrimiçi olunmadı: soğuk-açılış doğrulama payı henüz
        // dolmadıysa native tarafın toparlanması için kısa süre bekleniyor;
        // pay dolduysa (veya zaten dolmuşsa) eski davranış gibi ANINDA kilitlenir.
        const elapsedSinceMount = Date.now() - mountedAtRef.current;
        const remainingGrace = COLD_START_GRACE_MS - elapsedSinceMount;
        if (remainingGrace <= 0) {
          setDebouncedOffline(true);
        } else {
          timerRef.current = setTimeout(() => setDebouncedOffline(true), remainingGrace);
        }
      } else {
        timerRef.current = setTimeout(() => setDebouncedOffline(true), OFFLINE_DEBOUNCE_MS);
      }
    } else {
      // `true` ya da henüz `undefined` (belirlenmedi): çevrimdışı sayılmıyor.
      setDebouncedOffline(false);
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isConnected]);

  return debouncedOffline;
}
