# iOS/Android/iPad Bug Fix Paketi — nottepe-mobile

## Context

Kullanıcı sohbet boyunca toplam 10 sorun bildirdi. Kullanıcının kendi ifadesine göre öncelik: **"gerekiyorsa uygulamanın boyutu artabilir ama yavaşlık kesinlikle çözülmeli"** — yani performans #1 öncelik, ek bağımlılık (örn. expo-image) kabul edilebilir.

1. **Donma/yavaşlık** (iPhone 13, Android, iPad hepsinde) — en büyük sorun.
2. **Cihaz aşırı ısınıyor** (iPhone kullanırken).
3. **Profil sayfası en üstteyken yukarı çekince kasıyor.**
4. **Tablette (iPad) profil ana sayfa ve araçlar sayfalarında kayma.**
5. **Tablette render sırasında flash efekti + gri iz.**
6. **iOS'ta avatara tıklayınca drawer (menü) açılmıyor.**
7. **Drawer açıldığında üst köşelerin arkası beyaz kalıyor.**
8. **İlk girişte yanlış "internet bağlantınız yok" uyarısı** (aslında internet var).
9. **Gönderi detay sayfasında kaydetme ikonu ekrana sabit** — kartın sağ üstünde hizalı olmalı, kartla birlikte kaymalı.
10. **iPhone'larda gönderi/profil sayfalarına girince soldan kaydırarak geri çıkılamıyor.**
11. **Duyurular sayfasında "Tümü" butonu basılmıyor.**
12. **Bölüm sayfası tasarımında başlık/takip butonu sola-üste yapışık duruyor.**
13. **Bölüm sayfasında üst bar "Bölüm" yazıyor (fakülte adı yazmalı), kart üstü bilgiler ortasız/paddingsiz.**

Kapsamlı bir codebase araştırması (8 paralel Explore ajanı + 1 Plan ajanı) her sorun için kesin, dosya/satır seviyesinde kök nedenler buldu. Kritik dosyaların çoğunu (AppHeader.tsx, useIsOffline.ts, RootNavigator.tsx, drawerConstants.ts, metrics.ts, ProfileScreen.tsx) ben de okuyup satır numaralarını ve kod içeriğini doğruladım.

Mevcut mimari (reanimated `useAnimatedScrollHandler`, react-navigation drawer, `useMetrics`/`ContentContainer` responsive sistemi) korunacak; büyük bir yeniden yapılanma yok, hedefli düzeltmeler yapılacak.

---

## Öncelik 1 — Donma / Performans / Isınma (Bug 1+2+3)

Kök neden: `ProfileScreen.tsx`'te 7 ayrı `Animated.ScrollView` + throttle'suz `runOnJS` köprüsü, tüm `FlatList` ekranlarında sanallaştırma (virtualization) ayarlarının eksikliği, kart component'lerinin memo'suz olması, avatar/görsellerin cache/resize olmadan çekirdek `Image` ile render edilmesi.

**1.1 — expo-image'e geçiş** (`npx expo install expo-image`)
- `src/components/avatar/AvatarDisplay.tsx` (satır 30, 37, 46): RN `Image` → expo-image `Image`, `contentFit="cover"`, `transition={150}`, `cachePolicy="memory-disk"`, `recyclingKey`. Bu component merkezi olduğu için PostCard, AppHeader, ProfileScreen'deki tüm avatar kullanımlarını otomatik kapsar.
- `src/components/BadgeChip.tsx` (satır 25): aynı geçiş, düşük öncelik.

