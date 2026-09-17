import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { AppState, type AppStateStatus } from 'react-native';
import { navigationRef } from '../navigation/navigationRef';

// GEÇİCİ TEŞHİS ALTYAPISI — iş bitince tek commit'le silinecek.
//
// Neyi ölçtüğü ve NEDEN gerektiği:
//
// "Ekranı kilitleyip açınca / başka uygulamadan dönünce alt bar 3-5 sn donuyor"
// şikayeti üç turdur yanlış teşhis aldı (freezeOnBlur, enableFreeze,
// collapsable). Sebebi, iki tamamen farklı arızanın DIŞARIDAN AYNI görünmesi:
//
//   a) JS thread'i bloke — o süre boyunca hiçbir JS çalışmıyor, dokunuş
//      işlenmiyor, state güncellenmiyor. Çözümü JS tarafında iş azaltmak.
//   b) JS iyi ama native görünüm katmanı takılı — JS çalışıyor, state
//      güncelleniyor, ama ekran tepki vermiyor (görünüm sökülüp takılıyor,
//      dokunuş hedefi kaybolmuş, ana thread meşgul). Çözümü TERS yönde.
//
// Bu ikisi ayırt edilmeden atılan her adım kumar. Nabız bunu ayırıyor:
// TICK_MS'de bir atan bir timer kuruyoruz ve her atışta beklenen süreden ne
// kadar saptığını yazıyoruz. JS bloke olursa nabız durur ve blokaj bitince
// yakalar — aradaki fazla süre tam olarak blokajın kendisidir.
//
//   · Nabızda 3-5 sn boşluk çıkarsa  → (a), sorun JavaScript tarafında
//   · Nabız düzgün atmaya devam ettiği hâlde ekran donuk kaldıysa → (b)
//
// Ayrıca "sayfalar geç açılıyor" şikayetini de yakalıyor: sekme geçişinde
// boşluk çıkarsa iki şikayetin kök sebebi aynı demektir.
export const DIAGNOSTICS_ENABLED = true;

