# Nottepe Mobile — Test Bulguları + Push Bildirim Altyapısı

⚠️ **Implementation Plan:** Bölüm 1-2 için detaylı execution planı `/home/ryder/.claude/plans/graceful-honking-lemon.md`'de kayıtlı ve onaylandı. Bkz. Bölüm 1 & 2 Implementation Strategy.

## Context

Önceki turlarda 14 maddelik istek listesi uygulandı (tema CSS-değişken göçü, sekme
navigatörü, ortak seçim modalı, bildirim kaydırma aksiyonları, klavye, ana sayfa yeniden
tasarımı…). Ardından uygulama **Android 14 emülatöründe Expo Go ile** uçtan uca test edildi
(yerel sahte API ile giriş yapılıp gerçek akışlar gezildi).

Test sırasında 5 hata bulunup anında düzeltildi. Bu plan, testte tespit edilen ama **henüz
düzeltilmemiş** kalemleri, ortaya çıkan **gereksiz backend yükünü**, ve kullanıcının ayrıca
istediği **cron'lu + manuel push bildirim** altyapısını kapsıyor.

Amaç: uygulamayı görsel olarak tutarlı hâle getirmek, açılıştaki gereksiz istekleri kesmek,
ve cron tip listesi sonradan geldiğinde **uygulama sürümü çıkmadan** büyüyebilecek bir
bildirim altyapısı kurmak.

---

# Bölüm 1 — Görsel / işlevsel eksikler

## 1.1 Auth ekranlarını temaya bağla ⚠️ en görünür eksik

5 auth ekranı tema göçünün dışında kaldı: hiçbirinde `className` yok (0 adet), tüm renkler
`StyleSheet` içinde sabit hex. Emülatörde doğrulandı — koyu temada **beyaz sayfa + bej
başlık** karışımı çıkıyor (AuthHeader token kullanıyor, sayfanın geri kalanı kullanmıyor).

Dosyalar: `LoginScreen` · `RegisterScreen` · `ResetPasswordScreen` ·
`ForgotPasswordScreen` · `VerifyEmailScreen` (hepsi `src/screens/auth/`)

**Yaklaşım:** className'e çevirmek layout regresyonu riski taşıyor. `StyleSheet` sadece
ölçü/tipografi için kalsın, renkler `useThemeColors()` ile inline verilsin — bu
`src/components/CommentSection.tsx`'da zaten uygulanmış ve test edilmiş desen.

| Mevcut hex | Token |
|---|---|
| `#fff` (sayfa) | `colors.ground` |
| `#fff` (input/kart) | `colors.surface` |
| `#374151` (etiket) | `colors.ink2` |
| `#111827` (input yazısı) | `colors.ink` |
| `#6b7280` / `#9ca3af` | `colors.muted` / `colors.muted2` |
| `#d1d5db` (çerçeve) | `colors.line` |
| `#fef2f2` / `#fecaca` / `#b91c1c` | `colors.dangerSoft` / `dangerLine` / `danger` |
| `#f0fdf4` / `#bbf7d0` / `#15803d` | `colors.successSoft` / `successLine` / `success` |
| `#2F5755` + üstündeki `#fff` | değişmez — temadan bağımsız marka |

**Ön koşul:** `src/theme/palette.ts` `THEME_COLORS` şu an `dangerSoft`, `dangerLine`,
`successSoft`, `successLine` alanlarını dışa vermiyor — eklenecek (değerler
`LIGHT_VARS`/`DARK_VARS`'ta zaten var).

## 1.2 Çift başlıkları kaldır

Üst bar artık sayfa adını yazıyor; 9 ekranda aynı metin H1 olarak da duruyor. Ekran H1'i
(ve varsa altındaki alt yazı) kaldırılacak.

`DepartmentsScreen` · `ToolsScreen` · `CafeteriaMenuScreen` · `FaqScreen` ·
`NoteRequestsScreen` · `SuggestionsScreen` · `ScheduleScreen` · `ChecklistsScreen` ·
`LeaderboardScreen`

`HelpScreen`'in H1'i "Biz Kimiz" — üst bar başlığından farklı, **kalacak**.

## 1.3 Duyuru kartındaki rozeti yerel "okunmadı" tercihine bağla

`NotificationsScreen` — Duyurular sekmesinde "Okunmadı" aksiyonu çalışıyor ama kart hâlâ
sunucudaki `is_viewed`'a bakıyor, aksiyonun görsel karşılığı yok. `AnnouncementCard`'a
`unread` prop'u eklenip `prefs.unread.has(id)` ile birleştirilecek (Aktivite'de zaten böyle).

