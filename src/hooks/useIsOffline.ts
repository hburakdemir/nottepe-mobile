import { useEffect, useRef, useState } from 'react';
import { useNetworkState } from 'expo-network';

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

export function useIsOffline(): boolean {
  const { isConnected } = useNetworkState();
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