const TICK_MS = 250;
// Bu eşiğin altı normal jitter (GC, yerleşim, zamanlayıcı hassasiyeti) —
// kaydedilseydi liste gürültüden okunmaz hâle gelirdi.
const REPORT_THRESHOLD_MS = 300;
// 40 -> 200. Eski değer ÖLÇÜMÜ SESSİZCE BOZUYORDU: 1.0.8'in ikinci turunda 61
// saniyede 39 kayıt geldi, yani tampon yaklaşık bir dakikada devriliyor. Öne
// dönüş kaydı son 40 bloktan eskiyse hiç iz bırakmadan siliniyordu ve rapordaki
// "61 sn pencere" satırı aslında kırpılmanın kendi kanıtıydı: pencere gerçek
// test süresini değil, tamponun tuttuğu kadarını gösteriyor.
const MAX_ENTRIES = 200;
// v3: ProfileScreen parçalara ayrıldı (1632 -> 496 satır; yedi sekme, başlık
// kartı ve sekme şeridi kendi `React.memo`'lu bileşenlerine çıktı, scroll
// worklet'leri artık mount'ta bir kez kuruluyor). Anahtarı yükseltmek eski
// turun kayıtlarını devre dışı bırakıyor — iki build'in verisi tek raporda
// karışsaydı A/B karşılaştırması anlamsız olurdu.
//
// KARŞILAŞTIRILACAK TABAN (v2, sürüm 1.0.6): 40 kayıt, toplam 39.744 ms /
// 322 sn pencere. Ekrana göre: Profile 23 blokaj / 24.499 ms · Home 13 /
// 12.133 ms · PostDetail 4 / 3.112 ms. Bu turda düşmesi beklenen satır
// PROFILE.
//
// v4 (sürüm 1.0.8): global `adjustsFontSizeToFit` kaldırıldı
// (applyGlobalFont.ts) + çevrimdışı kilidi ön plana bağlandı (useIsOffline.ts).
// Bu turun hipotezi ÖNCEKİLERDEN FARKLI BİR EKSENDE: blokaj JS'te iş
// yapmaktan değil, Android'e özgü senkron metin ÖLÇÜMÜNDEN geliyor. Dayanağı
// artık bir veri noktası daha var — iOS'ta (TestFlight 12) hiç kasma yok,
// oysa JS bundle'ı, render sayısı ve worklet'ler birebir aynı; demek ki
// maliyet JavaScript çalıştırmakta değil, platform katmanında.
//
// Beklenti: DÜŞMESİ gereken satırlar HOME ve PROFILE (satır başına en çok
// `numberOfLines`'lı yazı orada). Öne dönüş blokajları (`sinceResumeMs`
// dolu olanlar) ayrıca düşmeli — hem ölçüm hem unmount yolu kapandı.
// v3 (1.0.7) turunun kayıtları cihazda kalıyor ama bu anahtarla okunmuyor;
// o turun sonucu not edilmediyse karşılaştırma v2 tabanına göre yapılacak.
//
// v5 (sürüm 1.0.9): REVİZE TURU — bu tur saf performans turu DEĞİL, sekiz
// testçi revizesini içeriyor. Performans açısından üç değişiklik anlamlı:
//  1. Çevrimdışı kilidi artık ağacı unmount etmiyor, üstüne biniyor
//     (RootNavigator + useIsOffline). Öne dönüşte ağacın sıfırdan kurulma
//     yollarından biri kapandı — `sinceResumeMs` dolu blokajlar DÜŞMELİ.
//  2. Ana sayfa yüklenirken artık tam ekran değişmiyor, yalnızca liste
//     gövdesi iskelete dönüyor. HOME ilk açılışı hafifledi.
//  3. Tab bar kapsülü ve profil halkası: halkanın kalınlık değişimi avatar
//     alt ağacında yerleşim tetiklemiyor artık.
//
// ⚠️ v4 (1.0.8) turu 18 SANİYELİK bir pencereydi ve 322 sn'lik v2 tabanıyla
// oran olarak kıyaslanamaz. Profile'daki 4336 ms'lik tek blok muhtemelen
// profilin İLK AÇILIŞ maliyeti ve bu turda ona DOKUNULMADI (profil şablonu
// birleştirmesi ayrı bir iş). Yani Profile satırının düşmesi beklenmiyor;
// beklenen HOME ve öne dönüş blokajlarında.
//
// v6 (sürüm 1.1.0): İKİ HEDEFLİ TUR.
//  1. PROFILE — pager'ın sürükleme sırasındaki sayfa değişimi kaldırıldı. Bu,
//     ölçülen en büyük kalemi doğrudan hedefliyor (61 sn'de 24 blokaj /
//     16.925 ms, toplamın %64'ü). BEKLENTİ: Profile satırı belirgin düşmeli.
//     Düşmezse sebep sekme geçişi değil, kaydırma sırasında satır başına
//     SVG+metin maliyetidir ve sıradaki tek değişken `active` kapısı olur.
//  2. ÖNE DÖNÜŞ — artık ÖLÇÜLEBİLİR. Sonda her dönüşte bir satır yazıyor ve
//     rapor "Görülen öne dönüş" sayısını veriyor; tampon da 40'tan 200'e
//     çıktı, yani dönüş kaydı artık kırpılmıyor. Kullanıcı donma anında
//     "İnternet bağlantınız yok" GÖRMEDİĞİNİ teyit etti ve donma "sayfa
//     duruyor ama basılamıyor" şeklinde — yani hesaplama donması değil,
//     dokunuş yönlendirme arızası. Bu turda o maddeye KOD DEĞİŞİKLİĞİ
//     yapılmadı; amaç ilk kez gerçek veri toplamak.
//
// v7 (sürüm 1.0.15): ARAÇ İKİ YENİ ŞEY ÖLÇÜYOR, ÇÜNKÜ v6 ŞİKAYETİN YARISINI
// HİÇ GÖREMİYORDU.
//
// v6 turu iki sonuç verdi:
//  1. ÖNE DÖNÜŞ TEMİZ — 6 dönüşün 6'sında sonda hızlı (jsFree 11-136 ms). O
//     madde kapandı, bu turda beklenti "yine temiz".
//  2. Blokajların %83'ü SEKME rotalarında (27 blokaj / 12.361 ms), push edilen
//     ekranlarda yalnızca 7 blokaj / 2.591 ms. Sekmelere gitmek `navigateApp`
//     üzerinden `navigate('MainTabs', ...)`, yani stack'i `MainTabs`'a geri
//     açmak — ve `MainTabs`'ın `freezeOnBlur` override'ı yok, yani push'ta
//     donup pop'ta çözülüyor. Ama bunun ÇÖZÜLME dalgası mı, düz sekme geçişi
//     mi, yoksa sekmenin ilk mount'u mu olduğunu araç SÖYLEYEMİYOR.
//
// Üstelik testçi v6'dan sonra üçüncü bir sınıf bildirdi: "tabbar geçişinde ve
// menü aç kapalarda aşama aşama tık tık tık gidiyor, akıcı kaymıyor" ve aynısı
// akış kaydırmasında. Bu sınıf v6'da GÖRÜNMEZ: eşik 300 ms, 20 ms'lik kareler
// dizisi hiç drift üretmiyor. Üç turdur JS tarafında aranan şeyin neden hiç
// bulunamadığı da bu.
//
// Bu yüzden v7'de:
//  · MINOR_THRESHOLD_MS — 120-300 ms bandındaki tick'ler SAYILIYOR (listeye
//    girmiyor, gürültü olurdu). Eşik altı takılmanın ilk kez bir sayısı var.
//  · Düşen kare sayacı — `requestAnimationFrame` aralıkları ölçülüyor.
//    ⚠️ THREAD ATFI YAPMIYOR (bkz. yukarıdaki sonda uyarısı, aynı gerekçe).
//    Verdiği şey şu: "kötü kare çok ama JS blokajı yok" tablosu JS'te iş
//    yapmaktan DEĞİL, çizim/kompozisyon tarafından geldiğini gösterir — ki
//    1.0.15'teki düzeltmeler (PushableStack'te kare başına clipPath,
//    HomeScreen'de kare başına çocuk dolaşması) tam o tarafı hedefliyor.
//  · Gezinme etiketi — her blokaj, içinde geçen gezinme olayıyla (push / pop /
//    sekme) işaretleniyor. %83 sorusunu ayıran şey bu.
//  · Mount/render sayaçları — blokaj penceresinde hangi bileşenlerin kaç kez
//    render edildiği. `MainTabs` + `Home` + `Profile` birlikte artıyorsa
//    çözülme dalgası KANITLANMIŞ olur; yalnız `MainTabs` artıyorsa memo tutuyor
//    ve sebep başka yerde.
//
// BEKLENTİ (düşmesi gerekenler): bütün sekme satırları — avatar düğüm sayısı
// 25-53'ten ~8-12'ye indi (bkz. avatarPack.ts) ve avatar bu yolların hepsinde
// var. Kötü kare oranı da menü aç/kapada ve kaydırmada düşmeli.
const STORAGE_KEY = 'diag:jsblocks:v7';

