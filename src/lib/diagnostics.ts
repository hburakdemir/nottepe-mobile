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
const STORAGE_KEY = 'diag:jsblocks:v4';

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
const listeners = new Set<() => void>();
let lastResumeAt: number | null = null;
let started = false;

function emit() {
  listeners.forEach((l) => l());
}

function persist() {
  AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(entries)).catch(() => {
    // Teşhis verisi — yazılamazsa sessizce geçiyoruz, bellekteki liste yeterli.
  });
}

function record(blockedMs: number) {
  const at = Date.now();
  entries = [
    {
      at,
      blockedMs,
      appState: AppState.currentState,
      // Dönüşten sonraki ilk 10 sn içindeyse dönüşle ilişkilendiriyoruz.
      sinceResumeMs: lastResumeAt !== null && at - lastResumeAt < 10_000 ? at - lastResumeAt : null,
      route: currentRoute(),
    },
    ...entries,
  ].slice(0, MAX_ENTRIES);
  persist();
  emit();
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

  let last = Date.now();
  const tick = setInterval(() => {
    const now = Date.now();
    const drift = now - last - TICK_MS;
    last = now;
    if (drift >= REPORT_THRESHOLD_MS) record(drift);
  }, TICK_MS);

  const sub = AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      lastResumeAt = Date.now();
      // Nabzın referansını da sıfırlıyoruz: arka planda Android zamanlayıcıları
      // kısıtlıyor, o yapay boşluk blokaj sanılmasın.
      last = Date.now();
      emit();
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
  persist();
  emit();
}

export function formatReport(): string {
  if (entries.length === 0) return 'Nottepe teşhis: hiç takılma kaydedilmedi.';

  const fmt = (ms: number) => new Date(ms).toLocaleTimeString('tr-TR');
  const resumeOnes = entries.filter((e) => e.sinceResumeMs !== null);
  const worst = entries.reduce((a, b) => (b.blockedMs > a.blockedMs ? b : a));

  const lines = entries.map((e) => {
    const tag = e.sinceResumeMs !== null ? ` [öne dönüşten ${e.sinceResumeMs}ms sonra]` : '';
    return `${fmt(e.at)}  ${e.blockedMs}ms  ${e.route ?? '?'}${tag}`;
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

  return [
    'Nottepe — JS thread takılma raporu',
    // Sürüm elle yazılmıyor: rapor hangi build'den geldiğini yanlış söylerse
    // ölçümün bütün değeri gider.
    `Sürüm: ${Constants.expoConfig?.version ?? '?'} (vc${Constants.expoConfig?.android?.versionCode ?? '?'})`,
    `Toplam kayıt: ${entries.length} · En kötü: ${worst.blockedMs}ms · Öne dönüşe bağlı: ${resumeOnes.length}`,
    `Toplam blokaj: ${totalBlocked}ms${span > 0 ? ` / ${Math.round(span / 1000)}sn pencere` : ''}`,
    '',
    'Ekrana göre:',
    ...routeLines,
    '',
    ...lines,
  ].join('\n');
}
