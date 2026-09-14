import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, type AppStateStatus } from 'react-native';

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
const STORAGE_KEY = 'diag:jsblocks:v1';

export type BlockEntry = {
  at: number;
  blockedMs: number;
  appState: AppStateStatus;
  /** Öne dönüşten kaç ms sonra yaşandı — `null` ise dönüşle ilgisiz. */
  sinceResumeMs: number | null;
};

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
    return `${fmt(e.at)}  ${e.blockedMs}ms${tag}`;
  });

  return [
    'Nottepe — JS thread takılma raporu',
    `Sürüm: 1.0.4 (vc5)`,
    `Toplam kayıt: ${entries.length} · En kötü: ${worst.blockedMs}ms · Öne dönüşe bağlı: ${resumeOnes.length}`,
    '',
    ...lines,
  ].join('\n');
}