// 300 ms listeye girme eşiği; bu ise "eşik altı ama normal jitter de değil"
// bandının tabanı. 120 ms ~7 kare demek, yani kullanıcının fark ettiği ama
// v6'nın hiç saymadığı büyüklük.
const MINOR_THRESHOLD_MS = 120;

// Bir karenin "kötü" sayılma eşiği. 60 Hz'de kare bütçesi 16,7 ms; 24 ms
// yaklaşık 1,5 kare, yani en az bir kare atlanmış demektir. Daha sıkı bir eşik
// (ör. 18 ms) normal zamanlayıcı hassasiyetini de kötü sayıp raporu şişirirdi.
const BAD_FRAME_MS = 24;

export type BlockEntry = {
  at: number;
  blockedMs: number;
  appState: AppStateStatus;
  /** Öne dönüşten kaç ms sonra yaşandı — `null` ise dönüşle ilgisiz. */
  sinceResumeMs: number | null;
  /**
   * Blokaj anındaki ekran. İlk tur ölçüm "JS bloke oluyor"u kanıtladı ama
   * NEREDE olduğunu söylemiyordu; rota olmadan 19 blokajın hepsi isimsiz bir
   * yığın. Bu alan "blokajlar hep Profil'e girerken" gibi bir örüntüyü tek
   * bakışta görünür kılıyor.
   */
  route: string | null;
  /**
   * Arka plandan dönüşten SONRAKİ İLK tick mi? Bu kayıtlar ŞÜPHELİ: Android
   * arka planda zamanlayıcıları kısıtladığı için askıda geçen süre sahte bir
   * blokaj olarak görünebiliyor. Atmak yerine İŞARETLİYORUZ — atmak gerçek bir
   * öne-dönüş blokajını da silerdi (2,5 sn'lik tek bir blokaj tek bir tick'te
   * görünür). Raporu okuyan kişi bu satırları ayrı değerlendirsin.
   */
  afterBackground: boolean;
  /**
   * Blokaj penceresinde geçen gezinme olayı — `push:Help`, `pop:Tools`,
   * `sekme:Profile` gibi; yoksa `null`.
   *
   * v6'nın CEVAPLAYAMADIĞI soru buydu. Blokajın rotası (`route`) yalnızca
   * "nerede bitti"yi söylüyor: `Tools` yazan bir blokaj hem düz bir sekme
   * geçişi hem de push edilmiş bir ekrandan `MainTabs`'a dönüş olabilir, ve
   * ikisinin maliyeti bambaşka (ikincisi `MainTabs`'ın çözülme dalgasını
   * tetikliyor). Etiket olmadan %83'lük sekme yığını tek bir isimsiz kümeydi.
   */
  nav: string | null;
  /**
   * Blokaj penceresinde hangi bileşen kaç kez render edildi (bkz. `diagMark`).
   * Sayaçların FARKI yazılıyor, toplamı değil — yani doğrudan "bu blokajın
   * içinde ne oldu".
   *
   * Ayırt ettiği şey şu: `MainTabs` + `Home` + `Profile` BİRLİKTE artmışsa
   * sekme ekranları hep birlikte yeniden render ediliyor (çözülme dalgası
   * kanıtlanmış olur); yalnızca `MainTabs` artmışsa aradaki memo tutuyor ve
   * sebebi başka yerde aramak gerekiyor.
   */
  marks: Record<string, number> | null;
};