**1.2 — ProfileScreen scroll handler'larını hafiflet** (`src/screens/main/ProfileScreen.tsx`)
- Satır 779-794 (`postsScrollHandler`/`savedScrollHandler`): her scroll frame'inde çağrılan `runOnJS(handleScroll)('posts', event)` çağrısını worklet içinde bir mesafe-eşiği kontrolüyle sınırla (yalnızca listenin sonuna yaklaşınca tetikle), her frame'de değil.
- Satır 768-773 (`headerAnimStyle`/`cardAnimStyle`): `cardHeight` React state'ine closure ile bağlı — bunu bir `useSharedValue`'ya da yansıtıp worklet içindeki referansı state yerine shared value'dan oku (worklet'in her state değişiminde yeniden bind olmasını önler).
- Satır 866 vs 874/894/926/959/1009/1062/1107: `scrollEventThrottle` tutarsız (pager `32`, sayfalar `16`) — yalnızca dikey pozisyon takibi yapan 5 sekmede (lists/akts/schedule/follows/forums) `32`'ye çıkar; posts/saved'de 1.2'deki eşik-gate zaten `runOnJS` sıklığını düşürüyor.

**1.3 — PostCard'ı memoize et**
- `src/components/PostCard.tsx` satır 14: `React.memo(...)` ile sar (tek satır, tüm tüketicileri kapsar).
- Önkoşul: `ProfileScreen.tsx` satır 632 (`handlePostDelete`) ve satır 909 (`saved` sekmesindeki inline `onDelete`) referans kararlılığı için `useCallback` ile sabitlenmeli — aksi halde memo referans eşitsizliği yüzünden etkisiz kalır.

**1.4 — Tüm FlatList ekranlarına sanallaştırma ayarları ekle**
Etkilenen dosyalar (hiçbirinde `windowSize`/`removeClippedSubviews`/`maxToRenderPerBatch`/`initialNumToRender` yok, `renderItem` hepsi inline):
`HomeScreen.tsx:237-262`, `SavedPostsScreen.tsx`, `DepartmentDetailScreen.tsx`, `FaqScreen.tsx`, `SuggestionsScreen.tsx`, `NoteRequestsScreen.tsx`, `DepartmentsScreen.tsx`, `NotificationsScreen.tsx` (2 liste), `ChecklistsScreen.tsx`.
Desen: `renderItem`'ı `useCallback` ile dışarı çıkar, `removeClippedSubviews`, `maxToRenderPerBatch={6}`, `windowSize={7}`, `initialNumToRender={6}` ekle. Tüm tab'lar aynı anda mount'lu kaldığı için (`MainTabsScreen.tsx` unmount etmiyor) bu optimizasyon eksikliği toplam bellek/CPU baskısını katlıyor — ısınmanın da olası kaynağı.

**1.5 — react-native-screens freeze ayarı**
Repo genelinde `enableScreens`/`enableFreeze`/`freezeOnBlur` hiç çağrılmıyor (grep boş) — arka plandaki (odakta olmayan) ekranlar dondurulmuyor, native-stack geçişi sırasında bir önceki ekran hâlâ re-render/layout yapabiliyor. `App.tsx` başlangıcında `enableFreeze(true)` çağır ve navigasyonda gerekmeyen ekranların re-render'ını kes — hem genel performansa hem 5. maddedeki tablet flash sorununa katkı sağlar.

**1.6 — (Ölçüm sonrası, opsiyonel) posts/saved sekmelerinde `.map()` → `Animated.FlatList`**
Mimari değişikliği daha büyük olduğu için 1.1-1.5 uygulanıp gerçek cihazda ölçüldükten sonra ayrıca değerlendirilecek.

---

## Öncelik 2 — Tablet (iPad) kayması + render flash/gri iz (Bug 4+5)

İki şikayet de büyük ölçüde AYNI kök nedenden besleniyor.

**2.1 — ProfileScreen pager genişlik uyuşmazlığı (ana kök neden)**
`src/screens/main/ProfileScreen.tsx:208` — `const { width: screenWidth } = useWindowDimensions();` TAM ekran genişliğini (iPad landscape ~1024px) veriyor. Ama pager gerçekte `ContentContainer`'ın sınırladığı `contentMaxWidth` (720px, `src/theme/metrics.ts:55`) içine sıkışmış render ediliyor. Sayfa genişlikleri (satır 870, 890, 922, 955, 1005, 1058, 1103: `style={{ width: screenWidth }}`) ve `scrollTo` hesaplamaları (satır 324, 542) hep 1024 ile yapıldığından, görünen pager 720px olduğu için sekmeler arası geçişte içerik kayıyor VE konteynerin dışına taşan alanlarda arkadaki `colors.ground` (`#F4F5F7`, açık gri) zemini görünür oluyor — bu da "flash + gri iz" olarak algılanıyor.

