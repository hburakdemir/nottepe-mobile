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
const MAX_ENTRIES = 40;
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
const STORAGE_KEY = 'diag:jsblocks:v5';

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
 *   · `jsFreeMs`     — `setTimeout(0)` ne zaman çalıştı. JS thread'i ölçer;
 *                      kare üretimine ihtiyaç duymaz.
 *   · `firstFrameMs` — `requestAnimationFrame` ne zaman çalıştı. RN'de kare
 *                      geri çağrıları Android'de Choreographer'dan, yani UI
 *                      THREAD'inden besleniyor: UI thread takılıysa kare
 *                      üretilmez ve bu süre uzar.
 *
 * Okuma:
 *   ikisi de küçük            → dönüşte sorun yok
 *   ikisi de büyük            → (a) JS thread bloke
 *   jsFree küçük, frame büyük → (b) NATIVE KATMAN TAKILI ← aradığımız imza
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

let entries: BlockEntry[] = [];
let probes: ResumeProbe[] = [];
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
  entries = [
    {
      at,
      blockedMs,
      appState: AppState.currentState,
      // Dönüşten sonraki ilk 10 sn içindeyse dönüşle ilişkilendiriyoruz.
      sinceResumeMs: lastResumeAt !== null && at - lastResumeAt < 10_000 ? at - lastResumeAt : null,
      route: currentRoute(),
      afterBackground,
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
  }, TICK_MS);

  const sub = AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      lastResumeAt = Date.now();
      // Nabzın referansını da sıfırlıyoruz: arka planda Android zamanlayıcıları
      // kısıtlıyor, o yapay boşluk blokaj sanılmasın.
      last = Date.now();
      // Asıl ölçüm: JS thread'i mi takılı, native katman mı (bkz. ResumeProbe).
      startResumeProbe();
      emit();
    } else {
      wasBackgrounded = true;
    }
  });

  return () => {
    clearInterval(tick);
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
  persist();
  AsyncStorage.setItem(PROBE_KEY, JSON.stringify(probes)).catch(() => {});
  emit();
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
            let verdict = '';
            if (p.jsFreeMs !== null && p.firstFrameMs !== null) {
              if (p.firstFrameMs < 400 && p.jsFreeMs < 400) verdict = ' → sorun yok';
              else if (p.jsFreeMs >= 400 && p.firstFrameMs >= 400) verdict = ' → JS THREAD BLOKE (a)';
              else if (p.firstFrameMs >= 400) verdict = ' → NATIVE KATMAN TAKILI (b)';
              else verdict = ' → karışık';
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
    return `${fmt(e.at)}  ${e.blockedMs}ms  ${e.route ?? '?'}${tag}${susp}`;
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

  const totalBlocked = entries.reduce((sum, e) => sum + e.blockedMs, 0);
  const span = entries[0].at - entries[entries.length - 1].at;
  const suspiciousCount = entries.filter((e) => e.afterBackground).length;

  return [
    'Nottepe — JS thread takılma raporu',
    // Sürüm elle yazılmıyor: rapor hangi build'den geldiğini yanlış söylerse
    // ölçümün bütün değeri gider.
    `Sürüm: ${Constants.expoConfig?.version ?? '?'} (vc${Constants.expoConfig?.android?.versionCode ?? '?'})`,
    `Toplam kayıt: ${entries.length} · En kötü: ${worst.blockedMs}ms · Öne dönüşe bağlı: ${resumeOnes.length}`,
    `Toplam blokaj: ${totalBlocked}ms${span > 0 ? ` / ${Math.round(span / 1000)}sn pencere` : ''}`,
    // `null` = satır hiç yazılmasın. Boş string KULLANILMIYOR çünkü boş
    // stringler bilerek konmuş ayırıcı satırlar ve onları da elerdi.
    suspiciousCount > 0 ? `Şüpheli kayıt: ${suspiciousCount} (arka plandan sonraki ilk tick)` : null,
    '',
    ...probeSection,
    '',
    'Ekrana göre:',
    ...routeLines,
    '',
    ...lines,
  ]
    .filter((l): l is string => l !== null)
    .join('\n');
}
