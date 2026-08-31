# Nottepe Mobile — React Native Yol Haritası

## Durum (2026-08-31 itibarıyla) — Faz 0-4 tamamlandı, sırada Faz 5 var

Faz 0, 1, 2, 3 ve 4 tamamlandı — ayrıca PLAN.md'nin orijinal kapsamının dışında,
web'de olup mobilde hiç UI'ı olmayan (ama `api.ts`'de client'ı zaten hazır duran)
şu özellikler de eklendi: Not İstekleri, SSS, Öneriler, Yemek Listesi, Liderlik
Tablosu, Yardım/Geri Bildirim formu. Ayrıca eksik olan KVKK + fakülte/bölüm
zorunlu onay kapısı (`KvkkGateModal`) eklendi, kayıt formundaki gerçek bir alan-adı
uyuşmazlığı bug'ı (`fullName`/`passwordConfirm`) düzeltildi, ve alt tab bar'da
hiç tanımlı olmayan `tabBarIcon` yüzünden bazı cihaz fontlarında tofu/kutu
görünen ikonlar web'in `MobileTabBar.jsx`'iyle birebir eşleştirildi
(Home/Library/PlusCircle/Wrench/Bell/User, lucide-react-native).

Kod tarafında Faz 0'ın bıraktığı iki borçtan biri zaten çözülmüş durumda:
**hesap silme** endpoint'i backend'de var (`DELETE /api/users/me`,
`deleteMyAccountController`, migration `041_account_deletion.sql`) ve mobil
`DeleteAccountModal` bunu tüketiyor — Apple'ın App Store Guideline 5.1.1(v)
şartı için gerekliydi, artık kapalı.

**Sırada Faz 5 — Cilalama ve Yayın var**, bkz. aşağıdaki "Faz 5" bölümü. Kalan
somut işler:
1. Refresh token endpoint'i hâlâ yok (acil değil — access token 30 gün ömürlü,
   kullanıcı sık sık login'e düşmüyor — ama store'a çıkmadan önce eklenmesi
   daha sağlıklı olur).