Fix: Satır 208'deki `useWindowDimensions()` çağrısını `useMetrics()`'ten gelen gerçek içerik genişliğiyle değiştir:
```ts
const { width: windowWidth, contentMaxWidth } = useMetrics();
const screenWidth = Math.min(windowWidth, contentMaxWidth);
```
Telefonda `contentMaxWidth = Infinity` olduğu için `Math.min` her zaman `windowWidth`'i seçer — telefon davranışı birebir aynı kalır.

**2.2 — PushableStack'in sürekli overflow:hidden sarmalaması (flash'a ikincil katkı)**
`src/components/layout/PushableStack.tsx:110` — tüm push edilen ekranlar sürekli `overflow:'hidden'` + animasyonlu `borderRadius` içeren bir `Animated.View`'da; bu native tarafta sürekli bir offscreen/composite katmanı gerektiriyor. Tablette ekran alanı çok daha büyük olduğu için her native-stack geçişinde bu katmanın yeniden rasterize edilmesi orantısız pahalı — GPU'yu zorlayıp geçişte kare düşüşü/flash yaratıyor olabilir. **Aksiyon**: 1.5'teki `enableFreeze` uygulandıktan sonra gerçek cihazda tekrar ölçülecek; hâlâ belirginse `overflow:hidden`'ı yalnızca köşe animasyonu aktifken (drawer açılış/kapanış geçişi sırasında) uygulayacak şekilde koşullu hale getirmek değerlendirilecek (drawer kapalıyken `overflow:'visible'` + sabit `borderRadius:0`).

Ek doğrulama: `useWindowDimensions` grep'i yalnızca `ProfileEditModal.tsx` (yükseklik için, risksiz) ve `ProfileScreen.tsx`'te bulundu — "araçların detaylarında kayma" şikâyeti muhtemelen ProfileScreen pager'ının AKTS/Program sekmelerinden kaynaklanıyor, aynı fix (2.1) onları da kapsar.