## 1.4 Bildirimlerde "daha fazla yükle"

`userNotificationAPI.getAll({page,limit})` sayfalı ama ekran `limit: 30` ile tek sefer
çekiyor; 30'dan eskisi hiç görünmüyor. `onEndReached` + `page` durumu eklenecek
(desen: `FaqScreen`).

## 1.5 Silme için geri alma

Kaydırıp "Sil" kalıcı ve sessiz. `src/lib/notificationPrefs.ts`'e `unhide` eklenip kısa
süreli "Geri al" şeridi gösterilecek.

## 1.6 `ScheduleScreen` tip hatası

`react-native-view-shot` `ViewShotRef` diye bir tip dışa vermiyor (`src/index.d.ts` yalnızca
`CaptureOptions`, `ViewShotProperties`, default `class ViewShot`, `captureRef`,
`releaseCapture`, `captureScreen` veriyor). `tsc`'nin tek hatası bu, bu turlardan önce de
vardı. Düzeltme: import'tan `type ViewShotRef` çıkarılıp `useRef<ViewShot>(null)`.

---

# Bölüm 2 — Gereksiz backend yükü

## 2.1 Menü sayaçları için tek uç ⚠️ en yüksek getirili

`MenuDrawerContent.tsx:334-350` — menü **her açıldığında** 3 istek atıyor, üçü de sadece bir
sayı için tam liste indiriyor:

```
notificationAPI.getActive()   → tüm aktif duyurular, sadece .length okunuyor
postsAPI.getMyPosts()         → tüm notlarım,        sadece .length okunuyor
savedPostsAPI.getSavedPosts() → tüm kaydettiklerim,  sadece .length okunuyor
```

**Backend'e eklenecek:** `GET /me/stats` → `{ posts, saved, unreadBroadcast, unreadPersonal }`.

## 2.2 Profil sekmelerini tembel yükle

`ProfileScreen.tsx:141-160` `fetchAll` mount'ta **8 paralel istek** atıyor. Profil artık
kalıcı bir sekme olduğu için bunlar **uygulama açılır açılmaz** koşuyor, oysa kullanıcı
sadece "Postlar"ı görüyor.

- Açılışta kalacak: `getMyPosts`, `badgeAPI.getMine`
- Sekmeye taşınacak: `aktsAPI.getAll`, `checklistAPI.getMine`, `scheduleAPI.getMine`,
  `departmentFollowAPI.getMine`, `savedPostsAPI.getSavedPosts`

Desen dosyada zaten var: `forums` sekmesi (~satır 172) tam olarak böyle çalışıyor.

## 2.3 Avatar iki kez çekiliyor

`fetchAll` içindeki `avatarAPI.get()` kaldırılacak; ekran `useMyAvatar` (react-query
`MY_AVATAR_KEY`) üzerinden okuyacak — üst bar ve tab bar zaten oradan besleniyor.

## 2.4 `SavedPostContext` tüm listeyi indiriyor

`SavedPostContext.tsx:35` açılışta tüm kaydedilen notları indirip sadece **id listesine**
dönüştürüyor. **Backend'e eklenecek:** `GET /saved-posts/ids` → `string[]`.

## 2.5 Sayfalama olmayan uçlar

