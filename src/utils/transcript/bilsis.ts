// BİLSİS "Not Durum Belgesi (Transkript)" PDF'inden ders listesi çıkarır.
//
// GİRDİ pdf.js'in metin parçaları, satır satır ve soldan sağa sıralı (bkz.
// PdfDom `mode="text"`). PDF bu cihazda okunuyor ve buradan yalnızca ders
// kodu, adı, AKTS'si ve harf notu çıkıyor — belgedeki ad, öğrenci numarası ve
// TC kimlik numarası HİÇ okunmuyor, hiçbir yere gönderilmiyor.
//
// Belgenin yapısı (Hacettepe BİLSİS, 2026):
//
//   2025-2026 Güz                                   ← dönem başlığı
//   Ders Kodu | Ders Adı | Eşd/Yrn | Ders Durumu | Kredi | AKTS | Puan | Harf Notu
//   ECO135 | İKTİSADA GİRİŞ I | [Tkr] | 3 | 5 | 0 | F2  ← ders satırı
//   ANO / AGNO ...                                  ← dönem özeti, atlanıyor
//
// Ders satırı SONDAN okunuyor: son dört parça sırayla kredi, AKTS, puan, harf.
// Sütun başlıklarının x konumuna göre eşleştirme YAPILMIYOR — sayılar sağa
// yaslı ve bir puan kendi başlığının solunda kalabiliyor (ör. "11,25" 501'de,
// "Puan" başlığı 504'te).

import { isValidGrade } from '../gano';

export interface TextItem {
  x: number;
  s: string;
}

export interface TextRow {
  page: number;
  items: TextItem[];
}

export interface TranscriptCourse {
  code: string;
  lessonName: string;
  semester: number;
  akts: number;
  grade: string;
}

export interface TranscriptSkip {
  code: string;
  lessonName: string;
  reason: string;
}

export interface TranscriptParseResult {
  courses: TranscriptCourse[];
  skipped: TranscriptSkip[];
  /** Belgede tanınan dönem sayısı — sıfırsa bu bir BİLSİS transkripti değil. */
  termCount: number;
}

// Hacettepe ders kodları: 2-5 harf + 3 rakam (+ isteğe bağlı harf).
// Türkçe büyük harfler dahil: İNG111, AİT203, ÜNİ101.
const COURSE_CODE = /^[A-ZÇĞİÖŞÜ]{2,5}\d{3}[A-ZÇĞİÖŞÜ]?$/u;

// Dönem başlığı: "2025-2026 Güz", "2025-2026 Bahar Muafiyet", "… Yaz Okulu".
const TERM_HEADER = /^(\d{4})-(\d{4})\s+(Güz|Bahar|Yaz)(\s+[\p{L}\s]+)?$/iu;

// HER BÖLÜM KENDİ DÖNEMİ, belgedeki sırasıyla (kullanıcı isteği: aktarılan
// sonuç belgeyle BİREBİR eşleşmeli). Belge her bölümün altına kendi ANO'sunu
// yazıyor; "Bahar Muafiyet" Bahar'a eklenseydi hesaplayıcının dönem
// ortalaması belgedekiyle tutmazdı (örnek transkriptte 2,06 ↔ 2,02). Aynı
// başlık ikinci kez görülürse (sayfa sonunda tekrar) aynı numarayı alıyor.
class TermRegistry {
  private numbers = new Map<string, number>();

  numberFor(header: string): number {
    const key = header.replace(/\s+/g, ' ').trim().toLocaleLowerCase('tr-TR');
    let n = this.numbers.get(key);
    if (n === undefined) {
      n = this.numbers.size + 1;
      this.numbers.set(key, n);
    }
    return n;
  }

  get size(): number {
    return this.numbers.size;
  }
}

// Belgedeki harf → hesaplayıcının harfi. Transkriptte "D" yazıyor, hesaplayıcı
// "D1" kullanıyor (ikisi de 1,75). F4 ve F6 belgede "Başarısız" (0,00);
// hesaplayıcıda karşılıkları yok, aynı katsayılı F3'e çevriliyor.
const GRADE_ALIASES: Record<string, string> = { D: 'D1', F4: 'F3', F6: 'F3' };

// "Kld" = kaldırılan ders: transkriptte görünüyor ama ortalamaya girmiyor.
const REMOVED_STATUS = 'Kld';

function parseNumber(raw: string): number {
  return Number(raw.replace(',', '.'));
}

interface RawCourse {
  code: string;
  name: string;
  akts: number;
  grade: string;
  status: string;
  term: number;
}

/** PDF girişi: pdf.js satırları (bkz. PdfDom `mode="text"`). */
export function parseBilsisTranscript(rows: TextRow[]): TranscriptParseResult {
  const raw: RawCourse[] = [];
  const terms = new TermRegistry();
  let currentTerm: number | null = null;

  for (const row of rows) {
    const items = row.items.filter((i) => i.s.trim() !== '');
    if (items.length === 0) continue;

    const joined = items.map((i) => i.s.trim()).join(' ');
    if (TERM_HEADER.test(joined)) {
      currentTerm = terms.numberFor(joined);
      continue;
    }

    const code = items[0].s.trim();
    if (currentTerm === null || !COURSE_CODE.test(code) || items.length < 6) continue;

    const tail = items.slice(-4).map((i) => i.s.trim());
    const [, aktsRaw, , gradeRaw] = tail;
    const name = items[1].s.trim();
    // Ad ile kredi arasında kalan parçalar Eşd/Yrn ve Ders Durumu sütunları.
    const status = items
      .slice(2, -4)
      .map((i) => i.s.trim())
      .join(' ');

    raw.push({ code, name, akts: parseNumber(aktsRaw), grade: gradeRaw, status, term: currentTerm });
  }

  return finalize(raw, terms);
}

