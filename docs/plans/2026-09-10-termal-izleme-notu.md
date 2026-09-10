# Termal (ısınma) izleme — yapılacaklar notu

## Durum

Kullanıcı iOS'ta hâlâ ısınma bildiriyor (`2026-09-09-ios-performans-ve-bug-plani.md`'deki
Öncelik 1 fix'lerinden sonra bile). Xcode/Mac yok, Instruments ile ölçüm yapılamıyor. Bu
yüzden gerçek termal veriyi uygulama içinden toplamak gerekiyor.

## Soru: Firebase Crashlytics ısınmayı tespit eder mi?

**Hayır, doğrudan değil.** Crashlytics crash/ANR/non-fatal hata izliyor, cihaz sıcaklığı
veri modelinde yok. Firebase Performance Monitoring da dolaylı (frozen frames, yavaş
render) — santigrat/termal seviye vermiyor.

## Plan: gerçek termal veri toplama

Platformun kendi API'sini native modülle expose edip Firebase'e loglamak gerekiyor:

- **iOS:** `ProcessInfo.processInfo.thermalState` (nominal/fair/serious/critical)
- **Android:** `PowerManager.getCurrentThermalStatus()` (API 29+)

Uygulama: expo-dev-client üzerine küçük bir native modül/config plugin yazılıp, termal
durum "serious/critical"a her geçtiğinde:
- Crashlytics'e custom key/log, VEYA
- Firebase Analytics'e custom event

olarak gönderilecek. Bu sayede "hangi ekranda, hangi kullanıcıda, ne sıklıkla ısınıyor"
sorusuna gerçek veriyle cevap bulunabilir — kör kör fix denemek yerine.

## Ne zaman yapılacak

Kullanıcı başka bir işi bitirdikten sonra bu işe dönülecek — henüz başlanmadı.