`/posts/my-posts` · `/saved-posts/getPost` · `/akts` · `/checklists/mine` · `/schedule/me` ·
`/department-follows/mine` · `/badges/me` · `/notifications/all` · `/notifications/active` ·
`/leaderboard` · `/note-requests/mine` · `/faq/activity/:id` · `/suggestions/activity/:id` ·
`/users/:u/{checklists,akts,schedule,follows,saved-posts}`

Çoğu bugün küçük. Sınırsız büyüyecek ikisi öncelikli: **`/posts/my-posts`** ve
**`/saved-posts/getPost`** — `?page&limit` eklenip sonsuz kaydırmaya bağlanacak.

## 2.6 Küçük ayarlar

- `notificationAPI.getCategories()` Bildirimler her açıldığında çekiliyor → react-query + uzun `staleTime`
- Zil sayacı 60 sn poll → Bölüm 3'te push devreye girince 5 dk'ya çekilecek (güvenlik ağı)

---

# Bölüm 3 — Push bildirimleri

## Verilen kararlar

1. **Gerçek push.** Expo Go bırakılacak, dev build'e geçilecek.
2. **Paket adı şimdi değişecek** (`com.anonymous.nottepemobile` → yenisi).
3. Tercihler **ayrı uçta** (`/user-notifications/preferences`).
4. Tercih arayüzü **Bildirimler ekranının içinde** (sağ üstte dişli).
5. Cron tip listesi sonra gelecek → altyapı **sunucu-güdümlü** olacak.

## 3.0 Bloklayıcı ön koşullar

| # | Koşul | Durum |
|---|---|---|
| 1 | JDK 17 | ❌ makinede yok. Ya kur (`expo run:android`) ya da `eas build --profile development` kullan |
| 2 | `eas.json`'da `development` profili | ❌ yok — `developmentClient: true`, `distribution: "internal"`, apk ile eklenecek |
| 3 | Expo hesabı + `eas init` (`extra.eas.projectId`) | ❌ yok — **token bu olmadan hiç üretilmez** |
| 4 | Firebase projesi + **nihai paket adıyla** Android uygulaması | ❌ yok — paket adı `google-services.json`'a gömülü, önce rename |
| 5 | `eas credentials` → FCM V1 service account yükleme | ❌ yok — **"token üretiliyor ama hiçbir şey gelmiyor"nun 1 numaralı sebebi** |
| 6 | Gerçek cihaz | Emülatörde push token alınamaz |

> ⚠️ `google-services.json` uygulamada bulunması **gerekli ama yeterli değil**. FCM service
> account'u ayrıca EAS'a yüklenmezse token sorunsuz üretilir ve hiçbir bildirim ulaşmaz.

## 3.1 Sağlayıcı: **Expo Push Service**

| | Expo push | Bare FCM |
|---|---|---|
| Backend gönderim | `POST exp.host/--/api/v2/push/send`, düz JSON | FCM v1 → service account ile OAuth2 döngüsü |
| `data` gövdesi | **İç içe JSON korunur** → `target: {screen, params}` olduğu gibi geçer | **Tüm değerler string olmak zorunda** → stringify/parse |
| Ölü token temizliği | Receipts API → `DeviceNotRegistered` | Gönderim başına `UNREGISTERED` |
| iOS eklenince | Aynı kod, EAS'a APNs anahtarı | Baştan ikinci entegrasyon |

**Öneri: Expo push.** Backend ayrı bir repo ve OAuth2 token döngüsü yazmak istenmiyor;
iç içe `data` desteği aşağıdaki derin-bağlantı sözleşmesini doğrudan mümkün kılıyor.
Tek maliyet: Expo'nun relay'i teslimat yoluna giriyor. Azaltma: kayıt gövdesine
`provider: "expo" | "fcm"` alanı konsun — ileride geçiş, tek sabit + backend gönderici
değişimi olur, şema göçü gerekmez.

## 3.2 Native kurulum — **hepsi `app.json` üzerinden**