/**
 * ÖNE DÖNÜŞ SONDASI — aracın en önemli eklentisi.
 *
 * Nabız yalnızca JS thread'ini ölçüyor ve bu bir KÖR NOKTA: dosyanın başındaki
 * (b) durumunda (JS iyi, native görünüm katmanı takılı) nabız düzgün atmaya
 * devam eder, hiç kayıt oluşmaz ve rapor "öne dönüşe bağlı: 0" der. Kullanıcı
 * ekranın 2-3 saniye tepkisiz kaldığını bildirirken raporun sıfır göstermesinin
 * sebebi tam olarak buydu — yani "0" (b)'yi ÇÜRÜTMÜYOR, tarif ediyor.
 *
 * Sonda dönüş anında iki ayrı saat başlatıyor:
 *   · `jsFreeMs`     — `setTimeout(0)` ne zaman çalıştı
 *   · `firstFrameMs` — `requestAnimationFrame` ne zaman çalıştı
 *
 * ⚠️ BU İKİSİ THREAD ATFI İÇİN KULLANILMIYOR. İlk tasarımda "setTimeout JS'i,
 * rAF native'i ölçer, aradaki fark (a) ile (b)'yi ayırır" diye yazılmıştı;
 * Android'de bu GARANTİ DEĞİL: `JavaTimerManager` timer'ları Choreographer
 * kare geri-çağrısından (yani UI thread'inden) dağıtabiliyor, Yeni Mimari'de
 * ise `RuntimeScheduler` yolu var ve hangisinin aktif olduğu kesinleşmedi.
 * İkisi de aynı kapıdan geçiyorsa fark bir şey söylemez.
 *
 * Sondanın GÜVENİLİR iki çıktısı şunlar ve zaten ihtiyacımız olan bunlardı:
 *   1. Dönüş GÖRÜLDÜ mü (rapordaki "Görülen öne dönüş" sayacı) — eski rapor
 *      "öne dönüşe bağlı: 0" derken "sorun yok" ile "hiç dönüş örneklenmedi"yi
 *      aynı gösteriyordu ve iki turdur o sıfırı yanlış okuma riskiyle yorumladık.
 *   2. Dönüşten kaç ms sonra uygulama tepki verebildi (ikisinin büyüğü).
 */
export type ResumeProbe = {
  at: number;
  jsFreeMs: number | null;
  firstFrameMs: number | null;
  route: string | null;
};

function currentRoute(): string | null {
  try {
    return navigationRef.isReady() ? navigationRef.getCurrentRoute()?.name ?? null : null;
  } catch {
    // Ölçüm aracı, ölçtüğü uygulamayı asla düşürmemeli.
    return null;
  }
}

// ——— SAYAÇLAR (v7) ———
//
// Hepsi bellekte ve ucuz: `diagMark` sadece bir sayı artırıyor. Blokaj
// kaydedilirken son tick'ten bu yana olan FARK alınıp kayda yazılıyor, yani
// "blokajın içinde ne oldu" doğrudan okunabiliyor. Her mark'ın zaman damgasını
// tutmak da bir seçenekti ama akış kaydırmasında avatar mount'ları binlerce
// kayıt üretirdi.
const markCounts: Record<string, number> = {};
let marksAtLastTick: Record<string, number> = {};

/**
 * Bir bileşenin render/mount sayacını artırır. Render gövdesinden çağrılıyor
 * (efekt değil): efekt bir tur daha maliyet eklerdi ve bizi ilgilendiren şey
 * zaten ağacın kurulması.
 *
 * ⚠️ GEÇİCİ. `DIAGNOSTICS_ENABLED` ile birlikte tek commit'te silinecek —
 * çağrı yerleri: AvatarSVG, MainTabsScreen, HomeScreen, ProfileScreen.
 */
export function diagMark(name: string): void {
  if (!DIAGNOSTICS_ENABLED) return;
  markCounts[name] = (markCounts[name] ?? 0) + 1;
}

// Son gezinme olayı ve zamanı. Blokaj penceresine düşüyorsa kayda ekleniyor.
let lastNav: string | null = null;
let lastNavAt = 0;
let lastNavDepth: number | null = null;

// Ana stack'in derinliği. Ağaç Drawer → Stack → MainTabs → Tab şeklinde iç
// içe; aradığımız navigator `MainTabs`'ı ÇOCUK olarak taşıyan, yani ana stack.
// Onun route sayısı = kaç ekran push edilmiş.
function stackDepth(state: any): number {
  if (!state?.routes) return 0;
  if (state.routes.some((r: any) => r?.name === 'MainTabs')) return state.routes.length;
  const focused = state.routes[state.index ?? 0];
  return focused?.state ? stackDepth(focused.state) : 0;
}

