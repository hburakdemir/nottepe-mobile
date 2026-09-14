# Nottepe Mobil — Performans Teşhisi ve Çözüm Planı

Tarih: 2026-09-13 · Durum: **Faz 1-3 ✅ · R1-R4 ✅** — 1.0.1 testçilerde, iki yeni bulgu geldi ve düzeltildi (aşağıda: madde 2 üçüncü tur, madde 3 ikinci tur). Kalan: madde 9 ölçümü, madde 10 katman 2. **2026-09-14: madde 11 eklendi — iOS'un temiz olduğu öğrenildi ve teşhis ekseni değişti; bu belgenin en önemli maddesi artık o.**
Doğrulama: Expo SDK 54 (kurulu sürüm) dokümanları + React Navigation 7 / react-native-screens issue takibi

---

## Özet

| # | Belirti | Kök sebep | Teşhis kesinliği | Çözüm oranı | Efor |
|---|---------|-----------|------------------|-------------|------|
| 1 ✅ | Menü 3 aşamada açılıyor | Açılışta ağ isteği + panel içinde 2 ayrı setState | Yüksek | %85 | 2s |
| 2 ✅ | Sekme geçişi 2 kere oynuyor | `setActiveTab` animasyon ortasında ağacı yeniden çiziyor | Yüksek | %75 | 3s |
| 3 ✅ | Arka plandan dönünce alt bar donuyor | Sekmelerde `enableFreeze` (screens#1478/#2384/#2150) + bar `KeyboardAvoider`'ın içindeydi | Yüksek | %80 | 3s |
| 4 ✅ | 130 sekmelerinde donma | **Yapay 450 ms iskelet** + 95 kutucuk tek karede | Kesin | %95 | 2s |
| 5 ✅ | Yemekhane spinner | Ham `useEffect`, cache yok | Kesin | %95 | 2s |
| 6 ✅ | Klavye inputu kapatıyor | `KeyboardAvoidingView` sadece padding veriyor, kaydırmıyor | Kesin | %90 | 4s |
| 7 ✅ | Profil çok yavaş | 7 paralel istek tek `loading` bayrağına bağlı | Kesin | %90 | 4s |
| 8 ✅ | Avatar "Kapat" butonu | Tasarım eksiği | Kesin | %100 | 30dk |
| 9 | Her geçişte yavaşlık | 14 ekran cache'siz (react-query'siz) | Yüksek | %70 | birleşik |
| 9b ✅ | **Fakülteler / Profil daha çok** | Profil: 7 sayfa + 8 scroll worklet · Fakülteler: debounce yok | Yüksek | %85 | 1g |
| 10 ✅ | Sürekli yükleme animasyonu | react-query yalnızca 5 dosyada; 11 ekran elle fetch ediyordu | Kesin | %95 | birleşik |

**Önce şu üçü:** 4 → 7 → 6. En yüksek etki/efor oranı bunlarda ve üçü de kesin teşhis.

---

## Önce bir yanlışı düzeltelim

Play Console'un önerdiği **R8 bu listedeki hiçbir maddeyi çözmez.** R8 kullanılmayan Java/Kotlin sınıflarını atar: APK küçülür, açılışta yüklenen sınıf sayısı azalır. Kasmanın tamamı JS tarafında. Ayrıca uygulama boyutu için 120-130 MB'a kadar alanımız olduğu söylendi — yani R8'in asıl faydası (boyut) bizim için zaten kıymetli değil. R8 açık kalsın, ama performans beklentisi bağlamayalım.