⚠️ **Kritik:** `.gitignore` `/android` ve `/ios`'u **yok sayıyor** (sadece gradle wrapper
force-track'li — `git ls-files android` = 2 dosya) ve CI her derlemede
`npx expo prebuild --clean` çalıştırıyor. Yani `android/` altında **elle hiçbir şey
düzenlenemez**; her native ayar `app.json` / config plugin üzerinden ifade edilmeli.

```
npx expo install expo-notifications expo-device expo-constants
npx expo install --dev expo-dev-client
```

`expo-constants` şu an sadece transitive — **doğrudan bağımlılık olmalı**, çünkü token
çağrısı `Constants.expoConfig.extra.eas.projectId` okuyor. Sürümleri elle yazma,
`expo install` SDK'nın sürüm haritasını okur.

`app.json`:
```jsonc
{
  "expo": {
    "scheme": "nottepe",
    "android": {
      "package": "com.nottepe.app",
      "googleServicesFile": "./google-services.json",
      "blockedPermissions": [
        "android.permission.SCHEDULE_EXACT_ALARM",
        "android.permission.USE_EXACT_ALARM"
      ]
    },
    "plugins": [
      "expo-secure-store", "expo-font",
      ["expo-notifications", {
        "icon": "./assets/notification-icon.png",
        "color": "#2F5755",
        "defaultChannel": "default",
        "enableBackgroundRemoteNotifications": false
      }]
    ],
    "extra": { "eas": { "projectId": "<eas init çıktısı>" } }
  }
}
```

- Plugin `POST_NOTIFICATIONS`, FirebaseMessagingService ve meta-data'yı kendisi enjekte
  ediyor — `AndroidManifest.xml`'e elle hiçbir şey yazılmıyor.
- `blockedPermissions`: plugin yerel zamanlanmış bildirimler için exact-alarm izinlerini
  ekliyor; bu uygulama yalnızca uzaktan push alıyor ve `SCHEDULE_EXACT_ALARM` Play Console'da
  politika beyanı gerektiriyor. Şimdi çıkarmak ucuz, sonra dert.
- **`icon` YENİ bir dosya olmalı**: 96×96, saf beyaz-üstü-şeffaf PNG
  (`assets/notification-icon.png`). `assets/android-icon-monochrome.png` **kullanılamaz** —
  şeffaf olmayan tek piksel bile durum çubuğunda dolu beyaz kare olarak çizilir.
- `googleServicesFile` ayarı prebuild'in google-services gradle plugin'ini uygulamasını
  sağlıyor — gradle dosyalarına dokunulmuyor.

**`google-services.json` repo KÖKÜNDE** durmalı (`.gitignore`'daki `/android` onu
`android/app/` altında yutar) ve **commit edilmeli** — client config'tir, APK'nın içinde
zaten dağıtılır; asıl gizli olan service-account JSON'u EAS credentials'ta durur, bu repoya
hiç girmez. Commit edilirse **CI'da hiçbir değişiklik gerekmez**.

## 3.3 Token yaşam döngüsü

Yeni: `src/lib/push/registration.ts` + `src/hooks/usePushNotifications.ts` +
`src/components/PushBridge.tsx`.

`PushBridge` **her zaman** mount edilir (sadece giriş yapılmış dalda değil) — soğuk açılışta
kullanıcı çıkışken bildirime dokunabilir, hedef düşürülmeyip saklanmalı.

**İzin ne zaman isteniyor:** cold start'ta değil, **ilk başarılı girişten sonra**.
`nottepe_push_permission_asked` bayrağıyla bir kez. `denied` ise **asla tekrar sorulmuyor** —
Android 13 ikinci reddetmeden sonra dialogu hiç göstermiyor; kurtarma yolu tercih
sayfasındaki "Ayarları aç" satırı (`Linking.openSettings()`).