/**
 * `NavigationContainer`'ın `onStateChange`'inden çağrılıyor (bkz. App.tsx).
 * Olayı push / pop / sekme olarak SINIFLANDIRIYOR — bu turun asıl aradığı ayrım.
 *
 * Sınıflandırma stack DERİNLİĞİNDEN yapılıyor, rota adından değil: sekmeler iç
 * içe bir navigator'da ve üstten bakıldığında odaklı route hep `MainTabs`
 * çıkıyor (bkz. AppHeader.tsx'teki `derivedTitle` notu). Derinlik arttıysa push,
 * azaldıysa pop (yani `MainTabs`'a dönüş — çözülme yolu), aynı kaldıysa sekme
 * geçişi ya da parametre değişimi.
 */
export function recordNavigation(state: unknown): void {
  if (!DIAGNOSTICS_ENABLED) return;
  const depth = stackDepth(state);
  const prev = lastNavDepth;
  lastNavDepth = depth;
  if (prev === null) return; // ilk state, karşılaştırılacak bir şey yok
  const kind = depth > prev ? 'push' : depth < prev ? 'pop' : 'sekme';
  lastNav = `${kind}:${currentRoute() ?? '?'}`;
  lastNavAt = Date.now();
}

// ——— KARE ÖLÇÜMÜ (v7) ———
//
// `requestAnimationFrame` aralıkları. ⚠️ Bu sayaç THREAD ATFI YAPMIYOR: Android'de
// rAF'in hangi kapıdan beslendiği garanti değil (bkz. sonda uyarısı). Verdiği
// şey eksik olan tek şey — eşik altı takılmanın SAYISI.
//
// Gözlemci etkisi kabul edildi: kare başına bir closure + bir çıkarma. Ölçtüğü
// şeye göre ihmal edilebilir, ama araç geçici olduğu için yine de not ediliyor.
// Arka planda çalışmıyor (rAF zaten durur), sayaç da o sürede ilerlemiyor.
let frameTotal = 0;
let frameBad = 0;
let frameWorstMs = 0;

export function getFrameStats() {
  return { total: frameTotal, bad: frameBad, worstMs: frameWorstMs };
}

let entries: BlockEntry[] = [];
let probes: ResumeProbe[] = [];
// 120-300 ms bandındaki tick sayısı — listeye girmiyor, yalnızca sayılıyor.
let minorCount = 0;
const listeners = new Set<() => void>();
let lastResumeAt: number | null = null;
let started = false;
// Arka plana alındı mı? Bir sonraki tick'i şüpheli işaretlemek için (bkz.
// BlockEntry.afterBackground). Tick geri çağrısı AppState dinleyicisinden ÖNCE
// de çalışabildiği için bayrağı 'active' olayında değil, tick'te temizliyoruz.
let wasBackgrounded = false;
const PROBE_KEY = `${STORAGE_KEY}:resume`;
const MAX_PROBES = 20;

function emit() {
  listeners.forEach((l) => l());
}

function persist() {
  AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(entries)).catch(() => {
    // Teşhis verisi — yazılamazsa sessizce geçiyoruz, bellekteki liste yeterli.
  });
}

function record(blockedMs: number, afterBackground: boolean) {
  const at = Date.now();
  // Blokaj penceresi: tick'in beklenen anından şimdiye kadar. Bu aralığa düşen
  // gezinme olayı ve bu aralıkta artan sayaçlar kayda ekleniyor — "blokajın
  // içinde ne oldu" sorusunun cevabı.
  const windowStart = at - blockedMs - TICK_MS;

  const marks: Record<string, number> = {};
  for (const key of Object.keys(markCounts)) {
    const delta = markCounts[key] - (marksAtLastTick[key] ?? 0);
    if (delta > 0) marks[key] = delta;
  }

  entries = [
    {
      at,
      blockedMs,
      appState: AppState.currentState,
      // Dönüşten sonraki ilk 10 sn içindeyse dönüşle ilişkilendiriyoruz.
      sinceResumeMs: lastResumeAt !== null && at - lastResumeAt < 10_000 ? at - lastResumeAt : null,
      route: currentRoute(),
      afterBackground,
      nav: lastNav !== null && lastNavAt >= windowStart ? lastNav : null,
      marks: Object.keys(marks).length > 0 ? marks : null,
    },
    ...entries,
  ].slice(0, MAX_ENTRIES);
  persist();
  emit();
}

