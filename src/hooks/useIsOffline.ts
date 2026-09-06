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
//      direkt 130 sayfasına düşmeli" isteği gecikme kaldırmıyor.
//   2. Uygulama daha önce çevrimiçi OLDUYSA — `false` sinyali 1.5 sn boyunca
//      kesintisiz sürerse kilitleniyor; kısa bir titreşim tüm ağacı
//      unmount/remount etmiyor. Çevrimiçiye dönüş her koşulda ANINDA.
const OFFLINE_DEBOUNCE_MS = 1500;

export function useIsOffline(): boolean {
  const { isConnected } = useNetworkState();
  const [debouncedOffline, setDebouncedOffline] = useState(isConnected === false);
  const hasBeenOnlineRef = useRef(isConnected === true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
        setDebouncedOffline(true);
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
