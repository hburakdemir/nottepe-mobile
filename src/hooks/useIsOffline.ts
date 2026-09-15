import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { getNetworkStateAsync, useNetworkState } from 'expo-network';
import { onlineManager } from '@tanstack/react-query';

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
//   2. Uygulama daha önce çevrimiçi OLDUYSA — `false` sinyali bu süre boyunca
//      kesintisiz sürerse kilitleniyor; kısa bir titreşim ekranı
//      çevrimdışına düşürmüyor. Çevrimiçiye dönüş her koşulda ANINDA.
//
// SÜRE 1500 -> 300 ms'ye İNDİ. Eski değer yüksek olmak ZORUNDAYDI, çünkü kilit
// `RootNavigator`'da erken bir `return` ile tüm ağacı (Drawer + Stack + Tab)
// unmount ediyordu: her titremede uygulama yıkılıp yeniden kuruluyordu, o
// yüzden titremeyi uzun bir pencereyle süzmek gerekiyordu. Kilit artık ağacın
// ÜSTÜNE binen bir katman (bkz. RootNavigator.tsx) — giriş/çıkış ucuz, yani
// kısa bir yanlış pozitifin bedeli de yalnızca bir kare. Kullanıcının
// şikâyeti ("internet kapanınca 130 sayfasının gelmesi 2-3 sn sürüyor, açınca
// hemen geliyor") bu iki sayının toplamıydı.
const OFFLINE_DEBOUNCE_MS = 300;
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
// 2000 -> 750 ms. Debounce ile birlikte en kötü algılama gecikmesi 3,5 sn'den
// ~1 sn'nin altına indi. Yoklamayı daha da sıklaştırmak cazip ama her tur bir
// native çağrı: ekran açıkken saniyede birden fazla sorgu, kazancı olmayan bir
// pil maliyeti olurdu. Arka planda hiç yoklanmıyor (aşağıdaki `isAppActive`).
const ANDROID_POLL_MS = 750;