2. Deep linking (post/profil linkine tıklayınca app'in açılması).
3. Splash/icon/store görselleri + EAS Build kurulumu (iOS/Android derleme).
4. Sentry gibi crash/analytics izleme (web'de yok, mobilde ilk kurulacak).
5. Store hesapları/süreci — bkz. "Store Deploy Süreci" bölümü: Apple Developer
   ($99/yıl) + Google Play Console ($25 tek seferlik), gizlilik politikası
   URL'i, Google'ın zorunlu 20 kişilik/14 günlük kapalı test süreci, ekran
   görüntüleri, review süreleri. Bunlar kullanıcının hesap açması/ödeme yapması
   gereken adımlar, kod tarafında ilerletilemez.

Geliştirme ortamı notu: bu makinede sudo'suz kurulmuş bir Android SDK + emulator
(`~/Android/Sdk`, AVD adı `nottepe_test`) VE artık Android Studio da
(`~/android-studio`) var, ikisi de aynı SDK'yı paylaşıyor — aynı anda sadece TEK
`nottepe_test` instance'ı çalıştırılabilir (ikinci instance crash eder). Lokal
backend testi için `server/.env`'deki `DATABASE_URL` şu an `nottepe_2608`
veritabanına (26 Ağustos yedeği) işaret ediyor; mobil `.env.local` ise
`http://10.0.2.2:5000/api` (Android emulator host-loopback) kullanıyor —
prod derlemede `.env.production` (`https://nottepe.com/api`) devreye giriyor.

## Context

Nottepe web'i taşıyoruz: Express (ESM, cookie'de httpOnly JWT) + PostgreSQL backend (`~/Masaüstü/fs/nottepe/nottepe/server`), React 18/Vite/Tailwind client. Bu klasör (`~/Masaüstü/nottepe-mobile`) React Native uygulamasının kod tabanı olacak — proje klasörünün dışında, masaüstünde ayrı bir repo olarak tutuluyor. Backend **aynen kalıyor**, sunucu zaten canlı ve çalışıyor — mobil, `server/routes/*`'daki mevcut REST API'yi tüketecek; yeni feature'lar önce web'de değil, ihtiyaç oldukça ortak backend'de açılacak.

**Kapsam referansı** (web'deki mevcut sayfalar → mobilde karşılığı planlanacak): Ana sayfa/akış, Bölümler, Post detay + yorum, Not istekleri, Öneriler, SSS, Profil (kendi/başkası), Bildirimler, Checklist (GANO/AKTS/mezuniyet listeleri — `araclar/`), Ders programı (schedule), Avatar builder, Auth (login/register/forgot-reset/verify-email), Admin panel (muhtemelen mobile'a hiç taşınmayacak — web'de kalır).

---

## Kritik Mimari Kararlar (önce bunlar netleşmeli)

### 1. Auth: httpOnly cookie mobilde çalışmaz
`middleware/auth.js` `req.cookies?.accessToken` okuyor; React Native'de `fetch`/`axios` cookie jar'ı web'deki gibi otomatik yönetmez (iOS/Android arasında da tutarsız). İki seçenek:
- **(Önerilen) Dual-mode auth**: Login/refresh endpoint'i mobil istemciden geldiğinde (`X-Client: mobile` header'ı veya ayrı `/api/auth/mobile-login`) cookie yerine JSON body'de `accessToken` + `refreshToken` döner; `authenticateToken` önce `Authorization: Bearer` header'ına, yoksa cookie'ye bakacak şekilde genişler. Web tarafı hiç değişmez.
- Alternatif: RN tarafında cookie jar kütüphanesi (`@react-native-cookies/cookies`) ile cookie'yi manuel yönet — kırılgan, tavsiye edilmez.

Refresh token akışı şu an yok (root PLAN.md'de de not düşülmüş: "refresh token/revocation yok"). Mobilde token süresi (şu an muhtemelen kısa ömürlü access token) kullanıcıyı sık sık login'e düşürmemesi için **refresh token endpoint'i Faz 0'da backend'e eklenmeli** — zaten web için de bekleyen bir borç.

### 2. Framework: Expo (managed) mi, bare RN mi?
**Expo** ile başlıyoruz: tek geliştirici için hızlı setup, OTA update (EAS Update), push notification (Expo Push) ve build (EAS Build) pipeline'ı hazır geliyor; native modül ihtiyacı çıkarsa (`expo prebuild` ile) bare'e geçiş her zaman mümkün. Bu projede native modül gereksinimi düşük (kamera/dosya yükleme = `expo-image-picker`/`expo-document-picker` yeterli).

### 3. State/veri katmanı
- Sunucu state: **TanStack Query (react-query)** — web'de yok ama mobilde cache/refetch/optimistic update için doğru araç, ilk günden kur.
- Client state: Context zaten var (`AuthContext`, `SavedPostContext`) — RN'e aynen taşınabilir, ek kütüphaneye gerek yok (Zustand gerekirse sonra eklenir).
- API katmanı: `client/src/services/api.js`'deki axios instance + interceptor mantığı (401 → login'e yönlendirme) RN'e adapte edilecek; base URL `expo-constants`/`.env` (`EXPO_PUBLIC_API_URL`) üzerinden.

### 4. Görsel/dosya yükleme
Post ekleme, avatar builder, checklist gibi yerlerde dosya/görsel var — `expo-image-picker` + mevcut multer endpoint'lerine `multipart/form-data` ile aynı şekilde post edilecek, backend değişmeyecek.

### 5. Push notification
Web'de bildirim sistemi DB tabanlı (`notificationRoutes.js`, in-app). Mobilde gerçek push için **Expo Push Notifications** (ücretsiz, APNs/FCM'i sarmalıyor) — backend'e `push_tokens` tablosu + bildirim oluşturulduğunda Expo push API'sine fire-and-forget istek atan küçük bir servis eklenecek (yeni ama izole; mevcut notification akışını bozmaz).

---

## Faz 0 — Ortam ve Backend Ön Koşulları ✅ (tamamlandı)