Doğrulama testi: iPad (9. nesil + Pro 11") hem portrait hem landscape'te ProfileScreen'in 7 sekmesi arasında dokunarak/kaydırarak geçiş — kayma ve gri flash kalmamalı; genel navigasyon (Stack push/pop) sırasında da flash gözlenmemeli.

---

## Öncelik 3 — Drawer açılmama (Bug 6) + Beyaz köşe (Bug 7)

**3.1 — iOS'ta avatar tıklaması yutuluyor**
Kök neden: `src/navigation/drawerConstants.ts:44` — `FULL_WIDTH_SWIPE_ROUTES = ['Home','Departments','Tools']` bu ekranlarda drawer'ın `swipeEdgeWidth`'ini tüm ekran genişliğine ayarlıyor (`RootNavigator.tsx:88`). Bu tam-genişlik pan gesture'ı AppHeader'daki avatar `Pressable`'ının (react-native çekirdek) üzerini kaplıyor; iOS'ta RNGH'nin gesture-arbitration'ı ile RN-core `Pressable`'ın touch handler'ı arasındaki öncelik farkı yüzünden dokunuş "pan" tarafından yutulup `onPress` hiç tetiklenmiyor.

Fix: `src/components/layout/AppHeader.tsx` satır 2 — `Pressable` import'unu `react-native`'den değil `react-native-gesture-handler`'dan al. Üç kullanım da (satır 80 avatar, 93 bildirim zili, 113 ekle butonu) değiştirilecek.

**3.2 — Beyaz üst köşeler**
- `src/navigation/RootNavigator.tsx:210-220` — sabit yama `height: insets.top + 40`, ama `PushableStack.tsx:45`'teki gerçek köşe yarıçapı `PUSHABLE_STACK_CORNER_RADIUS = 50`. Fix: `insets.top + 40` → `Math.max(insets.top, 44) + PUSHABLE_STACK_CORNER_RADIUS`.
- `App.tsx:61-64` — `navTheme.colors.background` için `'#222831'`/`'#FFFFFF'` elle kopyalanmış magic number, `palette.ts`'teki `surface` rengiyle senkron tutuluyor ama tek kaynaktan beslenmiyor. Fix: literal yerine `palette.ts`'ten ilgili değeri import edip kullan.

Doğrulama testi: Home/Departments/Tools sekmelerinde avatar/zil/artı dokunuşu; kenar-swipe ile drawer açma davranışı bozulmamalı; Dynamic Island'lı + notch'suz iPhone + bir Android cihazda köşelerde beyaz/gri sızıntı kalmamalı (açık+koyu tema).

---

## Öncelik 4 — iOS'ta geri kaydırma jesti çalışmıyor (Bug 10)

Kök neden: PostDetail/UserProfile ekranlarında **üç ayrı gesture recognizer** aynı sol kenarda rekabet ediyor ve aralarında hiçbir öncelik/simultanlık anlaşması yok (`simultaneousHandlers`/`waitFor`/`blocksExternalGesture` hiç kullanılmamış):
1. react-native-screens'in native iOS edge-pan-to-pop recognizer'ı — `RootNavigator.tsx`'te `PostDetail`/`UserProfile` `Stack.Screen`'lerinde `gestureEnabled: false` set edilmediği için native-stack'in varsayılan (iOS'ta `true`) pop jesti hâlâ aktif.
2. `src/components/layout/AppShell.tsx:66-96` — `BackSwipeContainer`'ın elle yazılmış `Gesture.Pan()`'ı (`activeOffsetX(25)`, `failOffsetY([-15,15])`), tüm ekranı kaplıyor (kenara sınırlı değil).
3. Drawer.Navigator'ın kendi pan gesture handler'ı — `swipeEnabled` `DrawerSwipeSync` içinde asenkron `useEffect` ile `false`'a çekiliyor, mount/focus anında kısa bir pencerede hâlâ etkin olabilir.

iOS'ta UIKit varsayılanı tanınmayan recognizer'lar arasında simultan tanımayı reddetmek olduğundan, bu üçü birbirini bloke ediyor — Android'de touch-dispatch modeli farklı olduğu için sorun görünmüyor.