// Sondayı başlatır (bkz. ResumeProbe). İki ölçüm ayrı ayrı gelebildiği için
// kayıt önce `null`larla ekleniyor, sonra yerinde güncelleniyor.
function startResumeProbe() {
  const at = Date.now();
  const probe: ResumeProbe = { at, jsFreeMs: null, firstFrameMs: null, route: currentRoute() };
  probes = [probe, ...probes].slice(0, MAX_PROBES);

  const update = (patch: Partial<ResumeProbe>) => {
    // Nesneyi yerinde güncelliyoruz: liste başında duruyor ve kimlik değişmesi
    // gerekmiyor (rapor her okumada yeniden üretiliyor).
    Object.assign(probe, patch);
    AsyncStorage.setItem(PROBE_KEY, JSON.stringify(probes)).catch(() => {});
    emit();
  };

  setTimeout(() => update({ jsFreeMs: Date.now() - at }), 0);
  requestAnimationFrame(() => update({ firstFrameMs: Date.now() - at }));
}

export function startDiagnostics(): () => void {
  if (started) return () => {};
  started = true;

  AsyncStorage.getItem(STORAGE_KEY)
    .then((raw) => {
      if (!raw) return;
      const parsed = JSON.parse(raw) as BlockEntry[];
      // Yeniden açılışta eski kayıtlar korunuyor: testçi uygulamayı kapatsa bile
      // önceki turun ölçümleri kaybolmasın.
      entries = [...entries, ...parsed].slice(0, MAX_ENTRIES);
      emit();
    })
    .catch(() => {});

  AsyncStorage.getItem(PROBE_KEY)
    .then((raw) => {
      if (!raw) return;
      probes = [...probes, ...(JSON.parse(raw) as ResumeProbe[])].slice(0, MAX_PROBES);
      emit();
    })
    .catch(() => {});

  let last = Date.now();
  const tick = setInterval(() => {
    const now = Date.now();
    const drift = now - last - TICK_MS;
    last = now;
    // Bayrak BURADA temizleniyor, AppState dinleyicisinde değil: iki geri
    // çağrının sırası garanti değil ve tick önce çalışırsa askıda geçen süre
    // işaretsiz bir "blokaj" olarak yazılıyordu (üstelik `lastResumeAt` henüz
    // set edilmediği için `sinceResumeMs` de `null` çıkıyordu — yani hem sahte
    // kayıt ekliyor hem "öne dönüşe bağlı" sayısını düşük gösteriyordu).
    const suspicious = wasBackgrounded;
    wasBackgrounded = false;
    if (drift >= REPORT_THRESHOLD_MS) record(drift, suspicious);
    // 120-300 ms bandı: listeye girmeyecek kadar küçük ama normal jitter de
    // değil. v6 bunu hiç saymıyordu, dolayısıyla testçinin tarif ettiği küçük
    // takılmalar raporda hiç görünmüyordu.
    else if (drift >= MINOR_THRESHOLD_MS && !suspicious) minorCount += 1;

    // Sayaç referansı HER tick'te güncelleniyor (blokaj olsun olmasın): kayda
    // yazılan fark böylece yalnızca o tick aralığını kapsıyor.
    marksAtLastTick = { ...markCounts };
  }, TICK_MS);

  // Kare ölçümü. `rafId` temizlik için tutuluyor; döngü kendini yeniden
  // planlıyor ve arka planda rAF zaten durduğu için orada sayaç ilerlemiyor.
  let rafId: number | null = null;
  let lastFrameAt = Date.now();
  const onFrame = () => {
    const now = Date.now();
    const delta = now - lastFrameAt;
    lastFrameAt = now;
    // İlk kare ve öne dönüşteki ilk kare atlanıyor: arada askıda geçen süre
    // "kötü kare" değil (aynı gerekçe nabzın `last` sıfırlamasında da var).
    if (delta < 2000) {
      frameTotal += 1;
      if (delta >= BAD_FRAME_MS) {
        frameBad += 1;
        if (delta > frameWorstMs) frameWorstMs = delta;
      }
    }
    rafId = requestAnimationFrame(onFrame);
  };
  rafId = requestAnimationFrame(onFrame);

  const sub = AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      lastResumeAt = Date.now();
      // Nabzın referansını da sıfırlıyoruz: arka planda Android zamanlayıcıları
      // kısıtlıyor, o yapay boşluk blokaj sanılmasın.
      last = Date.now();
      // Kare ölçümünün referansı da aynı sebeple sıfırlanıyor.
      lastFrameAt = Date.now();
      // Asıl ölçüm: JS thread'i mi takılı, native katman mı (bkz. ResumeProbe).
      startResumeProbe();
      emit();
    } else {
      wasBackgrounded = true;
    }
  });

  return () => {
    clearInterval(tick);
    if (rafId !== null) cancelAnimationFrame(rafId);
    sub.remove();
    started = false;
  };
}