1. `mobile/` içinde `npx create-expo-app@latest . --template blank-typescript` (TypeScript ile başla — API cevap şekilleri net değilse tip hataları erken yakalanır).
2. Backend: `Authorization: Bearer` desteği için `authenticateToken` genişlet (madde 1); `/api/auth/refresh` endpoint'i ekle (refresh token DB'de `token_version` mantığına benzer şekilde saklanır/invalide edilir).
3. Backend: `push_tokens(user_id, expo_token, platform, created_at)` migration'ı (root `PLAN.md`'deki migration altyapısı örüntüsünü takip et: `server/migrations/00X_push_tokens.sql`).
4. CORS: mobil origin'siz istek atacağı için `server/index.js`'deki CORS ayarının native app istekleriyle (origin header yok) çalıştığını doğrula.
5. EAS hesabı + `eas.json` (development/preview/production build profilleri) — gerçek cihazda test için development build şart (Expo Go, custom native modül gerekmediği sürece yeterli olabilir; auth/push için genelde development build'e geçilir).

## Faz 1 — İskelet + Auth ✅ (tamamlandı)

- Navigasyon: `@react-navigation/native` (stack + bottom-tabs) — web'deki `MobileTabBar.jsx` sekmelerini birebir bottom-tab olarak düşün (Ana Sayfa, Bölümler, Ekle, Bildirimler, Profil).
- `AuthContext` port: login/register/forgot-password/reset-password/verify-email ekranları; token'lar `expo-secure-store`'da saklanır (AsyncStorage değil — access/refresh token hassas).
- Axios instance + 401 interceptor → refresh token ile sessiz yenileme, olmazsa login'e düş (web'deki mantığın aynısı).
- Onboarding akışı varsa (`onboardingRoutes.js` mevcut) ilk açılışta port et.

## Faz 2 — Çekirdek İçerik Akışı ✅ (tamamlandı)

- Ana Sayfa: post feed (infinite scroll → `FlatList` + react-query `useInfiniteQuery`), `PostCard` → RN karşılığı.
- Post detay + yorumlar (`CommentSection`, `CommentModal`) — yorum ekleme/silme, rating.
- Bölümler (`DepartmentsPage`, `DepartmentDetailPage`) + bölüm takip (`departmentFollowRoutes.js`).
- Post ekleme (`AddPostPage`) — dosya/görsel yükleme dahil.
- Kayıtlı postlar (`SavedPostContext`).

## Faz 3 — Profil, Rozet, Bildirim ✅ (tamamlandı)