**BlurView de suçlu değil.** İlk şüphem tab bar'daki `BlurView`'du ama SDK 54 dokümanı net: Android'de `experimentalBlurMethod` varsayılanı `'none'` ve [WaveTabBar.tsx](../../src/components/layout/WaveTabBar.tsx) bu prop'u hiç vermiyor. Yani Android'de gerçek bir bulanıklık hesaplanmıyor, bar düz yarı saydam bir View. Android'de bu maddeyi kovalamayın. (iOS'ta gerçek blur var ama orada ucuz.)

---

## 1 — Menü 3 aşamada açılıyor

**Kök sebep — üç ayrı iş çekmece animasyonunun ortasına düşüyor:**

1. [MenuDrawerContent.tsx:110-123](../../src/components/layout/MenuDrawerContent.tsx#L110-L123) — menü her açıldığında `departmentFollowAPI.getMine()` isteği atılıyor. `follows === null` iken bölüm `null` dönüyor ([satır 133](../../src/components/layout/MenuDrawerContent.tsx#L133)), istek dönünce panelin ortasına bir blok **ekleniyor** → gözle görülür sıçrama.
2. [PushableStack.tsx:32-37](../../src/components/layout/PushableStack.tsx#L32-L37) — `useAnimatedReaction` + `runOnJS(setOverlayActive)`: çekmece kıpırdadığı anda bir JS setState. Bu `overflow: 'hidden'`'ı açıyor (yeni composite katman) ve [satır 134](../../src/components/layout/PushableStack.tsx#L134)'te tam ekran yükseklikte bir **SVG mount ediliyor** — animasyon sürerken.
3. Zil/megafon rozetleri `refetchOnWindowFocus: true` ile ayrı zamanlarda geliyor.

**Çözüm:**
- Takip edilen bölümleri react-query'ye taşı (`staleTime: 5dk`), menü açılışında istek atma; veri yoksa **sabit yükseklikte iskelet** göster ki panel zıplamasın.
- `setOverlayActive`'i kaldır: `overflow` sabit `'hidden'`, SVG kenar çizgisi sürekli mount'lu kalsın, görünürlüğü sadece `stroke` opaklığıyla (zaten Reanimated'de) değişsin. Böylece açılış anında hiç JS re-render'ı olmaz.

**✅ Yapıldı — ama yalnızca birinci madde.** Takip edilen bölümler react-query'ye taşındı (`FOLLOWED_DEPARTMENTS_KEY`, `staleTime: 5dk`): menü artık her açılışta istek atmıyor, ilk açılıştan sonra veri hazır geliyor. `return null` yerine başlık satırıyla aynı yükseklikte yer tutucu kondu, böylece ilk açılışta da panel kıpırdamıyor. Takip/takipten çıkma yapılan üç yerde (DepartmentDetail, Profil, KVKK kapısı) anahtar geçersiz kılınıyor — cache bayat kalmasın.

**`PushableStack`'teki `setOverlayActive` BİLEREK DOKUNULMADAN BIRAKILDI.** Plan "kaldır, `overflow` sabit `hidden` kalsın" diyordu; kodu açınca görüldü ki o koşul bilinçli konmuş: sürekli `hidden` tutmak her ekran için kalıcı bir offscreen/composite katmanı zorluyor ve özellikle tablette ısınmaya katkı sağlıyordu (dosyadaki nota bakın). Ayrıca kapatma katmanı (`Pressable`) gerçekten koşullu olmak zorunda — sürekli mount'lu kalırsa ekrandaki HER dokunuşu yutar. Yani bu ikisi kaldırılamaz; kaldırsaydım kapatılmış iki sorunu birden geri açardım.

**Oran: %85 → gözlemle doğrulanacak.** Ağ isteği kaynaklı sıçrama gitti; kalan pay çekmece animasyonunun kendisinde.
**Plan B:** Menü içeriğini `InteractionManager.runAfterInteractions` ile animasyon bitince doldur — sıçrama kalır ama animasyon pürüzsüz olur.

---

## 2 — Sekme geçişi iki kere oynuyor

Testçilerin "2 kere kayıyor" dediği şey bu ve **iki ayrı sebebi var:**

**a) Animasyon ortasında tüm sekme ağacı yeniden çiziliyor.** [MainTabsScreen.tsx:64-70](../../src/navigation/MainTabsScreen.tsx#L64-L70): `screenListeners.state` → `setActiveTab`. Bu state sadece üst bardaki başlık için tutuluyor ama `MainTabsScreen`'i yeniden render ediyor; `<Tab.Navigator>` JSX'i satır içinde durduğu için `screenOptions`, `screenListeners` ve `tabBar` prop'ları **her render'da yeni nesne**. Geçiş animasyonu sürerken navigator'a yeni prop seti gitmesi, `'shift'` animasyonunun baştan başlamasına yol açıyor.

**b) ~~`enableFreeze` sekmelerde çalışmıyor.~~ — BU İDDİA YANLIŞTI, bkz. aşağıdaki düzeltme.**

**Çözüm:**
- `<Tab.Navigator>` bloğunu `useMemo` ile sabitle; `screenOptions`/`screenListeners`/`tabBar` referanslarını modül seviyesine ya da `useCallback`'e çıkar.
- Başlığı `setActiveTab` ile değil, `AppHeader` içinden `useNavigationState` ile oku — böylece state değişimi navigator'ı değil sadece başlığı re-render eder.
- ~~`animation: 'shift'`'i kaldırmayı ölç.~~ — böyle bir takas yokmuş, bkz. düzeltme.

**✅ (a) yapıldı.** `<Tab.Navigator>` ayrı bir `React.memo`'lu bileşene (`MainTabs`) çıkarıldı; `screenOptions` ve `tabBar` modül seviyesinde sabit, `screenListeners` tek bağımlılıklı `useMemo`. Başlık state'i (`activeTab`) artık yalnızca üst barı çiziyor, navigator'a hiç ulaşmıyor — `onTabChange` bağımlılıksız `useCallback`, memo'nun ön şartı.

**(b) DÜZELTME — sunduğum takas diye bir şey yokmuş.** Kullanıcıya "kayma animasyonu mu, ekran dondurma mı, birini seç" diye sordum; **soru baştan yanlıştı.** [#12621](https://github.com/react-navigation/react-navigation/issues/12621) kurulu sürümde çoktan düzeltilmiş. Kurulu `@react-navigation/bottom-tabs` 7.18.18'in kaynağı (`src/views/BottomTabView.tsx:337-347`):

```js
const activityState = isFocused ? STATE_ON_TOP
  : animationEnabled && isAnimatingRoute ? STATE_TRANSITIONING_OR_BELOW_TOP
  : STATE_INACTIVE;
shouldFreeze={activityState === STATE_INACTIVE && !isPreloaded}
```

`isAnimatingRoute` yalnızca `lastUpdate.animating` iken — yani animasyon SÜRERKEN — true. Animasyon bitince odakta olmayan sekme `STATE_INACTIVE` alıyor ve donduruluyor. Yani `animation: 'shift'` dondurmayı kalıcı olarak kapatmıyor, sadece animasyon boyunca askıya alıyor. **Kayma ve dondurma bir arada çalışıyor.**

Kullanıcı zaten "kayma animasyonu kalmalı" dedi; `shift` kalıyor ve hiçbir bedeli yok.

Bunun ters yönde bir sonucu da var ve madde 3'ü çözen ipucu o oldu: sekmeler GERÇEKTEN donduruluyorsa, `enableFreeze`'in Android'de arka plandan dönüşte yaptığı bilinen hasar bu uygulamayı da vuruyor demektir. Bkz. madde 3.

**Oran: %75.**

**2026-09-13, ÜÇÜNCÜ tur — `shift` tamamen kaldırıldı, `animation: 'none'`.** 1.0.1 testçilerde: "geçişlerde bir an başka sayfa görünüyor, iğrenç". Bu, yukarıdaki analizin öngörmediği AYRI bir upstream hatasıymış:

- [react-navigation#12862](https://github.com/react-navigation/react-navigation/issues/12862) — Android'e özgü, `shift` animasyonunda önceki ekranın tek karelik yanıp sönmesi. Bildiren kişi `shift`→`none` ile sorunun tamamen kaybolduğunu doğrulamış.
- [react-navigation#12928](https://github.com/react-navigation/react-navigation/issues/12928) — reanimated'li bir sekmeye (bizde: Profil) girildikten sonra diğer sekmelerde de titreme; ortamı reanimated 4.1.1 — bizim kurulu sürümümüzle birebir aynı.
- [react-navigation#12377](https://github.com/react-navigation/react-navigation/issues/12377) — Android + Yeni Mimari kombinasyonuna özel.

Üçü de açık, düzeltilmemiş. **Kullanıcı kararı: kayma efekti kalksın, geçiş anında olsun.** Bu aynı zamanda en hızlı seçenek — `transitionSpec` süresi 0ms.

**Oran (güncel): %95.**
**Plan B:** `animation`'ı koruyup her sekme ekranını kendi içinde `React.memo` + ağır bölümleri `useFocusEffect` ile odakta değilken durdur.

---

## 3 — Arka plandan dönünce ALT BAR donuyor ✅ (düzeltildi, cihaz testi bekliyor)

**2026-09-13, ikinci düzeltme. Önceki teşhisim de yanlıştı.** Testçi cevabı geldi: donma anında **bar EKRANDA DURUYOR**, kaybolmuyor; sadece tepki vermiyor. Bu tek cümle Aday 1'i eler — `keyboardOpen` takılı kalsaydı `return null` çalışır ve bar **tamamen yok olurdu**. Aday 1 kapandı.

### Elenenler

| Aday | Neden elendi |
|---|---|
| `keyboardOpen` bayrağı takılı | Bar yok olurdu; testçi "duruyor" diyor |
| reanimated#9574 (dönüşte bayat animasyon prop'u) | `FORCE_REACT_RENDER_FOR_SETTLED_ANIMATIONS` kurulu 4.1.7'de **yok**, 4.4'te geldi |
| `MainActivity` state geri yükleme çökmesi | `super.onCreate(null)` zaten yerinde ([MainActivity.kt:19](../../android/app/src/main/java/com/nottepe/app/MainActivity.kt#L19)) |
| PushableStack overlay'i | O durumda her yer donardı, yalnızca bar değil |

### Kanıtlanan sebep — sekmelerde `enableFreeze`

[App.tsx](../../App.tsx)'teki `enableFreeze(true)` yalnız stack'i değil **sekmeleri de** kapsıyordu. Zinciri kodda takip ettim:

`react-native-screens/src/components/Screen.tsx:77` → `freezeOnBlur = freezeEnabled()` — yani `enableFreeze(true)`, `freezeOnBlur` belirtilmemiş HER Screen'in varsayılanını true yapıyor.
`@react-navigation/bottom-tabs/src/views/BottomTabView.tsx:347` → odakta olmayan sekmeye `shouldFreeze` geçiyor.

Belgelenmiş üç hata, üçü de bizim tablomuz:

- [react-native-screens#1478](https://github.com/software-mansion/react-native-screens/issues/1478) — tekrar adımları testçilerin tarifiyle **birebir aynı**: `enableFreeze(true)` → ekranı kilitle → aç → takılıyor.
- [react-native-screens#2384](https://github.com/software-mansion/react-native-screens/issues/2384) — başlığı "enableFreeze cause to bottom tab navigator unresponsive": **bar görünür kalıyor**, dokunuşlar sekmeyi değiştirmiyor.
- [react-native-screens#2150](https://github.com/software-mansion/react-native-screens/issues/2150) — Fabric + bottom-tabs: *"dokunulabilirlerin hepsi donuyor, animasyonlar çalışmaya devam ediyor."* "Duruyor ama tepki vermiyor"un tarifi.

**Neden yalnızca bar?** Bar, ekranda başka bir view ile ÜST ÜSTE BİNEN tek şey: sahne `StyleSheet.absoluteFill`, bar da onun üstünde mutlak konumlu. Android'de dokunuş, çizim sırasına değil view hiyerarşisi sırasına gider. Dönüşte sahne fragment'i bar'dan SONRA yeniden bağlanırsa bar `elevation: 12` sayesinde üstte ÇİZİLMEYE devam eder ama dokunuşu alttaki sahne yutar. Ekrandaki diğer her şey sahnenin kendisi olduğu için çalışmaya devam eder — testçilerin "komple değil, sadece alt menü" demesinin sebebi bu.

**✅ Yapıldı:** sekmelerde `freezeOnBlur: false` ([MainTabsScreen.tsx](../../src/navigation/MainTabsScreen.tsx)). `enableFreeze(true)` genel olarak AÇIK kaldı — push edilen stack ekranlarında kazancı gerçek ve orada bu hata bildirilmemiş. Sekmeler `detachInactiveScreens` varsayılanıyla native tarafta zaten ayrılıyor, dolayısıyla kaybedilen tek şey JS re-render'ı.

### İkinci sebep — bar `KeyboardAvoider`'ın içindeydi (bunu Faz 1'de BEN açtım)

[MainTabsScreen.tsx](../../src/navigation/MainTabsScreen.tsx)'teki yorum "tab bar kendi `tabBar` yuvasında olduğu için klavye itmesinden etkilenmiyor" diyordu. **Yanlıştı:** `tabBar` yuvası Tab.Navigator'ın içi, Tab.Navigator da `KeyboardAvoider`'ın içindeydi.

Faz 1'den önce zararsızdı, çünkü orada RN'in kendi `KeyboardAvoidingView`'ı vardı ve Android'de hiçbir şey yapmıyordu. Faz 1'de onu keyboard-controller ile değiştirdim: artık yerleşimi Reanimated ile UI thread'inde sürüyor. Dönüşte o animasyon bayat bir değerde takılırsa **bar eski yerinde çizilir, dokunma alanı başka yerde kalır** — aynı belirti. Yani Faz 1, madde 3'ü kapatmaya çalışırken ona ikinci bir kapı açmış olabilirdi.

**✅ Yapıldı:** bar `KeyboardAvoider`'ın da Tab.Navigator'ın da dışına, navigator'ın kardeşi olarak çıkarıldı (`tabBar` yuvası boş bırakıldı). AppShell zaten baştan böyle çiziyordu; iki montaj yeri artık yapı olarak birebir aynı. Bar aktif sekmeyi artık kendisi türetemediği için (o konumdan kök stack'i görür, hep "MainTabs" derdi) `activeRouteName` prop'uyla veriliyor — MainTabsScreen o state'i zaten üst bar başlığı için tutuyordu.

**Oran: %80.** İki ayrı sebep birden kapatıldı ama ikisi de aynı belirtiyi verdiği için hangisinin asıl suçlu olduğunu ancak cihaz söyler. Düzelmezse sıradaki tek satır: `enableFreeze(false)`.

---

**2026-09-13, İKİNCİ tur — teşhis EKSİKMİŞ, kapsam çok dardı.** 1.0.1 testçilerde: *"en büyük sorun, arka plandan dönünce ya da kilit açılınca 2-3 saniye TÜM UYGULAMA donuyor."* Bu, "sadece alt bar" tarifinden daha ağır bir belirti.

Sebep: bir önceki turda `freezeOnBlur: false`'u YALNIZCA sekmelere ([MainTabsScreen.tsx](../../src/navigation/MainTabsScreen.tsx)) uygulamıştım, "push edilen stack ekranlarında kazancı gerçek ve orada bu hata bildirilmemiş" varsayımıyla. **Yanlıştı.** [RootNavigator.tsx](../../src/navigation/RootNavigator.tsx)'daki `Stack.Navigator`ın `screenOptions`'ında `freezeOnBlur` için hiçbir override yok — yani hâlâ varsayılan `true`. Uygulama zamanının büyük kısmı push edilen ekranlarda geçiyor (detaylar, listeler, formlar); testçinin tarif ettiği "tüm uygulama donuyor" tam olarak bu — sekmede değil, push edilen herhangi bir ekrandayken aynı Android hata ailesine (#1478/#2384/#2150) giriliyor.

**✅ Yapıldı: kaynak kapatıldı.** [App.tsx](../../App.tsx): `enableFreeze(false)`. İki navigator'a ayrı ayrı `freezeOnBlur: false` eklemek yerine (üçüncü bir yeri unutma riski var) kaynağı kapatmak seçildi — nerede olursa olsun artık dondurma yok. Kaybedilen: odakta olmayan ekranların JS re-render'dan muaf tutulması (bellek/CPU tasarrufu); karşılığı artık ölçülmüş — iki ayrı testçi raporu aynı bayrağa çıktı.

`registerToken` (her ön plana dönüşte çalışıyor) ayrıca kontrol edildi: tamamen async I/O, JS thread'i bloklayan bir şey yok — bu değil.

**Oran (güncel): %90.**

---

## 4 — 130 ring sekmelerinde donma

**Sorunuzun cevabı: haklısınız, veri gömülü ve burada hiçbir ağ isteği yok.** Saatler [src/data/ego130Schedule.ts](../../src/data/ego130Schedule.ts) içinde.

**Gördüğünüz "yükleme" tamamen yapay.** [Ego130ScheduleScreen.tsx:130-134](../../src/screens/main/Ego130ScheduleScreen.tsx#L130-L134):

```ts
useEffect(() => {
  setLoading(true);
  const id = setTimeout(() => setLoading(false), 450);
  return () => clearTimeout(id);
}, [activeDay, origin]);
```

Her gün/kalkış değişiminde **450 ms zorunlu bekleme.** Koddaki yorum sebebini de yazmış: 95+ kutucuk tek karede çizilemediği için ekran takılıyordu, iskelet bunu "bilinçli bekleme"ye çevirmiş. Yani gerçek sorun (render maliyeti) çözülmemiş, üstü örtülmüş. Siz 450 ms beklemeyi donma olarak görüyorsunuz.

**Çözüm:** maliyeti gerçekten düşürüp gecikmeyi tamamen kaldır.
- Kutucuk bileşenini `React.memo`'ya al; şu an her kutucuk satır içi style nesnesiyle çiziliyor.
- `tileSurface` ve tüm sabit style'ları `StyleSheet.create` / `useMemo` ile bir kere hesapla — şu an her render'da yeniden kuruluyor ([satır 93-105](../../src/screens/main/Ego130ScheduleScreen.tsx#L93-L105)).
- 3 günün × 2 kalkışın kutucuk verisini modül seviyesinde **önceden hesapla** (`markersFor` her render'da string tarıyor).
- `setTimeout(450)`'yi sil.

**Oran: %95.** 95 statik kutucuk memoize edildikten sonra tek karede çizilir; bu ölçekte RN'in rahat kaldırdığı bir yük.
**Plan B:** Yine ağırsa ızgarayı `FlatList` + `initialNumToRender: 24` ile kademeli çiz — ama gerekeceğini sanmıyorum.

---

## 5 — Yemekhane menüsü iskelet ✅

[CafeteriaMenuScreen.tsx:143-167](../../src/screens/main/CafeteriaMenuScreen.tsx#L143-L167) ham `useState` + `useEffect` ile `menuAPI.getToday()` + `getWeek()` çekiyor, tam ekran `ActivityIndicator` gösteriyor ([satır 211](../../src/screens/main/CafeteriaMenuScreen.tsx#L211)). Cache yok — ekran her mount olduğunda sıfırdan yükleniyor.

**Çözüm:** react-query'ye taşı (`staleTime: 30dk` — menü gün içinde değişmiyor), spinner yerine gerçek kart düzenine benzeyen iskelet. `placeholderData: keepPreviousData` ile hafta/ay geçişinde ekran boşalmasın.

**Oran: %95.** İskelet zaten talep edilen çözüm; cache ikinci açılışı anlık yapar.

---

## 6 — Klavye inputu kapatıyor

**Kök sebep:** [KeyboardAvoider.tsx](../../src/components/layout/KeyboardAvoider.tsx) `KeyboardAvoidingView behavior="padding"` kullanıyor. Bu bileşen **konteynerin altına boşluk ekler — odaklanan inputu görünür alana kaydırmaz.** İkisi farklı iş. Input bir `ScrollView` içindeyse ve altta kalıyorsa padding onu yukarı taşımaz.

Ayrıca [app.json](../../app.json)'da `android.softwareKeyboardLayoutMode` hiç ayarlı değil.

**Araştırma:** [Expo'nun resmi klavye rehberi](https://docs.expo.dev/guides/keyboard-handling/) `KeyboardAvoidingView` için "prototip için mükemmel ama platforma özel ayar gerektiriyor ve pek esnek değil" diyor; önerdiği çözüm **`react-native-keyboard-controller`** ve özellikle **`KeyboardAwareScrollView`** — "odaklanan `TextInput`'a otomatik kaydırır ve native benzeri performans verir". Bottom tab navigator kullananlara ayrıca `softwareKeyboardLayoutMode: 'pan'` öneriyor ki tab bar klavyenin üstüne itilmesin.

**Çözüm:**
1. `npx expo install react-native-keyboard-controller`, kök sarmalayıcıyı `KeyboardProvider` ile ekle.
2. `KeyboardAvoider`'ın içini `KeyboardAwareScrollView`'a çevir — **tek dosya değişiyor, çağrı yerleri aynı kalıyor** (AppShell ve MainTabsScreen dokunulmadan düzeliyor, yani sizin tespit ettiğiniz 2 input değil tüm inputlar).
3. ~~`app.json`'a `softwareKeyboardLayoutMode: 'pan'`~~ — **YAPILMADI, bilerek.** Expo'nun rehberi bunu bottom-tab kullananlara öneriyor ama o öneri bu paketi KULLANMAYAN projeler için. `pan`, manifest'e `adjustPan` yazar; keyboard-controller ise klavye insets'ine göre çalışır, ikisi birbiriyle kavga eder. Tab bar'ın klavye açıkken gizlenmesi zaten WaveTabBar'ın kendi işi.

**Oran: %90.** Bu kütüphane bu iş için standart ve Expo'nun kendi önerisi.
**Not:** Expo Go'da çalışmaz, dev build gerekir. Boyuta etkisi ~1-2 MB, 120 MB bütçemizde sorun değil.

---

## 7 — Profil sayfası çok yavaş

**Kök sebep:** [ProfileScreen.tsx:287-295](../../src/screens/main/ProfileScreen.tsx#L287-L295) — açılışta `Promise.allSettled` ile **7 paralel istek**: gönderiler, kaydedilenler, rozetler, kontrol listeleri, AKTS, program, takipler. Hepsi tek bir `loading` bayrağına bağlı, yani ekran **en yavaş isteğin** bitmesini bekliyor. Ekran 1415 satır ve 12 `useEffect` içeriyor; react-query yalnızca 2 yerde kullanılıyor, geri kalan ham state → cache yok.

**İkinci kök sebep — yedi sayfa aynı anda ayakta.** Sekmeler bir `Tab.Navigator` değil, yatay bir `ScrollView` pager'ı ([satır 903](../../src/screens/main/ProfileScreen.tsx#L903)): Postlar, Kayıtlı, Checklistler, AKTS, Program, Takip, Forumlar — **yedisi de aynı anda mount'lu**, her biri `screenWidth` genişliğinde. İçerik `activeTab === ...` ile korunuyor ama kaplar duruyor ve her birinin **kendi Reanimated scroll worklet'i** var:

```
postsScrollHandler · savedScrollHandler · listsScrollHandler · aktsScrollHandler
scheduleScrollHandler · followsScrollHandler · forumsScrollHandler
```

Üstüne pager'ın kendi `handlePagerScroll`'u (`scrollEventThrottle: 32`) ve bunların hepsine göre interpolasyonla konumlanan yapışkan başlık katmanı. **Tek ekranda sekiz canlı scroll dinleyicisi.** Testçilerin "profilde daha çok donuyor" demesinin sebebi bu.

**Veri katmanı — üç adım:**
1. **Aşamalı gösterim:** profil başlığı (ad, avatar, rozet) ilk istekle gelir gelmez çizilsin; sekme içerikleri kendi başlarına yüklensin. Tek `loading` bayrağını böl.
2. **Sekme başına tembel yükleme:** "Kayıtlı", "Kontrol listeleri", "AKTS", "Program" verilerini o sekmeye basılana kadar hiç çekme. Açılışta 7 istek → 2 istek.
3. **react-query:** her biri ayrı anahtar, `staleTime: 60sn`. İkinci ziyaret anlık olur.
4. İskelet ekle (madde 5'le aynı bileşen).

**⚠️ UYGULAMADA PLANDAN SAPILDI — sebebi önemli.** Plandaki "sekme başına
tembel yükleme, 7 istek → 2 istek" adımı **YAPILMADI.** Kodu açınca görüldü ki
o tembel yükleme daha önce zaten vardı ve **bilerek kaldırılmış**: sekme
şeridindeki sayaçlar tıklamadan dolmuyordu ve kullanıcı bunu ayrıca bildirmişti
(bkz. ProfileScreen.tsx ~satır 271'deki not). Geri almak, kapatılmış bir
şikayeti yeniden açardı.

Asıl sorun zaten istek sayısı değildi: **yedisi tek bir `Promise.allSettled`'da
toplanıp `setLoading` hepsi bitince kapanıyordu**, yani ekran EN YAVAŞ isteğin
süresi kadar tam ekran bekletiyordu. Yapılan: yedi istek hâlâ mount'ta atılıyor
(sayaçlar korunuyor) ama hiçbiri ekranı bekletmiyor — ilk kareyi yalnızca kendi
gönderilerin belirliyor, kalan altısı geldiğinde kendi state'ini yazıyor.

**İskelet de eklenmedi:** ekranda zaten `LoadingDeer` var, markalı bir yükleme
durumu. Onu jenerik bir iskeletle değiştirmek istenmemiş bir tasarım kararı
olurdu; üstelik bekleme artık tek isteğe indiği için çok daha kısa.

**Pager katmanı:**
5. ✅ **Sayfa pencereleme yapıldı.** Yalnızca aktif sekme ve iki komşusu gerçek scroll view olarak mount'lu; geri kalanlar yerlerinde `screenWidth` genişliğinde boş View tutuyor (pager geometrisi bozulmasın diye). Bir kez mount olan mount'lu kalıyor — kaydırma konumu ve verisi korunsun diye. İlk açılışta **7 sayfa → 2 sayfa**.
6. ~~Yedi `useAnimatedScrollHandler` **bilerek dokunulmadan bırakıldı**: aynı anda yalnızca bir scroll view kaydığı için bunların maliyeti kare başına değil, kurulum anında. Pencereleme zaten mount edilen sayfa sayısını düşürdüğü için asıl kazanç orada.~~

   **⚠️ 2026-09-14'te ÇÜRÜDÜ — "kurulum anında" doğru değildi.** Reanimated bu hook'un bağımlılıklarını worklet'in closure'ından topluyor ve bağımlılık değişince worklet'i **UI thread'inde yeniden inşa ediyor**. İki gönderi sekmesinde şöyle bir zincir vardı:

   ```
   loadMoreMyPosts deps [myPosts, ...]
     -> handleScroll deps [..., loadMoreMyPosts]
       -> useAnimatedScrollHandler closure'ı değişiyor
         -> worklet yeniden inşa ediliyor
   ```

   Yani kurulum **bir kez** değil, her sayfalamada, her not silmede ve her odak tazelemesinde tekrarlanıyordu. Düzeltildi: hook'lar kendi sayfa bileşenlerine taşındı (`components/profile/PagerPage.tsx`, `PostsTab.tsx`) ve `loadMore`/`refresh`/`onDelete` ref üzerinden kalıcı olarak stabil kimlik aldı (`hooks/profile/usePostsPagination.ts`) — worklet artık gerçekten mount'ta bir kez kuruluyor.

7. **Profil ekranı parçalara ayrıldı (1632 → 496 satır).** Asıl mesele state sayısı değil, state'in **yayılma alanıydı**: 29 `useState` tek bir render fonksiyonundaydı, bir modal boolean'ı ya da bir sekmenin verisi değişince yedi pager sayfası + başlık kartı + sekme şeridi baştan çiziliyordu. Hepsi `React.memo`'lu bileşenlere çıktı (`src/components/profile/`), veri katmanı react-query'ye taşındı (`src/hooks/profile/`). Tek kısıt olan "sekme sayaçları tıklamadan dolmalı" kuralı korundu: şerit sayacı, sekme listeyi, **aynı anahtar**, tek istek.

   Postlar/Kayıtlı bilerek react-query'ye taşınmadı — o durum makinesinin her dalının arkasında belgelenmiş bir hata var, birebir taşındı.
7. Uzun vadede pager'ı `react-native-pager-view`'a taşımak hâlâ doğru adım — ama artık acil değil.

**Oran: %90.** Açılıştaki istek sayısı 7→2 düşüyor ve ekran ilk veriyle çiziliyor.

---

## 8 — Avatar düzenlemede buton düzeni

[AvatarBuilderScreen.tsx:305-307](../../src/screens/main/AvatarBuilderScreen.tsx#L305-L307) altta tek "Kapat" butonu var; "Kaydet" ise üstte, satır [147-154](../../src/screens/main/AvatarBuilderScreen.tsx#L147-L154).

**✅ Yapıldı.** Altta iki butonlu çubuk: solda **Vazgeç** (çerçeveli), sağda **Kaydet** (`Kaydediliyor…` / `Kaydedildi!` durumları korunarak). Üstteki Kaydet kaldırıldı; rastgele butonu yerinde kaldı ve artık etiketli ("Rastgele") — tek başına kalınca zar ikonu kendini anlatmıyordu.

**Oran: %100.** Saf UI işi.

---

## 9 — Her sayfa geçişinde yavaşlık

Bu maddenin tek bir sebebi yok; yukarıdakilerin toplamı. Ölçülebilir üç ana kalem:

1. **Donmuş ekran optimizasyonu çalışmıyor** (madde 2b) — 5 sekme sürekli render.
2. **Cache yok** — 23 ekranın 21'i ham `useEffect` + `useState`. Her giriş = yeni istek + spinner:
   `AktsCalculator, CafeteriaMenu, Checklists, Departments, Ego130, FaqDetail, Faq, Help, Leaderboard, NoteRequests, Notifications, PostDetail, SavedPosts, Schedule, SuggestionDetail, Suggestions, Tools, UserProfile`
3. **Re-render zincirleri** — `MainTabsScreen`'deki `setActiveTab`, `PushableStack`'teki `setOverlayActive`, `WaveTabBar`'daki `useNavigationState` + `barWidth` state'i.

**Oran: %70.** 1-8 arası maddeler yapıldığında bunun büyük kısmı kendiliğinden gider; kalan kısım ölçüm gerektirir.

---

## 10 — Önbellek

react-query zaten kurulu ve çalışıyor ([queryClient.ts](../../src/lib/queryClient.ts)) ama 23 ekranın yalnızca 2'sinde kullanılıyor. "Her seferinde yükleme animasyonu" şikayetinin tek sebebi bu.

**✅ Katman 1 yapıldı — 11 ekran taşındı.** Uygulanan `staleTime` tablosu:

| Ekran | staleTime | Gerekçe |
|---|---|---|
| Yemekhane (hafta + ay) | 30 dk | Menü gün içinde değişmiyor |
| SSS listesi | 24 saat | Moderasyondan geçiyor, neredeyse statik |
| SSS detay, Öneri detay, Not detay | 5 dk | Gövde sabit; yorum/oy zaten cache'e doğrudan yazılıyor |
| Öneriler listesi, Kontrol listeleri | 5 dk | Yavaş değişiyor; kendi eylemi anahtarı geçersiz kılıyor |
| Liderlik | 2 dk | Sıralama ölçütü anahtarın parçası |
| Kaydedilenler, Not istekleri | 60 sn | Kendi eylemi anında geçersiz kılıyor |
| **Program** | **∞** | Düzenleyici ekran — aşağıdaki nota bak |

**Program'ın `Infinity`'si bilinçli bir istisna.** O ekran okuma değil DÜZENLEME ekranı: ders eklemek önce cache'i yazıyor, sunucuya kayıt 500 ms sonra gidiyor. Arka planda kendiliğinden çalışan bir tazeleme o aralığa denk gelse kullanıcının yeni eklediği dersi sunucunun eski hâliyle ezerdi. Programı düzenleyen tek yer o ekran olduğu için otomatik tazelemeye zaten ihtiyaç yok.

**Taşınmayan iki ekran, ikisi de bilerek:**

- **Bildirimler** — verisi zaten 30 sn'de bayatlaması *gereken* tek şey, yani cache kazancı en düşük olan ekran. Buna karşılık okundu işaretleme, geri alma ve kategori akışlarıyla en fazla kapatılmış hata barındıran ekran. Kazanç küçük, regresyon riski büyük.
- **Kullanıcı profili** — 606 satır, sekme başına tembel yükleme. Kendi Profil ekranıyla aynı yapıda ve orada da aynı sebeple dokunulmamıştı.

**Yol üstünde düzelen üç ayrı hata:**
1. `refetchOnWindowFocus` React Native'de ölüydü — `focusManager` `AppState`'e bağlandı.
2. Kaydedilenler'den bir not çıkarınca liste güncellenmiyordu — `toggleSavePost` artık anahtarı geçersiz kılıyor.
3. Kontrol listelerinde slug ile gelindiğinde ilgili bölümü açan kod veri çekme fonksiyonunun içindeydi; liste her tazelendiğinde kullanıcının elle kapattığı bölüm zorla yeniden açılıyordu.

**Yeni bileşen: [Skeleton.tsx](../../src/components/Skeleton.tsx).** Nabız `SkeletonGroup` içinde bir kez kurulup context ile paylaşılıyor — her blok kendi shared value'sini kursaydı 12 bloklu bir ekranda 12 worklet UI thread'inde birden dönerdi. Testçilerde eski Android cihazlar da var.

**Katman 2 — diske kalıcılık (dikkatli).** `@tanstack/query-async-storage-persister` ile seçili anahtarları AsyncStorage'a yaz: uygulama kapanıp açılsa bile menü/bölümler anında gelir. **Sadece yavaş değişen, küçük veriler** — akış ve bildirimler asla. Böylece cihaz yavaşlamaz, talebiniz karşılanır.

**Oran: %95.**

---

## Uygulama sırası

**Faz 1 — kesin teşhisler, yüksek etki (1 gün)**
- Madde 4: yapay gecikmeyi kaldır + kutucukları memoize et
- Madde 7: profil aşamalı yükleme + sekme başına tembel istek
- Madde 6: keyboard-controller

**Faz 2 — render zincirleri (1 gün)**
- Madde 2: Tab.Navigator memoize + başlık kaynağını değiştir
- Madde 1: menü açılışındaki iki setState + istek
- Madde 8: avatar butonları

**Faz 3 — cache ve dayanıklılık (1-2 gün)**
- ✅ Madde 3: sekmelerde `freezeOnBlur: false` + bar'ı `KeyboardAvoider`'ın dışına çıkar
- ✅ react-query `focusManager`'ı `AppState`'e bağla (aşağıdaki nota bak)
- ✅ Madde 10 katman 1: 11 ekran react-query'ye taşındı
- ✅ Madde 5: yemekhane iskeleti (paylaşılan `Skeleton` bileşeniyle, 8 ekranda)

**Faz 3'te yol üstünde bulunan sessiz hata — ✅ düzeltildi.** `useUnreadNotifications` ve `useUnreadAnnouncements` `refetchOnWindowFocus: true` yazıyordu ama **React Native'de bu ayar ölüydü**: react-query odağı tarayıcının `visibilitychange` olayından okur, RN'de öyle bir olay yok. İki rozet de yalnızca 5 dakikalık poll ile tazeleniyordu. [queryClient.ts](../../src/lib/queryClient.ts)'de `focusManager` artık `AppState`'e bağlı. Genel varsayılan bilerek `refetchOnWindowFocus: false` kaldı — açık olsaydı uygulama her öne geldiğinde tüm sorgular aynı anda istek atardı, ki donmanın en kırılgan olduğu an tam da o.

**Faz 4 — ölçüm ve kalan**
- Madde 9'un kalanını gerçek cihazda ölç
- Madde 10 katman 2: kalıcı cache

**Tek build:** Faz 1-3 bitince tek bir `preview` APK ile hepsi + R8 birlikte test edilir. Kapalı test kanalına ancak o doğrulamadan sonra çıkılır (14 gün sayacı işliyor).

## Ölçüm

Tahminle çalışmayalım. Faz 1'den önce ve sonra aynı cihazda:
- React DevTools Profiler ile sekme geçişinde render sayısı
- `console.time` ile profil açılışından ilk veriye kadar geçen süre
- Android geliştirici seçenekleri → **GPU render profili** ile kare süreleri

---

## Henüz denk gelmediğiniz riskler

Testçi raporunda yok ama kodda duruyor. Sıralama gerçekleşme olasılığına göre.

### R1 ✅ — AKTS Excel içe aktarma: ANR riski · YÜKSEK

[ganoExcel.ts:89-99](../../src/utils/ganoExcel.ts#L89-L99):

```ts
const workbook = isCsv
  ? XLSX.read(await file.text(), { type: 'string' })
  : XLSX.read(await file.base64(), { type: 'base64' });
```

Üç sorun üst üste:
- `file.base64()` **tüm dosyayı** belleğe alıyor, üstelik base64 olarak (~%33 şişme).
- `XLSX.read` **tamamen senkron** — parse bitene kadar JS thread'i bloke. Animasyon yok, dokunuş yok, hiçbir şey yok.
- [AktsCalculatorScreen.tsx:403](../../src/screens/main/AktsCalculatorScreen.tsx#L403)'teki `DocumentPicker.getDocumentAsync` çağrısında **dosya boyutu kontrolü yok.**

Bir öğrenci 500+ satırlık bir transkript yüklerse uygulama saniyelerce tamamen donar. Android 5 saniyeyi aşarsa **"Uygulama yanıt vermiyor"** diyalogu çıkarır ve bu **Play Console'a ANR olarak düşer** — üretime başvururken bakılan Android Vitals metriğini doğrudan bozar.

**✅ Yapıldı:** `MAX_IMPORT_BYTES = 2 MB` ve `MAX_IMPORT_ROWS = 2000` eklendi. Eleme İKİ yerde: ekranda `DocumentPicker`'ın verdiği `size` ile parse'a hiç başlamadan, ve `ganoExcel` içinde dosyanın kendisinden okunarak (çünkü `size` opsiyonel bir alan, bazı platformlarda `undefined` gelebiliyor). Kalıcı çözüm parse'ı bir worker'a almak ama o büyük iş ve artık acil değil.

### R2 ✅ — Liderlik tablosu: sınırsız liste · YÜKSEK (zamanla kesin)

[LeaderboardScreen.tsx:134](../../src/screens/main/LeaderboardScreen.tsx#L134) düz bir `ScrollView` içinde `entries.map()` — sayfalama yok, sanallaştırma yok, üstelik her satırda ayrıca `entry.badges.map()` var. Sunucu ne dönerse hepsi tek karede mount ediliyor.

**9 testçiyle sorun çıkmaz.** Kullanıcı sayısı birkaç yüze çıktığında kesin donar — ve bu tam olarak üretime çıktıktan sonra olur.

**✅ Yapıldı:** `ScrollView` + `map` → `FlatList`, satır `React.memo`'ya alındı. `removeClippedSubviews` bilerek KAPALI — satırlar dokunulabilir (profile gidiyor) ve bu prop'un Android'de ekrandan çıkıp giren satırlarda dokunuşu yutması bilinen bir sorun.

### R3 ✅ — Program ekranı görsel/PDF dışa aktarımı: bellek · ORTA

[ScheduleScreen.tsx:150-156](../../src/screens/main/ScheduleScreen.tsx#L150-L156): `captureRef(..., { quality: 1, result: 'data-uri' })` tam ekran PNG'yi **base64 string olarak belleğe** alıyor, sonra o string HTML'e gömülüp `printToFileAsync`'e veriliyor. Aynı görüntü aynı anda üç kopya hâlinde bellekte: bitmap, base64 string, HTML içindeki hâli.

Düşük RAM'li cihazda çökme riski. Play Console'a crash olarak düşer.

**⚠️ PLANDAKİ ÇÖZÜM YANLIŞTI.** "Dosya yolu kullan, PDF'e `file://` ile referans ver" dedim — olmuyor: [expo-print dokümanı](https://docs.expo.dev/versions/v54.0.0/sdk/print/) açıkça diyor ki *"On iOS, printing from HTML source doesn't support local asset URLs (due to WKWebView limitations). As a workaround you can use inlined base64-encoded strings."* Base64 zorunlu.

Ayrıca `quality: 0.9` da işe yaramazdı: view-shot'ta `quality` **yalnızca jpg gibi kayıplı formatlarda** geçerli, png'de hiçbir etkisi yok — koddaki `quality: 1` baştan beri ölü bir parametreydi.

**✅ Gerçek çözüm:** yakalamanın piksel genişliği sınırlandı (`width: 1240` ≈ A4 @150 DPI). Bu, bellek tepe noktasını cihaz yoğunluğundan BAĞIMSIZ olarak sınırlıyor — asıl tehlike yüksek yoğunluklu tablette tam çözünürlük yakalamaktı. PNG paylaşım yolu dokunulmadı: orada `result` varsayılanı `tmpfile`, görüntü JS tarafına hiç geçmiyor.

### R4 — AKTS hesaplayıcı ekranı: sanallaştırma yok · ORTA

`AktsCalculatorScreen` düz `ScrollView` içinde 30 ayrı `.map()` çağrısı barındırıyor. Ders sayısı arttıkça (4 yıllık transkript ~50-60 ders) her render'da hepsi çiziliyor.

### R5 — ❌ YANLIŞ ALARM, risk yok

İlk taramada "not eklemede boyut kontrolü yok" demiştim. **Yanlıştı.** [AddPostScreen.tsx](../../src/screens/main/AddPostScreen.tsx) hem `MAX_FILES` hem `MAX_SIZE` (10 MB) kontrolü yapıyor; grep penceresi kontrolün birkaç satır dışında kaldığı için gözden kaçmış. Bu maddede yapılacak bir şey yok.

### Risk olmadığını doğruladıklarım

- `MenuDrawerContent`'teki 1 sn'lik `setInterval` — `visible` ile korumalı ve temizleniyor, panel kapalıyken çalışmıyor. Sorun yok.
- `NotificationsScreen`, `ChecklistsScreen`, `NoteRequests`, `Suggestions`, `Faq` — hepsi `FlatList` kullanıyor. Sorun yok.
- `ImagePicker` — `quality: 0.8`, `base64` kapalı. Sorun yok.
- `UserProfileScreen` — `ScrollView` + map ama gönderiler `POSTS_LIMIT` ile sayfalanıyor. Düşük risk.

---

## Yeni genel kural — gecikmeli yükleme ✅

**2026-09-13.** Kullanıcı isteği: *"internet hızı yeterliyse loading spinner ya da skeleton loading olmamalı asla."* [useDelayedLoading.ts](../../src/hooks/useDelayedLoading.ts) eklendi: `isLoading` iskeleti DOĞRUDAN tetiklemiyor, veri 200ms'den önce gelirse iskelet hiç görünmüyor. 200ms seçildi çünkü göz ~100ms altını "anında" algılıyor, ~300ms üstünü "bekleme" olarak kodluyor.

Şimdilik yalnızca sekmelerden erişilen iki ekrana bağlandı: **CafeteriaMenuScreen** (hafta + ay iskeleti) ve **ProfileScreen** (`LoadingDeer`) — "geçişler" bağlamında istenen tam olarak buydu. Diğer react-query'li ekranlarda (SSS, Öneriler, Kontrol listeleri, Program, Not istekleri, Kaydedilenler, detay sayfaları) aynı davranış istenirse tek satırlık bir sarmalama, hepsine aynı hook'la genişletilebilir.

---


## Tab bar donması — sekme geçişinde ✅

**2026-09-13, 1.0.2 test dönüşü.** *"none işe yaramış ama tabbar donuyor."* Yani sayfa geçişi temizlendi, geriye bar'ın kendi render maliyeti kaldı.

Ölçüm: [AvatarSVG.tsx](../../src/components/avatar/AvatarSVG.tsx) piksel-sanat bir avatar — altı ayrı dizi (kıyafet, yüz, sakal, saç, kaş, göz) map'lenip her parça ayrı bir `<SvgRect>` oluyor. `avatarConfig.ts`'teki stil dizilerinden sayıldı: seçilen stillere göre tek bir avatar kabaca **30-50 SVG düğümü**. Android'de react-native-svg bunların her biri için native bir view kuruyor.

Zincir şuydu: sekmeye dokun → `activeTab` değişir → `WaveTabBar` render olur → beş yuva birden yeniden kurulur → profil yuvasındaki avatar dahil → **~40 native SVG düğümü sökülüp yeniden kurulur.** Üstüne 4 lucide ikonu (onlar da SVG) ve her render'da yeniden çağrılan stil fonksiyonları (`BEARD_STYLES[i](renk)` gibi yeni dizi üretiyor).

**✅ Üç katman memoizasyon:**
1. `AvatarSVG` → `React.memo`. Prop'ları sığ karşılaştırmaya uygun (`config` react-query cache'inden, referansı sabit).
2. `AvatarDisplay` → `React.memo`. İç state'i (`showPhotoInBoth`) korunuyor.
3. `TabSlot` → ayrı, memoize bileşen. Bir geçişte yalnızca İKİ yuvanın `isFocused`'ı değişiyor; kalan üçü hiç çizilmiyor. `onPress` bağımlılıksıza yakın `useCallback` (yalnız `navigation`) — memo'nun ön şartı.

Sonuç: geçişte avatar SVG'si artık hiç yeniden kurulmuyor, yalnızca çevresindeki halkanın kalınlığı değişiyor.

---


## 11 — Eksen değişikliği: blokaj JS'te değil, Android metin ölçümünde

**2026-09-14, dördüncü tur (sürüm 1.0.8 / vc9).** Kullanıcıdan iki yeni veri noktası geldi ve bunlardan biri bu belgenin üç turdur izlediği ekseni geçersiz kılıyor:

1. **iOS'ta hiç kasma yok** (TestFlight 12). Bu, aşağıdaki "Hâlâ açık" 5. sorunun cevabı.
2. Güncellemelerin çoğu `main`'de değil bu branch'te — `main` build 11'de duruyor.

### Neden bu, önceki üç turu açıklıyor

Teşhis rozeti JS thread'inin bloke olduğunu kanıtladı (v2: 322 sn pencerede 40 blokaj / 39.744 ms). Buradan sonraki her tur "JS'te iş azaltalım" diye ilerledi: `freezeOnBlur`, `enableFreeze` aç-kapa, memoizasyon, worklet stabilizasyonu, profil parçalama. Her tur bir öncekini çürüttü.

**Ama JS bundle'ı iOS'ta birebir aynı.** Aynı Hermes, aynı React ağacı, aynı render sayısı, aynı worklet'ler, aynı react-query cache'i. O 39 saniye gerçekten JavaScript *çalıştırmakla* geçiyorsa iOS'ta da geçmesi gerekirdi; iPhone'lar Hermes bytecode'unu 30 kat hızlı koşturmuyor. iOS tamamen temiz.

Sonuç: JS thread'i Android'de **JavaScript çalıştırırken değil, Android native tarafına inen senkron bir çağrıyı beklerken** bloke. `enableFreeze` A/B'si bu yüzden hiçbir turda sonuç vermedi — ölçtüğü değişken maliyetin kaynağı değil.

**Kendi verimiz de bunu söylüyor ve bu daha önce fark edilmemiş:** blokajlar rotaya göre yığılmış (Profile 23 blokaj / 24.499 ms · Home 13 / 12.133 ms · PostDetail 4 / 3.112 ms). `enableFreeze` teorisi doğru olsaydı — "paylaşılan context değişince mount'lu bütün ekranlar render oluyor" — maliyet hangi ekranda olunduğundan bağımsız, rotalara kabaca eşit dağılırdı. Rotaya göre yığılması, maliyetin **o an ekranda ne olduğuyla** ölçeklendiğini gösteriyor: satır başına ölçüm, global render dalgası değil.

### Bu turda kapatılan iki yol

**a) Global `adjustsFontSizeToFit` kaldırıldı** — [applyGlobalFont.ts](../../src/theme/applyGlobalFont.ts). Bu dosya bir haftalık teşhiste hiç açılmamıştı. `numberOfLines` verilmiş HER yazıya otomatik basılıyordu ve prop'un implementasyonu platforma göre aynı iş değil: iOS'ta UIKit/CoreText tek ölçüm pasında hallediyor (bedava), Android'de RN iteratif döngüyle yapıyor — `StaticLayout` kur, taşıyor mu bak, fontu küçült, baştan kur. Yeni Mimari'de bu ölçüm JNI üzerinden senkron. `PostCardModern`'da satır başına 3 tane + `BadgeChip` var; Home ve Profile'ın tabloda en üstte olmasının sebebi bu olabilir. Android görünürlük değişiminde tüm pencereyi yeniden ölçtüğü için öne dönüşte hepsi döngüsünü birden koşturuyor.

Kırpılma savunması `MAX_FONT_SCALE = 1.2` tavanında kalıyor (bedava). Küçültmeyi gerçekten isteyen iki etiket prop'u zaten elle veriyordu ([AppHeader.tsx](../../src/components/layout/AppHeader.tsx), [Ego130ScheduleScreen.tsx](../../src/screens/main/Ego130ScheduleScreen.tsx)) — yani global varsayılana bağlı değiller, davranışları değişmiyor.

**b) Çevrimdışı kilidi ön plana bağlandı** — [useIsOffline.ts](../../src/hooks/useIsOffline.ts). Bugün 11:56'da giren `ac21464` kilidi Android'de çalışır hâle getirdi; ama [RootNavigator.tsx](../../src/navigation/RootNavigator.tsx) `isOffline` true olduğunda hâlâ erken `return <OfflineEgoScreen />` yapıyor, yani Drawer + Stack + Tab ağacının TAMAMI unmount oluyor. Android ekran kapalıyken Wi-Fi'yi düzenli uykuya alıyor ve yeni yoklama bunu güvenilir biçimde görüyor — kilit arka planda devreye girerse kilit açıldığında ağaç sıfırdan mount ediliyor. iOS'ta bu yol yok (uygulama askıya alınıyor, kilitte bağlantı kaybı bildirilmiyor). Kilit artık ön planda değilken mevcut değerinde donuyor; dönüşte taze okumayla karar veriyor.

⚠️ Bu (b) maddesi aynı zamanda bir **ölçüm kirliliği** kaynağıydı: `ac21464` ölçüm turlarının ortasında girdi, yani 1.0.7 verisi bu yolu içeriyor, 1.0.6 tabanı içermiyor.

### Bilerek yapılmayan

`applyGlobalFont`'taki `[{ fontFamily }, props.style]` her render'da yeni dizi üretiyor. Düzeltilebilir ama **bu turda dokunulmadı**: turun tek değişkenli kalması bu belgenin üç turdur eksik olan disiplini. Sonraki tura not.

### Ölçüm

Anahtar `diag:jsblocks:v4`'e yükseltildi. **Beklenti: HOME ve PROFILE satırları düşmeli**, ayrıca `sinceResumeMs` dolu olan (öne dönüş) blokajları düşmeli. Düşmezse hipotez çürür ve sıradaki aday react-native-svg'nin Android'de her `<Rect>` için native view kurması olur.

---

## 12 — 1.0.7 regresyonu: NativeWind Reanimated interop'u geri alındı

**2026-09-14.** Kullanıcı raporu: *"1.0.7'de nativewind değişikliği yapıldı ve profil sayfası tasarımı kaydı baştan aşağıya."* `6efd1ef` geri alındı.

Sebep `remapProps`'un çalışmaması değil, o commit'in **çalışan garantili stilleri kırılgan bir yola taşıması**:

| Önce (garantili) | Sonra (kırılgan) |
|---|---|
| `style={[{ position:'absolute', top:0, left:0, right:0 }, headerAnimStyle]}` | `className="absolute top-0 left-0 right-0"` + `style={headerAnimStyle}` |
| `contentContainerStyle`'da `paddingHorizontal:16, gap:10` | `contentContainerClassName="px-4 gap-2.5"` |
| `style={{ flex: 1 }}` | `className="flex-1"` |

`remapProps` mevcut `style`'ı **ezmiyor** — `react-native-css-interop/dist/runtime/native/api.js` içinde `assignToTarget(..., { objectMergeStyle: "toArray" })`, yani diziye ekliyor ve animasyon stili kaybolmuyor. Yaptığı şey style dizisine `PLACEHOLDER_SYMBOL` taşıyan opak bir nesne koyup asıl bileşeni render etmek. O placeholder'ı çözecek olan css-interop runtime'ı ise Reanimated'in `createAnimatedComponent` ile ürettiği iç bileşeni tanımıyor. Çözülmediğinde sonuç "biraz farklı" değil, **stilin tamamen yok olması**: başlık `position:absolute`'unu kaybedip normal akışa düşüyor, pager sayfaları yatay dolgusunu kaybediyor.

**Çıkarılan ders — genel kural:** `Animated.View` üzerinde `className`'in derleme-zamanı dönüşümle çalışmadığı bilgisi DOĞRU ve değerli; yanlış olan, ona `remapProps` ile çözüm üretip **var olan çalışan stilleri** o yola taşımak. Bir stil şu anda inline `style` olarak çalışıyorsa, onu className'e taşımanın kazancı yalnızca estetik, riski ise sessizce kaybolması. Kural: animasyon taşıyan `Animated.View` yalnızca animasyonu taşır; görsel/yerleşim stilleri ya inline `style` olarak aynı elemanda ya da içindeki düz `View`de kalır.

⚠️ Bu geri alma aynı zamanda **ölçüm kirliliğini** kaldırıyor: Profile blokaj tablosunun birinci satırı (23 blokaj / 24.499 ms) ve görünür biçimde bozuk bir profil sayfası kullanıcının o ekranı nasıl kullandığını değiştirir — 1.0.8 turunun Profile verisi okunamaz olurdu.

---

## Açık sorular

### Cevaplananlar

1. ✅ **Madde 3 — bar görünüyor mu?** "Alt bar kalıyor, sadece duruyor." Kaybolmuyor. Aday 1 (`keyboardOpen`) elendi; teşhis `enableFreeze`'e döndü. Klavye aç/kapat testi yapılamadı (o ekranlarda yazı kutusu yok) — gerek de kalmadı.
2. ✅ **Madde 2 — `shift` vazgeçilmez mi?** "Kalmalı." Kalıyor; ayrıca ortaya çıktı ki bedeli de yokmuş (bkz. madde 2 düzeltmesi).
3. ✅ **Platformlar.** iOS 26+; Android'de çoğunluk son sürüm ama **eski sürüm cihazlarda da test ediliyor.** Yani yüksek performans varsayamayız — madde 9 ve 10'daki cache kararları düşük uçlu cihaza göre verilmeli. Bu, kalıcı cache'i (madde 10 katman 2) daha da değerli kılıyor: yavaş cihazda en pahalı şey ağ isteği değil, isteğin dönüşünü bekleyen boş ekran.

### Hâlâ açık

4. **Madde 9:** test cihazlarının modeli? ("eski sürüm" hangi Android? 8? 10?) GPU render profili ölçümü için gerekli.

### Sonradan cevaplanan

5. ✅ **iOS'ta bu maddelerden hangileri görülüyor?** — **HİÇBİRİ.** "iOS'ta hiç kasma yok" (TestFlight 12, 2026-09-14). Bu cevap tek bir maddeyi kapatmakla kalmıyor, belgenin teşhis eksenini değiştiriyor: aynı JS bundle iOS'ta temiz koşuyorsa blokaj JavaScript çalıştırmaktan gelmiyor. Bkz. madde 11.