export function subscribeDiagnostics(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getEntries(): BlockEntry[] {
  return entries;
}

export function clearDiagnostics() {
  entries = [];
  probes = [];
  minorCount = 0;
  frameTotal = 0;
  frameBad = 0;
  frameWorstMs = 0;
  persist();
  AsyncStorage.setItem(PROBE_KEY, JSON.stringify(probes)).catch(() => {});
  emit();
}

// Kare ve eşik altı satırları HER ZAMAN yazılıyor, blokaj hiç olmasa bile.
// Sebebi bu turun hikâyesi: testçinin tarif ettiği "tık tık tık" tam olarak
// "blokaj yok ama kareler kötü" tablosu, ve v6'da o tablo boş bir rapor gibi
// görünüyordu.
function frameSection(): string[] {
  if (frameTotal === 0) return ['Kare ölçümü: henüz kayıt yok.'];
  const pct = ((frameBad / frameTotal) * 100).toFixed(1);
  return [
    `Kare: ${frameTotal} ölçüldü · kötü (${BAD_FRAME_MS}ms+) ${frameBad} (%${pct}) · en kötü ${frameWorstMs}ms`,
    `Eşik altı takılma (${MINOR_THRESHOLD_MS}-${REPORT_THRESHOLD_MS}ms): ${minorCount} tick`,
    // ⚠️ Bu iki satır THREAD ATFI YAPMIYOR (bkz. dosya başındaki v7 notu).
    // Okuma kılavuzu: kötü kare oranı yüksek ama aşağıda blokaj listesi
    // kısaysa, maliyet JS'te iş yapmaktan değil çizim/kompozisyon tarafından
    // geliyor demektir.
  ];
}

export function formatReport(): string {
  const fmt = (ms: number) => new Date(ms).toLocaleTimeString('tr-TR');

  // ÖNE DÖNÜŞ BÖLÜMÜ HER ZAMAN ÖNCE ve blokaj hiç olmasa bile yazılıyor.
  // Sebebi doğrudan bu projenin hikâyesi: kullanıcı öne dönüşte donma
  // bildirirken rapor "öne dönüşe bağlı: 0" diyordu ve bu, sorunun yokluğu
  // sanılıyordu — oysa nabzın göremediği (b) durumunun imzasıydı.
  const probeSection =
    probes.length === 0
      ? ['Öne dönüş sondası: henüz kayıt yok (uygulamayı arka plana alıp geri dön).']
      : [
          'ÖNE DÖNÜŞ SONDASI (jsFree = JS thread serbest, frame = ilk kare çizildi):',
          ...probes.map((p) => {
            const js = p.jsFreeMs === null ? '?' : `${p.jsFreeMs}ms`;
            const fr = p.firstFrameMs === null ? '?' : `${p.firstFrameMs}ms`;
            // Teşhisin özeti tek kelimeye indiriliyor ki raporu okuyan kişi
            // sayıları yorumlamak zorunda kalmasın.
            // ⚠️ ETİKETLER THREAD ATFI YAPMIYOR, bilerek. Android'de RN
            // zamanlayıcıları `JavaTimerManager` üzerinden Choreographer'dan
            // (UI thread) beslenebiliyor; Yeni Mimari'de `RuntimeScheduler`
            // yolu da var ve hangisinin aktif olduğu kesinleşmedi. Yani
            // "setTimeout JS'i, rAF native'i ölçer" ayrımı GARANTİ DEĞİL.
            // Sondanın güvenilir çıktısı şu ikisi: dönüş GÖRÜLDÜ mü, ve
            // dönüşten kaç ms sonra uygulama tepki verebildi.
            let verdict = '';
            if (p.jsFreeMs !== null && p.firstFrameMs !== null) {
              const worst = Math.max(p.jsFreeMs, p.firstFrameMs);
              if (worst < 400) verdict = ' → dönüş hızlı';
              else if (worst < 1200) verdict = ` → ${worst}ms GECİKME`;
              else verdict = ` → ${worst}ms DONMA`;
            }
            return `  ${fmt(p.at)}  jsFree ${js} · frame ${fr}  ${p.route ?? '?'}${verdict}`;
          }),
        ];

  if (entries.length === 0) {
    return [
      'Nottepe — JS thread takılma raporu',
      `Sürüm: ${Constants.expoConfig?.version ?? '?'} (vc${Constants.expoConfig?.android?.versionCode ?? '?'})`,
      'Hiç JS blokajı kaydedilmedi.',
      '',
      ...frameSection(),
      '',
      ...probeSection,
    ].join('\n');
  }
  const resumeOnes = entries.filter((e) => e.sinceResumeMs !== null);
  const worst = entries.reduce((a, b) => (b.blockedMs > a.blockedMs ? b : a));

  const lines = entries.map((e) => {
    const tag = e.sinceResumeMs !== null ? ` [öne dönüşten ${e.sinceResumeMs}ms sonra]` : '';
    // Şüpheli kayıtlar işaretli: arka plandan dönüşteki ilk tick, askıda geçen
    // süreyi blokaj gibi gösterebiliyor (bkz. BlockEntry.afterBackground).
    const susp = e.afterBackground ? ' [ŞÜPHELİ: arka plandan sonraki ilk tick]' : '';
    // Gezinme etiketi ve sayaçlar (v7): blokajın İÇİNDE ne olduğunu söylüyor.
    const nav = e.nav ? ` ⟨${e.nav}⟩` : '';
    const marks = e.marks
      ? ` {${Object.entries(e.marks)
          .sort((a, b) => b[1] - a[1])
          .map(([k, v]) => `${k}×${v}`)
          .join(' ')}}`
      : '';
    return `${fmt(e.at)}  ${e.blockedMs}ms  ${e.route ?? '?'}${nav}${marks}${tag}${susp}`;
  });

  // Rota kırılımı: asıl aranan cevap "hangi ekran" olduğu için ham listenin
  // üstünde özet duruyor — raporu okuyan kişinin 40 satırı elle toplaması
  // gerekmesin.
  const byRoute = new Map<string, { count: number; total: number }>();
  entries.forEach((e) => {
    const key = e.route ?? '?';
    const cur = byRoute.get(key) ?? { count: 0, total: 0 };
    byRoute.set(key, { count: cur.count + 1, total: cur.total + e.blockedMs });
  });
  const routeLines = [...byRoute.entries()]
    .sort((a, b) => b[1].total - a[1].total)
    .map(([route, s]) => `  ${route}: ${s.count} blokaj, toplam ${s.total}ms`);

  // GEZİNME TÜRÜNE GÖRE KIRILIM — bu turun asıl sorusu.
  //
  // v6'da blokajların %83'ü sekme rotalarındaydı ama sekmeye gitmenin İKİ yolu
  // var: düz sekme geçişi, ya da push edilmiş bir ekrandan `MainTabs`'a dönüş
  // (pop). İkincisi `MainTabs`'ın çözülmesini tetikliyor. Rota adı ikisini
  // ayırmıyor, bu kırılım ayırıyor.
  const byNav = new Map<string, { count: number; total: number }>();
  entries.forEach((e) => {
    const key = e.nav?.split(':')[0] ?? 'etiketsiz';
    const cur = byNav.get(key) ?? { count: 0, total: 0 };
    byNav.set(key, { count: cur.count + 1, total: cur.total + e.blockedMs });
  });
  const navLines = [...byNav.entries()]
    .sort((a, b) => b[1].total - a[1].total)
    .map(([kind, s]) => `  ${kind}: ${s.count} blokaj, toplam ${s.total}ms`);

  const totalBlocked = entries.reduce((sum, e) => sum + e.blockedMs, 0);
  const span = entries[0].at - entries[entries.length - 1].at;
  const suspiciousCount = entries.filter((e) => e.afterBackground).length;

  return [
    'Nottepe — JS thread takılma raporu',
    // Sürüm elle yazılmıyor: rapor hangi build'den geldiğini yanlış söylerse
    // ölçümün bütün değeri gider.
    `Sürüm: ${Constants.expoConfig?.version ?? '?'} (vc${Constants.expoConfig?.android?.versionCode ?? '?'})`,
    // "Görülen öne dönüş" SAYISI kritik: eski rapor yalnızca "öne dönüşe bağlı:
    // 0" diyordu ve bu iki bambaşka durumu aynı gösteriyordu — "dönüşte sorun
    // yok" ile "test sırasında hiç dönüş olmadı". İki turdur o sıfırı sorunun
    // yokluğu sanma riskiyle okuduk.
    `Toplam kayıt: ${entries.length} · En kötü: ${worst.blockedMs}ms`,
    `Görülen öne dönüş: ${probes.length} · Bunlara bağlı blokaj: ${resumeOnes.length}`,
    `Toplam blokaj: ${totalBlocked}ms${span > 0 ? ` / ${Math.round(span / 1000)}sn pencere` : ''}`,
    // `null` = satır hiç yazılmasın. Boş string KULLANILMIYOR çünkü boş
    // stringler bilerek konmuş ayırıcı satırlar ve onları da elerdi.
    suspiciousCount > 0 ? `Şüpheli kayıt: ${suspiciousCount} (arka plandan sonraki ilk tick)` : null,
    '',
    ...frameSection(),
    '',
    ...probeSection,
    '',
    'Ekrana göre:',
    ...routeLines,
    '',
    'Gezinme türüne göre:',
    ...navLines,
    '',
    // Satır biçimi: saat · süre · ekran ⟨gezinme⟩ {sayaçlar} [öne dönüş] [şüpheli]
    ...lines,
  ]
    .filter((l): l is string => l !== null)
    .join('\n');
}