// ÖNE DÖNÜŞ PAYI — `COLD_START_GRACE_MS`'in dönüş karşılığı, aynı sebeple var.
//
// Android ekran kapalıyken Wi-Fi'yi uykuya alıyor ve kilidi açtığında yeniden
// ilişkilendirme tipik olarak 1-3 saniye sürüyor. O pencerede
// `getNetworkStateAsync()` dürüstçe `isConnected: false` diyor — ama bu bir
// bağlantı KAYBI değil, henüz kurulmamış bir bağlantı. Pay olmadan kilit
// dönüşten 300 ms sonra biniyor ve kullanıcı hiçbir şey yapmadan üstüne
// çevrimdışı ekranı geliyor, 2 saniye sonra kendiliğinden kalkıyor.
//
// ⚠️ Bu risk 1.0.9'da ARTTI: debounce 1500'den 300 ms'ye indirildi (katman
// değişikliğiyle birlikte), yani yanlış pozitife düşme penceresi beşe katlandı.
// Pay o yüzden debounce ile aynı turda konmalıydı.
//
// Çevrimiçiye dönüş bu paydan ETKİLENMİYOR: pay yalnızca kilitlenmeyi
// geciktiriyor, açılmayı değil.
const RESUME_GRACE_MS = 2500;

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
  // Son öne dönüş anı. `0` = hiç dönüş olmadı (soğuk açılış), o durumda
  // `RESUME_GRACE_MS` payı hiç uygulanmıyor — soğuk açılışın kendi payı var.
  const lastResumeAtRef = useRef(0);

  // KİLİT YALNIZCA ÖN PLANDA DEĞİŞEBİLİR.
  //
  // Android ekran kapalıyken Wi-Fi'yi düzenli olarak uykuya alıyor (Doze /
  // Wi-Fi sleep) ve yukarıdaki yoklama bu kayıpları güvenilir biçimde görüyor.
  // Arka planda ölçülen bir bağlantı kaybının kullanıcı deneyiminde karşılığı
  // yok: kimse bakmıyor. Kilit yalnızca kullanıcı gerçekten ekrana bakarken
  // anlamlı, o yüzden ön plana dönene kadar mevcut değerinde donduruluyor.
  // Dönüşte bu efekt yeniden çalışıyor ve taze okumayla karar veriyor.
  //
  // Bu koruma 1.0.8'de, kilit HÂLÂ tüm ağacı unmount ederken eklendi; o zaman
  // gerekçesi "öne dönüşte ağacın sıfırdan kurulmasını önlemek"ti. Kilit
  // katmana dönüştüğü için (bkz. RootNavigator.tsx) o gerekçe artık geçersiz,
  // ama koruma YERİNDE KALIYOR — şimdi iki işe yarıyor: arka planda boşa
  // native yoklama yapılmıyor ve `onlineManager` kullanıcı yokken gereksizce
  // kapatılıp açılmıyor (aşağıdaki nota bak).
  const [isAppActive, setIsAppActive] = useState(AppState.currentState === 'active');
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => setIsAppActive(next === 'active'));
    return () => sub.remove();
  }, []);

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
      if (next !== 'active') return;
      lastResumeAtRef.current = Date.now();
      // BAYAT DEĞERİ ÖNCE TEMİZLİYORUZ, sonra taze okuma yapıyoruz. Sıra
      // önemli: arka plana alınmadan önceki son okuma `false` ise (ör. ekran
      // kapanırken Wi-Fi düşmüştü), taze okuma dönene kadar o `false` geçerli
      // sayılırdı ve 300 ms'lik debounce bitip kilit binebilirdi. `undefined`,
      // aşağıdaki "true ya da henüz undefined → çevrimdışı sayılmıyor" dalına
      // düşüyor, yani bayat değeri ANINDA etkisizleştiriyor.
      setPolledIsConnected(undefined);
      readNetworkState();
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

    // Ön planda değilsek karar verilmiyor: bekleyen zamanlayıcı yukarıda zaten
    // iptal edildi, `debouncedOffline` olduğu değerde kalıyor (bkz. yukarıdaki
    // `isAppActive` notu). Ön plana dönüşte `isAppActive` değiştiği için bu
    // efekt yeniden çalışıyor.
    if (!isAppActive) return;

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
        // Normal debounce, AMA öne dönüş payı doluyorsa o bekleniyor: dönüşten
        // hemen sonraki `false` okumaları Wi-Fi yeniden ilişkilendirmesi
        // olabiliyor (bkz. RESUME_GRACE_MS). Pay geçtikten sonra hâlâ
        // çevrimdışıysa normal debounce ile kilitleniyor — yani gerçek bir
        // bağlantı kaybı gecikmiyor, yalnızca dönüşün ilk 2,5 saniyesi
        // kilitlenmeye kapalı.
        const sinceResume = Date.now() - lastResumeAtRef.current;
        const resumeWait = Math.max(0, RESUME_GRACE_MS - sinceResume);
        timerRef.current = setTimeout(() => setDebouncedOffline(true), Math.max(OFFLINE_DEBOUNCE_MS, resumeWait));
      }
    } else {
      // `true` ya da henüz `undefined` (belirlenmedi): çevrimdışı sayılmıyor.
      setDebouncedOffline(false);
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isConnected, isAppActive]);

  // react-query'ye de haber veriyoruz ve bu ZORUNLU, süs değil.
  //
  // Kilit eskiden tüm ağacı unmount ettiği için çevrimdışıyken arkada istek
  // atacak bir ekran kalmıyordu. Katmana dönüşünce ağaç ayakta kaldı — yani
  // aksi hâlde arkadaki ekranlar istek atmaya devam eder, hepsi hataya düşer
  // ve kullanıcının KAPATILMIŞ şikâyeti geri dönerdi: "internet yoksa notlar
  // yüklenemedi profiller yüklenemedi gönderi yüklenemedi vs olmamalı".
  //
  // `onlineManager` kapalıyken `networkMode` varsayılanı ('online') gereği
  // sorgular DURAKLIYOR: istek gitmiyor, hata üretilmiyor, mevcut cache
  // olduğu gibi kalıyor. Bağlantı gelince duraklayanlar kendiliğinden devam
  // ediyor — elle yeniden tetiklemeye gerek yok.
  //
  // Not: react-query'nin kendi varsayılan çevrimiçi algılaması RN'de ölü
  // (tarayıcının `online`/`offline` olaylarını dinliyor, o olaylar burada hiç
  // yok) ve bu yüzden her zaman "çevrimiçi" diyordu. Tek yazan taraf burası.
  useEffect(() => {
    onlineManager.setOnline(!debouncedOffline);
  }, [debouncedOffline]);

  return debouncedOffline;
}