```
Device.isDevice değilse → kısa devre   (emülatörde getExpoPushTokenAsync fırlatır → kırmızı ekran)
projectId yoksa → kısa devre + açık log (hata mesajı jenerik, tanınmaz)
token === saklanan && owner === userId → POST atma (her açılışta gereksiz kayıt olmasın,
                                          ayrıca ortak cihazda hesap değişimini yakalar)
addPushTokenListener → rotasyonda yeniden kaydet
AppState 'active' → registerToken tekrar (kendini eleyor, bedava)
```

**Çıkışta:** `AuthContext.logout` içinde, `authAPI.logout()`'tan **önce** `unregisterToken()`
— POST'un canlı Bearer'a ihtiyacı var, `clearSession` SecureStore'u siliyor.
**`clearSession`'a koymayın**: orası aynı zamanda `onSessionExpired` yolu, token'lar zaten
ölü, POST 401 alıp refresh interceptor'ında döner. O yol için tek temizlik backend'in
receipt taraması.

## 3.4 Backend sözleşmesi

Hepsi mevcut `/user-notifications` öneki altında, mevcut Bearer + `X-Client-Type: mobile`
başlıklarıyla, mevcut 401→refresh retry'ına otomatik dahil.

```jsonc
// Cihaz kaydı — token üzerinde IDEMPOTENT UPSERT
POST /user-notifications/devices
{ "token": "ExponentPushToken[...]", "provider": "expo", "platform": "android",
  "app_version": "1.0.0", "os_version": "14", "device_name": "SM-A536B", "locale": "tr-TR" }
→ 200 { "success": true, "device": { "id": 12, ... } }

// Kayıt silme — DELETE-with-body DEĞİL: bazı proxy'ler gövdeyi sessizce düşürüyor
POST /user-notifications/devices/unregister   { "token": "..." }   → 204
```

> ⚠️ Token zaten başka bir `user_id`'ye bağlıysa **yeniden ata**. Aksi hâlde ortak cihazda
> önceki sahip yeni sahibin bildirimlerini almaya devam eder — bu bir gizlilik hatası.

> ⚠️ **Receipt taraması opsiyonel değil.** Her gönderim sonrası
> `POST exp.host/--/api/v2/push/getReceipts`; `details.error === "DeviceNotRegistered"` olan
> token'lar silinmeli. Oturum-süresi-dolması ve uygulama-kaldırma vakalarında istemci
> unregister çağıramaz; tek temizlik yolu budur.

```jsonc
GET /user-notifications/preferences → 200
{
  "push_enabled": true,
  "types": { "comment_on_post": true, "dept_new_post": false, "announcement": true },
  "available_types": [
    { "key": "comment_on_post", "label": "Gönderime yorum geldiğinde",
      "description": "Paylaştığın nota biri yorum yazarsa bildirim al.",
      "group": "activity", "default": true }
  ]
}

PATCH /user-notifications/preferences  { "types": { "dept_new_post": false } }
→ 200 { ...GET ile aynı tam gövde }   // istemci cache'i refetch'siz ezebilsin
```

`types` **shallow-merge** edilir, gönderilmeyen anahtarlar korunur. `push_enabled: false`
tüm tipleri ezen ana kapatma anahtarıdır.

**`available_types` bu tasarımın mihenk taşı:** yeni bir cron tipi eklemek = **bir backend
satırı, sıfır uygulama sürümü**. Zaten yayınlanmış APK'larda anında görünür.

### Push payload

```jsonc
{
  "to": "ExponentPushToken[...]",
  "title": "Yeni yorum",
  "body": "ryder \"Analiz I vize notları\" gönderine yorum yaptı.",
  "sound": "default", "priority": "high", "channelId": "default", "badge": 3,
  "data": {
    "v": 1,
    "type": "comment_on_post",
    "notification_id": 8123,
    "unread_count": 3,
    "target": { "screen": "PostDetail", "params": { "postId": 456 } }
  }
}
```