- Profil / başkasının profili, avatar görüntüleme (`AvatarDisplay`) — builder'ı Faz 4'e bırak (karmaşık SVG config UI, mobilde yeniden tasarım gerektirebilir).
- Rozetler (`BadgeChip`, `leaderboardRoutes.js`).
- Bildirimler: in-app liste + Expo push entegrasyonu (token kaydı `useEffect` ile login sonrası backend'e POST).

## Faz 4 — Araçlar (Checklist/GANO/AKTS) ve Ders Programı ✅ (tamamlandı)

- Bu web'deki en karmaşık UI kümesi (`ChecklistCard`, `ChecklistEditModal`, `ChecklistStatsModal`, `gano/`, `schedule/`) — mobilde native form/modal pattern'lerine (bottom-sheet, `@gorhom/bottom-sheet`) yeniden tasarlanacak, component'lerin birebir portu yerine.
- Avatar builder: SVG parça seçimi mobilde de `react-native-svg` ile yapılabilir; öncelik düşük.

## Faz 5 — Cilalama ve Yayın 🔜 (SIRADA — yarın buradan devam)

- Deep linking (post/profil linklerini paylaşınca app'te açılması — `expo-router` kullanılıyorsa native, kullanılmıyorsa `expo-linking` + `Linking` config).
- Splash/icon/store assets, EAS Build (iOS/Android), TestFlight + Play Internal Testing.
- Analytics/crash reporting (Sentry — web'de yoksa mobilde ilk kurulacak izleme katmanı olabilir, ayrı karar).

---

## Store Deploy Süreci — Maliyet ve Şartlar

Backend zaten canlı (`server/`) — mobil için ek altyapı maliyeti yok, sadece store hesapları + build servisi.

### Hesap ücretleri
| Kalem | Ücret | Not |
|---|---|---|
| Apple Developer Program | $99/yıl | Bireysel de yeterli; şirket hesabına gerek yok. Mac'e gerek yok — EAS Build bulutta derliyor. |
| Google Play Console | $25 tek seferlik | Ömür boyu, tek geliştirici hesabına tüm app'ler bağlanır. |
| EAS Build/Submit | Free tier'da başla | Ücretsiz plan aylık sınırlı build + kuyruk süresi içerir, solo geliştirici için genelde yeterli; öncelikli/hızlı build gerekirse ücretli plana geçilir (güncel rakamlar için expo.dev/pricing — sık değişiyor, şu an tam rakam vermiyorum). |
| Expo Push Notifications | Ücretsiz | APNs/FCM'i sarmalıyor, ek ücret yok. |

### Apple'a özgü şartlar (kritik gap'ler)
1. **Hesap silme zorunlu** (App Store Guideline 5.1.1(v)): Uygulama içinde kayıt/login varsa, kullanıcı hesabını uygulama içinden de silebilmeli. Şu an backend'de sadece `deleteUserByAdminController` var (`userRoutes.js:39`, admin-only) — **kullanıcının kendi hesabını silebileceği bir endpoint yok**. Bu, Faz 0'a eklenmesi gereken bir backend işi (mobil olmasa da web'e de eklenebilir zaten borç).
2. **Gizlilik politikası URL'i** zorunlu (App Store Connect'te girilir) + **Privacy Nutrition Label** (hangi veri toplanıyor: email, kullanım verisi vb. deklare edilir). Şu an `KvkkPage.jsx` var ama bu KVKK metni — store'un istediği "Privacy Policy" formatına uyup uymadığı kontrol edilmeli, muhtemelen küçük eklemeyle yeterli olur.
3. Review süresi genelde 24-48 saat (ilk submission'da ret gelirse tur başına +1-2 gün).
4. Ekran görüntüleri: 6.7" ve 6.5" iPhone boyutları zorunlu (iPad desteklenmiyorsa iPad ekran görüntüsü istenmez).

### Google Play'e özgü şartlar
1. **Yeni geliştirici hesapları için kapalı test zorunluluğu**: Production'a çıkmadan önce en az **20 test kullanıcısıyla 14 gün kesintisiz kapalı test** (closed testing track) tamamlanmalı — 2023'ten beri tüm yeni hesaplara uygulanıyor, atlanamaz.
2. **Data Safety formu**: hangi verinin toplandığı/paylaşıldığı beyan edilir (Play Console'da form, kod değişikliği gerektirmez).
3. Gizlilik politikası URL'i burada da zorunlu (aynı sayfa Apple ile paylaşılabilir).
4. İçerik derecelendirme anketi (IARC) — birkaç dakikalık form.
5. İlk review birkaç saat–birkaç gün; güncellemeler genelde saatler içinde onaylanıyor.

### Sürüm/güncelleme akışı
- Native değişiklik (yeni izin, yeni native modül) içeren her sürüm → yeniden `eas build` + `eas submit` + store review'dan geçer.
- Sadece JS/UI değişikliği (bug fix, metin, stil) → **EAS Update (OTA)** ile store review'suz anında yayılır — bu yüzden Faz 0'da EAS Update kurulumu ucuz bir yatırım.
- Versiyon numarası: `app.json`'da `version` (kullanıcıya görünür) + iOS `buildNumber` / Android `versionCode` (her submission'da artmalı) — EAS'ın `autoIncrement` ayarıyla otomatikleştirilebilir.

---

## Açık Sorular (kullanıcıya sorulacak, şimdilik varsayımla ilerleniyor)
- Admin panel mobile'a hiç girmeyecek mi, yoksa moderatör için minimal bir "bildirim onaylama" ekranı istenecek mi? (Varsayım: hayır, web'de kalır.)
- Expo Go ile mi geliştirilecek yoksa doğrudan development build mi? (Push/secure-store test edilecekse development build gerekir — Faz 0'da netleşecek.)
- iOS + Android ikisi birden mi, yoksa önce tek platform mu? (Varsayım: Expo zaten ikisini aynı anda hedefler, ek maliyeti yok.)