Fix (iki parçalı):
- `RootNavigator.tsx`'te `PostDetail` ve `UserProfile` `Stack.Screen`'lerine açıkça `options={{ gestureEnabled: false }}` ekleyerek native-stack'in kendi edge-pop recognizer'ını devre dışı bırak — AppShell'in manuel jesti tek/otoriter kaynak olsun.
- `AppShell.tsx`'teki `Gesture.Pan()`'a Drawer'ın pan handler'ı ile `blocksExternalGesture` veya (daha basit) `activeOffsetX(25)` yerine kenara yakın bir başlangıç sınırı (`hitSlop`/`GestureDetector`'ı yalnızca ekranın sol ~30dp'lik şeridini kaplayan ayrı bir View'e taşımak) ile çakışma yüzeyini daraltmayı değerlendir. `failOffsetY([-15,15])` eşiğini biraz gevşetmek (ör. `[-20,20]`) iOS'ta ScrollView'ın pan'i erken "claim" etmesine karşı toleransı artırabilir — ama önce `gestureEnabled:false` düzeltmesiyle test edilmeli, tek başına yeterli olabilir.

Doğrulama testi: gerçek iOS cihazda PostDetail ve UserProfile ekranlarına girip sol kenardan sağa kaydırarak geri çıkma; dikey scroll ve rozet şeridi (UserProfile'daki yatay scroll) ile karışık/çapraz kaydırmalarda da (yanlışlıkla) geri gitmemeli; drawer'ın kendi swipe-to-open davranışı diğer ekranlarda bozulmamalı.

---

## Öncelik 5 — Gönderi detay: kaydetme ikonu konumu (Bug 9)

Kök neden: `src/screens/main/PostDetailScreen.tsx:209-213` — kaydetme ikonu (`SaveButton`) `ScrollView` DIŞINDA, ekranın kök `View`'ine göre `position:'absolute', top:8, right:8` (satır 220, `floatingSave` style) ile konumlanıyor — bilinçli bir önceki isteğin kalıntısı (satır 207-208'deki yorum: "ekranın en sağ üstünde sabit, kaydırma boyunca yerinde kalıyor"). Kullanıcının yeni isteği tam tersi: ikon karta göre hizalı olmalı ve kartla birlikte scroll olmalı.

Referans doğru pattern: `PostCardModern.tsx:122-131` ve `PostCardClassic.tsx` (~119-130) — `SaveButton` absolute değil, `crumbRow` flex-row'unun sonunda, kartın kendi layout akışıyla birlikte konumlanıyor.

Fix: `PostDetailScreen.tsx`'teki `floatingSave` `View`'ini `ScrollView` dışından alıp `styles.head` (satır 121, kartın kendisi) içine taşı — feed'deki gibi flex-row ile (author satırının sonuna) ya da `head`'e `position:'relative'` verip ikonu ona göre `position:'absolute', top, right` ile konumlandırarak. İkinci yöntem mevcut görsel stile (yuvarlak buton, `t.ground` arka plan) daha yakın kalır ve daha az JSX değişikliği gerektirir.

Doğrulama testi: PostDetail'de aşağı kaydırınca ikon kartla birlikte yukarı gitmeli (ekrana sabit kalmamalı), kartın sağ üst köşesiyle hizalı durmalı; kaydetme/kaydırma etkileşimi (`toggleSavePost`) bozulmamalı.

---

## Öncelik 6 — Yanlış "internet yok" uyarısı (Bug 8)

Dosya: `src/hooks/useIsOffline.ts`

Kök neden (doğrulandı, satır 22-46): `useState(isConnected === false)` başlangıç değeri VE soğuk-açılış dalı (satır 37-39) — `hasBeenOnlineRef.current` henüz `true` olmadıysa `isConnected===false` anında (debounce'suz) `debouncedOffline=true` yapıyor. Soğuk açılışta `expo-network`'ün native tarafı bağlantıyı doğrulamadan kısa süreliğine `false` dönebiliyor, bu da yanlış pozitife yol açıyor.

Fix: Başlangıç state'ini `false` yap, ve "hiç çevrimiçi olmamış" dalına kısa bir **soğuk-başlangıç bekleme penceresi** (`COLD_START_GRACE_MS`, ör. 1200ms) ekle — bu süre içinde `isConnected===false` gelirse hemen kilitlemek yerine bekle; süre dolana kadar hâlâ `false` geliyorsa (gerçekten offline) kilitle. `OFFLINE_DEBOUNCE_MS` (mevcut, önceden-çevrimiçi-olmuş kullanıcı için titreşim toleransı) davranışı değişmeden kalır.

Doğrulama testi: uçak modunda soğuk açılış (gerçekten offline → grace süresi sonunda EGO130'a düşmeli), normal Wi-Fi ile soğuk açılış (yanlış "offline" görünmemeli), açıkken Wi-Fi kapat/aç (mevcut debounce davranışı korunmalı).

---

## Öncelik 7 — Duyurular "Tümü" filtresi + Bölüm sayfası layout/başlık (Bug 11+12+13)

**7.1 — Duyurular "Tümü" butonu tepki vermiyor**
`src/screens/main/NotificationsScreen.tsx:463-483` — filtre şeridinin (Tümü + kategori çipleri) TAMAMI `categories.length > 0` koşuluna bağlı (`useNotificationCategories`, react-query, `retry:false`). Kategoriler API'si boş/hata dönerse ya da henüz yüklenmediyse `ListHeaderComponent` tamamen `null` oluyor — yani "Tümü" çipi hiç render edilmiyor (kullanıcı "basılmıyor" olarak algılıyor, aslında orada değil ya da geç beliriyor). Kodun kendisi (`onPress={() => setActiveCategory('')}` → `useEffect` → `notificationAPI.getAll('')`) mantıksal olarak doğru; sorun `categories.length > 0` koşulunun "Tümü"yü de kategori listesine bağımlı kılması.

Fix: "Tümü" çipini `categories.length > 0` koşulundan bağımsız, HER ZAMAN render et; yalnızca kategori çiplerinin listesini (`categories.map(...)`) `categories.length > 0` koşuluna bağlı bırak. Böylece kategori API'si yavaş/boş/hatalı olsa bile kullanıcı her zaman "Tümü"ye basıp filtreyi sıfırlayabilir.

Not: Bu kök neden statik kod incelemesiyle %100 kesinleştirilemedi (runtime/API davranışına bağlı) — fix uygulandıktan sonra gerçek cihazda kategori şeridinin her zaman göründüğü ve "Tümü"nün listeyi doğru filtrelediği doğrulanmalı.

**7.2 — Bölüm sayfası: başlık/takip butonu sola-üste yapışık + üst bar "Bölüm" yazıyor + kart üstü bilgiler ortasız**
Dosya: `src/screens/main/DepartmentDetailScreen.tsx`

- Satır ~112-142: `FlatList`'in `contentContainerStyle={{ paddingTop: 4, paddingBottom: TAB_BAR_SAFE_PADDING, flexGrow: 1 }}` — yatay padding (`paddingHorizontal`) YOK. Referans doğru pattern: `DepartmentsScreen.tsx:66` — `contentContainerStyle={{ padding: 16, ..., gap: 10 }}` (dört yönlü padding). Fix: `DepartmentDetailScreen.tsx`'teki `contentContainerStyle`'a `paddingHorizontal: 16` (veya `DepartmentsScreen.tsx`'teki gibi tam `padding: 16`) ekle.
- Satır ~76-94 (`header` bloğu, `<View className="pb-8">`): bölüm adı + "Takip Et/Bırak" butonunu içeren üst blokta `alignItems`/`textAlign` merkezleme yok. Fix: bu View'e `items-center` (veya ilgili elemanlara `textAlign:'center'`) ekle, yukarıdaki yatay padding fix'iyle birlikte kart genişliğiyle hizalı ve ortalı görünmesini sağla.

- `src/navigation/routeTitles.ts:12` — `DepartmentDetail: 'Bölüm'` sabit metin. `src/components/layout/AppHeader.tsx:62-66`'daki `derivedTitle` mantığı zaten `UserProfile` route'u için route param'dan (`username`) başlık türetiyor (bkz. Faz 1'de dokunulmadı, referans pattern). `DepartmentDetail` route param tipi (`src/navigation/types.ts:42`) `{ faculty: string; department: string }` — `faculty` her çağrı yerinde (DepartmentsScreen, HomeScreen, MenuDrawerContent, UserProfileScreen, ProfileScreen) zaten geçiliyor. Fix: `AppHeader.tsx`'teki `derivedTitle` mantığına `DepartmentDetail` için `activeRoute.params?.faculty` kontrolü ekle (aynı ternary desenine üçüncü bir dal olarak), `routeTitles.ts`'teki `'Bölüm'` sabitini sadece fallback olarak bırak.

Doğrulama testi: Duyurular sekmesinde "Tümü" her zaman görünmeli ve basınca listeyi sıfırlamalı; DepartmentDetail'e girince üst barda fakülte adı yazmalı; başlık/takip butonu ve PostCard'ların üstündeki bilgi bloğu kartlarla hizalı, ortalı ve kenarlardan boşluklu durmalı.

---

## Uygulama Sırası

1. expo-image kurulumu + AvatarDisplay/BadgeChip geçişi (1.1)
2. PostCard memo + çağıran taraf callback stabilizasyonu (1.3)
3. FlatList sanallaştırma ayarları, dosya dosya (1.4)
4. `enableFreeze` aktivasyonu (1.5)
5. ProfileScreen scroll handler throttle/gate + cardHeight shared value (1.2)
6. ProfileScreen screenWidth → useMetrics (2.1) — tablet kayma + flash'ın çoğunu çözer
7. PushableStack overflow davranışını gerçek cihazda yeniden ölç, gerekirse koşullu hale getir (2.2)
8. AppHeader Pressable → gesture-handler Pressable (3.1)
9. RootNavigator köşe yaması + App.tsx tema senkronu (3.2)
10. PostDetail/UserProfile `gestureEnabled: false` + AppShell pan gesture ayarları (4)
11. PostDetailScreen kaydetme ikonu konumu (5)
12. useIsOffline soğuk-başlangıç grace-period (6)
13. Duyurular "Tümü" filtresi fix'i (7.1)
14. DepartmentDetailScreen layout/padding + AppHeader fakülte adı (7.2)
15. (Ölçüm sonrası, opsiyonel) Animated.FlatList geçişi (1.6)

Madde 5-6 ve 8-9 aynı dosyalarda (ProfileScreen.tsx, RootNavigator.tsx) üst üste biniyor, sırayla yapılacak; geri kalanı bağımsız dosyalarda, paralel/ayrı PR'lar hâlinde ilerlenebilir.

## Doğrulama

- `npx tsc --noEmit` (tip kontrolü) ve varsa mevcut test suite'i çalıştır.
- Gerçek cihaz testleri gerekiyor (kod/simülatörle tam doğrulanamaz): iPhone (Dynamic Island'lı + notch'suz), Android telefon, iPad (portrait+landscape) — drawer açma/avatar tıklama, köşe rengi, uçak modunda soğuk açılış, ProfileScreen sekme geçişleri, geri kaydırma jesti, kaydetme ikonu davranışı, genel akıcılık (scroll jank), tablet flash/gri iz gözlenmeli.
- Performans için before/after karşılaştırması: React DevTools Profiler veya Flipper ile ProfileScreen'de scroll sırasında JS thread FPS/CPU kullanımı ölçülüp 1.1-1.5 sonrası iyileşme doğrulanmalı.

### Kritik Dosyalar
- `src/screens/main/ProfileScreen.tsx`
- `src/components/avatar/AvatarDisplay.tsx`
- `src/components/PostCard.tsx`
- `src/components/layout/AppHeader.tsx`
- `src/components/layout/AppShell.tsx`
- `src/components/layout/PushableStack.tsx`
- `src/navigation/RootNavigator.tsx`
- `src/navigation/drawerConstants.ts`
- `src/hooks/useIsOffline.ts`
- `src/screens/main/PostDetailScreen.tsx`
- `App.tsx`
- `src/screens/main/HomeScreen.tsx` (ve diğer FlatList ekranları, madde 1.4'te listelendi)
- `src/screens/main/NotificationsScreen.tsx`
- `src/screens/main/DepartmentDetailScreen.tsx`
- `src/navigation/routeTitles.ts`

## Durum (canlı takip)

**Faz 1 — TAMAMLANDI (5/5):** expo-image kurulumu HENÜZ YAPILMADI (bkz. not), PostCard memo ✅, kaydetme ikonu konumu ✅, avatar Pressable ✅, useIsOffline grace-period ✅, App.tsx enableFreeze+tema senkronu ✅.
Not: 1.1 (expo-image) Faz 1'e dahil edilmemişti, henüz yapılmadı — Faz 2'de ele alınacak.
**Faz 1b — TAMAMLANDI (2/2):** Duyurular "Tümü" fix'i (7.1) ✅, DepartmentDetailScreen layout+AppHeader fakülte adı (7.2) ✅.
Not (7.2 düzeltmesi): Ajanın uyguladığı `contentContainerStyle`'a `paddingHorizontal:16` eklemesi, `PostCardModern.tsx`'in kendi `marginHorizontal:12`'siyle çakışıp 28px kenar boşluğu yaratıyordu (diğer ekranlarda 12px). Elle düzeltildi: yatay padding yalnızca header View'e (`px-4` className) taşındı, `contentContainerStyle`'dan `paddingHorizontal` kaldırıldı. `npx tsc --noEmit` temiz.
**Faz 2 — TAMAMLANDI (3/3):** expo-image kurulumu + AvatarDisplay/BadgeChip geçişi (1.1) ✅, ProfileScreen screenWidth→useMetrics (2.1) ✅, RootNavigator köşe yaması (3.2) + PostDetail/UserProfile gestureEnabled:false + AppShell failOffsetY (4) ✅.
Not (kurtarma olayı): RootNavigator+AppShell görevini yapan ajan, tsc karşılaştırması için `git stash` çalıştırdı; bu, o sırada paralel çalışan diğer iki ajanın VE önceki Faz 1/1b'nin tüm commit'lenmemiş değişikliklerini de süpürdü. `git stash pop` bir çakışma yüzünden iptal oldu ve App.tsx, PostCard.tsx, AppHeader.tsx, useIsOffline.ts, DepartmentDetailScreen.tsx, NotificationsScreen.tsx, PostDetailScreen.tsx dosyalarındaki TÜM Faz 1/1b düzeltmeleri çalışma ağacından düştü (yalnızca stash'te kaldı). Ben bunu `git status` ile fark edip 7 dosyayı `git checkout stash@{0} -- <dosya>` ile tek tek geri getirdim, her fix'i grep ile yeniden doğruladım ve `npx tsc --noEmit` temiz geçti. Stash artık çalışma ağacına göre tamamen eskimiş (redundant) durumda — `git stash drop stash@{0}` otomatik onay sistemi tarafından engellendi (yıkıcı komut), kullanıcı isterse elle silebilir, zararsız duruyor.
**Faz 3a — TAMAMLANDI:** FlatList sanallaştırma 9 ekran/10 liste (1.4) ✅ — HomeScreen, SavedPostsScreen, DepartmentDetailScreen, FaqScreen, SuggestionsScreen, NoteRequestsScreen, DepartmentsScreen, NotificationsScreen (2 liste), ChecklistsScreen. Her FlatList: `renderItem` `useCallback`'e taşındı + `removeClippedSubviews`, `maxToRenderPerBatch={6}`, `windowSize={7}`, `initialNumToRender={6}` eklendi. 3 paralel ajanla (her biri bağımsız 3 dosya) yapıldı, hiçbiri `git stash` kullanmadı (önceki olay sonrası açıkça yasaklandı). Tüm diff'ler tek tek `git diff` ile doğrulandı, `npx tsc --noEmit` bütün ağaç üzerinde temiz.
**Faz 3b — TAMAMLANDI:** ProfileScreen scroll handler refactor (1.2) ✅ — üç değişiklik: (a) posts/saved sekmelerinde `runOnJS(handleScroll)` çağrısı artık worklet içinde mesafe-eşiği kontrolüyle kapılı (yalnızca liste sonuna yaklaşınca JS köprüsü tetikleniyor, her frame'de değil), `handleScroll`'un kendi JS-taraf kontrolü dokunulmadan güvenlik ağı olarak kaldı; (b) `cardHeight` artık hem `useState` (JS render/paddingTop için) hem `cardHeightShared` adlı `useSharedValue` (worklet'ler için) olarak tutuluyor, `headerAnimStyle`/`cardAnimStyle` artık state yerine shared value'dan okuyor; (c) lists/akts/schedule/follows/forums sekmelerinde `scrollEventThrottle` 16'dan 32'ye çıkarıldı (pager'ın 32'siyle tutarlı), posts/saved'de 16'da bırakıldı (eşik-gate zaten yeterli). Tek ajanla (yüksek effort, worklet/shared-value riski nedeniyle) yapıldı, `git stash` kullanılmadı. `git diff` ile doğrulandı — ajan ayrıca dosyada Faz 2'den kalma `useWindowDimensions`→`useMetrics` değişikliğini (2.1, önceden tamamlanmıştı) fark edip dokunmadan bıraktı, yanlışlıkla "beklenmedik değişiklik" diye raporladı ama ben kontrol edip bunun eski/beklenen bir fix olduğunu doğruladım. `npx tsc --noEmit` bütün ağaç üzerinde temiz.
**Faz 3c — BEKLEMEDE (cihaz ölçümü sonrası):** PushableStack overflow koşullu hale getirme (2.2).