/**
 * TXT girişi: BİLSİS'in "metin olarak göster" çıktısı (show_mrt_content_buf_as_txt).
 * Aynı tablo, kutu çizgili ve SABİT GENİŞLİKLİ:
 *
 *   │ Ders KoDers Adı          Eşd/Yrn Ders Durumu KredAKTS PuanHarf N│
 *   │ BEB650 TEMEL BİLGİ VE İLETİŞİM                  1   2    6    B2│
 *   │        TEKNOLOJİLERİ KULLANIMI                                  │  ← adın devamı
 *
 * Sütunlar başlık satırındaki konumlardan kesiliyor. Uzun ad bir alt satıra
 * taşıyor (kod sütunu boş) — o satırın ad sütunu bir önceki derse ekleniyor.
 * Puan da taşabiliyor ("11,2" / "5") ama puan kullanılmadığı için önemsiz;
 * AKTS ve harf tek satıra sığıyor. Kayıtlı sayfa (.html) da kabul ediliyor:
 * `<pre>` içi alınıp etiketler/varlıklar temizleniyor.
 */
export function parseBilsisText(input: string): TranscriptParseResult {
  const text = extractPre(input);
  const raw: RawCourse[] = [];
  const terms = new TermRegistry();
  let currentTerm: number | null = null;
  let columns: { name: number; status: number; credit: number } | null = null;
  let last: RawCourse | null = null;

  for (const line of text.split(/\r?\n/)) {
    const first = line.indexOf('│');
    const lastBar = line.lastIndexOf('│');
    if (first === -1 || lastBar <= first) {
      last = null; // kutu dışı / ayraç satırı: devam satırı zinciri kopuyor
      continue;
    }
    const content = line.slice(first + 1, lastBar);
    const trimmed = content.trim();

    if (TERM_HEADER.test(trimmed)) {
      currentTerm = terms.numberFor(trimmed);
      last = null;
      continue;
    }

    if (trimmed.startsWith('Ders Ko')) {
      const name = content.indexOf('Ders Adı');
      const status = content.indexOf('Eşd/Yrn');
      const credit = content.indexOf('Kred');
      columns = name >= 0 && status > name && credit > status ? { name, status, credit } : null;
      last = null;
      continue;
    }

    if (currentTerm === null || !columns) continue;
    const code = content.slice(0, columns.name).trim();

    if (code === '') {
      // Adın alt satıra taşan devamı.
      const more = content.slice(columns.name, columns.status).trim();
      if (last && more) last.name = `${last.name} ${more}`;
      continue;
    }
    if (!COURSE_CODE.test(code)) {
      last = null; // ANO / AGNO özet satırları
      continue;
    }

    const tail = content.slice(columns.credit).trim().split(/\s+/);
    if (tail.length < 4) continue;
    const [, aktsRaw, , gradeRaw] = tail.slice(-4);
    last = {
      code,
      name: content.slice(columns.name, columns.status).trim(),
      akts: parseNumber(aktsRaw),
      grade: gradeRaw,
      status: content.slice(columns.status, columns.credit).trim(),
      term: currentTerm,
    };
    raw.push(last);
  }

  return finalize(raw, terms);
}

function extractPre(input: string): string {
  const pre = /<pre[^>]*>([\s\S]*?)<\/pre>/i.exec(input);
  if (!pre) return input.replace(/^\uFEFF/, '');
  return pre[1]
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/^\uFEFF/, '');
}

function finalize(raw: RawCourse[], terms: TermRegistry): TranscriptParseResult {
  const skipped: TranscriptSkip[] = [];
  // Notu olanları ayır, sonra tekrar edilen dersleri ele.
  const graded: RawCourse[] = [];
  for (const c of raw) {
    if (c.status.split(/\s+/).includes(REMOVED_STATUS)) {
      skipped.push({ code: c.code, lessonName: c.name, reason: 'Kaldırılan ders' });
      continue;
    }
    if (c.grade === '--' || c.grade === '') {
      skipped.push({ code: c.code, lessonName: c.name, reason: 'Notu henüz girilmemiş' });
      continue;
    }
    const grade = GRADE_ALIASES[c.grade] ?? c.grade;
    if (!isValidGrade(grade)) {
      skipped.push({ code: c.code, lessonName: c.name, reason: `Tanınmayan not: ${c.grade}` });
      continue;
    }
    if (!Number.isFinite(c.akts) || c.akts <= 0) {
      skipped.push({ code: c.code, lessonName: c.name, reason: 'AKTS okunamadı' });
      continue;
    }
    graded.push({ ...c, grade });
  }

  // Tekrar alınan dersin HER denemesi kendi döneminde aktarılıyor: belgedeki
  // dönem ortalamaları (ANO) eski F'leri de içeriyor. Genel ortalamada eski
  // denemeyi eleyen hesaplayıcının kendisi (gano.ts `latestAttempts`). Notu
  // henüz girilmemiş tekrar ("--") yukarıda elendiği için eski not sayılmaya
  // devam ediyor; bu da belgedeki AGNO ile tutarlı.
  const courses: TranscriptCourse[] = graded.map((c) => ({
    code: c.code,
    lessonName: c.name,
    semester: c.term,
    akts: c.akts,
    grade: c.grade,
  }));

  return { courses, skipped, termCount: terms.size };
}