İki taşıyıcı alan:
- **`data.target`** — `{screen, params}` `RootStackParamList`'i birebir yansıtıyor. Hedefi
  sunucu belirlediği için **yeni bildirim tipi istemci değişikliği gerektirmiyor**.
  ⚠️ İstemci `screen`'i bir **beyaz listeye** karşı doğrulamalı; doğrulanmamış sunucu
  kaynaklı route adını `navigate()`'e vermek en iyi ihtimalle çökme vektörü.
- **`data.unread_count`** — gönderim sonrası kesin rozet değeri. 60 sn'lik poll'u güvenle
  düşürmeyi mümkün kılan şey bu.

Duyurular: `channelId: "announcements"`,
`target: { screen: "Notifications", params: { initialTab: "duyurular" } }`.

## 3.5 Ön plan / arka plan / soğuk açılış

**`src/lib/push/handler.ts`** (yan etkili modül, `index.ts`'ten bir kez import edilir):
```ts
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true, shouldShowList: true,
    shouldPlaySound: true, shouldSetBadge: true,
  }),
});
```
> ⚠️ `expo-notifications` 0.29+'ta eski `shouldShowAlert` **sessizce yok sayılıyor**. Sadece
> onu döndürmek ön plan banner'ını hiç göstermez, hata da vermez. "Push bozuk" gibi görünen
> 1 numaralı sebep.

**`src/lib/push/channels.ts`** — `default` (importance MAX) ve `announcements`
(importance DEFAULT) kanalları, ilk token'dan ve ilk bildirimden **önce** oluşturulmalı.
> ⚠️ Kanal özellikleri oluşturulduktan sonra **değiştirilemez**. Importance'ı sonradan
> değiştirmek yeni bir kanal id'si (`default_v2`) ve göç demek. Şimdi doğru seç.

**`src/navigation/navigationRef.ts`** — `createNavigationContainerRef` + bekleyen hedef
kuyruğu. İç içe `MainTabs` sorunu zaten çözülmüş durumda: `src/navigation/navigateApp.ts`
içindeki `navigateApp(navigation, name, params)` `AnyNavigation = { navigate }` alıyor ve
`navigationRef` bunu yapısal olarak karşılıyor → sekme mantığı **tekrarlanmıyor**.

`App.tsx`: `<NavigationContainer ref={navigationRef} onReady={drainPendingTarget}>` +
`<PushBridge />` kardeş olarak.

Akışlar:
1. **Soğuk açılış** — `getLastNotificationResponseAsync()`, `useRef` bayrağıyla bir kez,
   `request.identifier` üzerinden tekrar-eleme. (`useLastNotificationResponse` hook'u her
   remount'ta aynı yanıtı yeniden tetikler ve kullanıcıyı oturum ortasında zıplatır.)
2. **Arka plan/kapalı dokunma** — `addNotificationResponseReceivedListener`
3. **Çıkışken dokunma** — hedefi `nottepe_pending_push_target`'a yaz, `isAuthenticated`
   true'ya dönünce boşalt (route `AuthNavigator`'da yok, `navigate` fırlatır)
4. **Ön planda gelme** — `data.unread_count` varsa
   `queryClient.setQueryData(UNREAD_NOTIFICATIONS_KEY, n)`, yoksa +1;
   `setBadgeCountAsync`. Tek `setQueryData` hem üst bar hem menü zilini günceller.
5. ⚠️ **Rozet çift sayımı:** Bildirimler ekranı Aktivite sekmesine girince hepsini okundu
   yapıyor. O ekran odaktayken push gelirse rozeti artırmak yanlış — kullanıcı zaten ona
   bakıyor. Ekran `useFocusEffect` ile bir modül bayrağı set etsin, bayrak açıkken artırma
   yapılmasın, sadece liste invalidate edilsin.
6. **Ön plana dönüş** — `AppState 'active'` → unread invalidate + `registerToken` (self-dedupe)

**Poll'u düşürme:** `useUnreadNotifications`'ta sabit `refetchInterval: 60_000` yerine
`pushActive ? 300_000 : 60_000`. `pushActive`, izin `granted` **ve** token başarıyla
kaydedilmişse true (`src/lib/push/pushState.ts`, `useSyncExternalStore`). Tamamen kapatmak
yerine 5 dk taban bırakılıyor — sessiz düşme vakalarını (pil optimizasyonu FCM'i öldürdü,
`unread_count` bayatladı) iyileştiriyor, maliyeti yok.

## 3.6 Tercih arayüzü

**`src/lib/push/catalog.ts`** — istemci kataloğu yalnızca **cila** sağlar:
```ts
export const PUSH_TYPE_CATALOG: { key; label; description; icon: LucideIcon; group }[] = [...]
```
Birleştirme kuralı:
- Sunucunun `available_types`'ı **hangi tiplerin var olduğu**, sırası, grubu ve varsayılanı
  için tek yetkili kaynak
- İstemci kataloğu Türkçe metin + lucide ikon sağlar, `key` ile eşleşir
- **Bilinmeyen key** (sunucu yeni cron tipi ekledi) → sunucunun `label`/`description`'ı ve
  jenerik `Bell` ikonuyla **anında çalışır**, yayınlanmış APK'larda bile
- Daha güzel ikon/metin istendiğinde katalog'a bir obje eklenip sürüm çıkılır — opsiyonel

**`src/components/notifications/NotificationSettingsSheet.tsx`** — kabuk
`src/components/layout/OptionSheet.tsx`'ten **kopyalanır, yeniden kullanılmaz**: OptionSheet
tek-seçimli ve seçince kapanıyor, çok-anahtarlı panel için yapısal olarak yanlış.

Gövde:
1. İzin bandı (`granted` değilse) → "Bildirim izni kapalı" + `Linking.openSettings()`.
   Bu olmadan bir kez reddeden kullanıcının **kurtarma yolu yok**.
2. Ana anahtar `push_enabled` — `ProfileEditModal.tsx:252` ile aynı
   `<Switch trackColor={{ true: '#2F5755' }} />`
3. `group`'a göre tip satırları, `ProfileEditModal.tsx:261-273` kutu stiliyle.
   `push_enabled` kapalıyken grup `opacity: 0.4`

**Kaydetme — `ProfileEditModal`'dan bilinçli sapma:** o modal kimlik alanlarını düzenlediği
için diff biriktirip submit'te kaydediyor. Tercih paneli **anahtar başına** kaydetmeli:
iyimser cache yazımı + 400 ms debounce + tek anahtar taşıyan PATCH. "Kaydet" butonu yok,
hata olursa anahtar geri dönüyor. *Ev kuralından sapma olduğu için onay alınmalı.*

**`NotificationsScreen` düzenlemesi:** sekme satırına (`flex-row gap-2 p-3 pb-1`)
`<View className="flex-1" />` + dişli `Pressable` (lucide `Settings`, 20,
`colors.muted`). Üst bar `AppHeader` her rotada ortak ve başlığı mutlak konumlu ortalanmış
(`px-20` payı) — dördüncü bir kontrol uzun Türkçe başlıklarla çakışırdı.

## 3.7 Manuel bildirimler (admin duyuruları)

`notificationAPI.create(formData)` zaten admin duyurusu oluşturuyor. Backend bunu kategoriye
göre push olarak da göndermeli; kategoriyi kapatmış kullanıcılar alınmaz. İstemci tarafında
ek iş yok — `announcements` kanalı ve `target` deep-link'i 3.5'te kapsanıyor.

## 3.8 Cron listesi geldiğinde tip başına gereken

| Nerede | Ne | Zorunlu mu |
|---|---|---|
| Backend | tip enum + cron job + `available_types` satırı | ✅ |
| Push payload | `type` + `target` | ✅ |
| `src/lib/push/catalog.ts` | ikon + cilalı Türkçe metin | ❌ opsiyonel |
| `NotificationsScreen` `ACTIVITY_TYPE_META` | uygulama-içi liste metni | ❌ opsiyonel |

**Yeni tip için uygulama sürümü çıkmak gerekmiyor.**

## 3.9 Dosya listesi

**Yeni:** `src/navigation/navigationRef.ts` · `src/lib/push/{handler,channels,registration,targets,catalog,pushState}.ts` ·
`src/hooks/{usePushNotifications,usePushPreferences}.ts` · `src/components/PushBridge.tsx` ·
`src/components/notifications/NotificationSettingsSheet.tsx` · `assets/notification-icon.png` ·
`google-services.json` (kök)

**Değişen:** `app.json` · `package.json` · `eas.json` · `index.ts` (handler import) ·
`App.tsx` (nav ref + PushBridge) · `src/lib/api.ts` (4 metot) ·
`src/context/AuthContext.tsx` (logout'ta unregister) ·
`src/hooks/useUnreadNotifications.ts` (koşullu interval) · `src/screens/main/NotificationsScreen.tsx`

**Commit sırası:** (1) paket adı tek başına → (2) bağımlılıklar + app.json +
google-services.json + token üreten bir dev build → (3) nav ref + handler + kanallar +
PushBridge → (4) kayıt + logout kancası → (5) deep-link + rozet → (6) tercih API + UI →
(7) poll düşürme

## 3.10 Riskler

- **JDK 17 yok** → dev build alınamaz, ilk iş bu
- **Paket adı değişimi kullanıcıları çıkış yaptırır** — SecureStore/AsyncStorage paket
  kapsamlı; `nottepe_access_token`, `nottepe_auth_user`, `nottepe_notif_hidden` hepsi sıfırlanır.
  Sideload edilmiş APK'lar **yerinde güncellenmez**, test edenler önce kaldırmalı.
  Play'de yayın varsa bu yeni bir liste demektir — **önce doğrula**
- **`AGENTS.md` v57 dokümanına yönlendiriyor, kurulu expo 54.0.37.** `setNotificationHandler`
  sözleşmesi ve `getExpoPushTokenAsync`'in projectId zorunluluğu bu aralıkta değişti.
  SDK 54 dokümanı + `npx expo install` esas alınmalı
- Emülatörde push test edilemez, gerçek cihaz gerekir
- iOS projesi hiç yok — push iOS'ta ayrı bir iş kalemi (APNs + Apple Developer hesabı)
- Expo Go artık kullanılamaz → günlük geliştirme akışı tamamen değişir

---

# Uygulama sırası

1. **Bölüm 1** (1.1 → 1.6) — bağımsız, hemen yapılabilir
2. **Bölüm 2** istemci tarafı (2.2, 2.3, 2.6) — backend'siz yapılabilir
3. **Bölüm 2** backend bağımlıları (2.1, 2.4, 2.5)
4. **Bölüm 3.0** ön koşullar (JDK, paket adı, `eas init`, FCM projesi, EAS credentials)
5. **Bölüm 3.2-3.6** — cron tip listesi gelince 3.8'e göre doldurulur

---

# Doğrulama

1. `npx tsc --noEmit` → **sıfır** hata (1.6 ile birlikte)
2. `npx expo export --platform android` → bundle başarılı
3. Emülatör (`nottepe_test` AVD): giriş ekranını **hem açık hem koyu** temada aç → 1.1
4. Açılışta atılan istek sayısını yerel sahte API log'uyla say → 2.2 + 2.3 sonrası belirgin düşüş
5. 9 ekranda üst bar başlığı ile ekran içeriği çakışmıyor → 1.2
6. Bildirimler: 30+ kayıtla sonsuz kaydırma, kaydır-sil-geri al, Duyurular'da "Okunmadı"
   rozetinin değişmesi
7. Push, **gerçek cihazda dev build ile**: izin akışı → token kaydı → uygulama kapalıyken
   bildirim düşmesi → dokununca doğru ekran → çıkışta token silinmesi →
   ön planda rozetin artması → Bildirimler ekranı odaktayken **artmaması**
