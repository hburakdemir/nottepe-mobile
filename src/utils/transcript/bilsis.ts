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

const TERM_HEADER = /^(\d{4})-(\d{4})\s+(Güz|Bahar|Yaz)(\s+Muafiyet)?$/iu;

// Güz < Bahar < Yaz. Yaz okulu kendi dönem numarasını ALMIYOR, aynı yılın
// Bahar'ına ekleniyor: dönem sayısı öğrencinin gözünde "kaçıncı dönemdeyim"
// demek ve yaz okulu onu artırmıyor. Muafiyet bölümü de ait olduğu dönemin
// bir parçası (ör. "2025-2026 Bahar Muafiyet" → 2025-2026 Bahar).
const SEASON_ORDER: Record<string, number> = { güz: 0, bahar: 1, yaz: 1 };

// Belgedeki harf → hesaplayıcının harfi. Transkriptte "D" yazıyor, hesaplayıcı
// "D1" kullanıyor (ikisi de 1,75). F4 ve F6 belgede "Başarısız" (0,00);
// hesaplayıcıda karşılıkları yok, aynı katsayılı F3'e çevriliyor.
const GRADE_ALIASES: Record<string, string> = { D: 'D1', F4: 'F3', F6: 'F3' };

// "Kld" = kaldırılan ders: transkriptte görünüyor ama ortalamaya girmiyor.
const REMOVED_STATUS = 'Kld';

function termKey(match: RegExpExecArray): number {
  const startYear = Number(match[1]);
  const season = SEASON_ORDER[match[3].toLocaleLowerCase('tr-TR')] ?? 0;
  return startYear * 10 + season;
}

function parseNumber(raw: string): number {
  return Number(raw.replace(',', '.'));
}

export function parseBilsisTranscript(rows: TextRow[]): TranscriptParseResult {
  // İlk geçiş: satırları dönemlere böl.
  type RawCourse = { code: string; name: string; akts: number; grade: string; status: string; term: number };
  const raw: RawCourse[] = [];
  const skipped: TranscriptSkip[] = [];
  const terms = new Set<number>();
  let currentTerm: number | null = null;

  for (const row of rows) {
    const items = row.items.filter((i) => i.s.trim() !== '');
    if (items.length === 0) continue;

    const joined = items.map((i) => i.s.trim()).join(' ');
    const header = TERM_HEADER.exec(joined);
    if (header) {
      currentTerm = termKey(header);
      terms.add(currentTerm);
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

  // Dönem numaraları: tanınan dönemler kronolojik sırayla 1, 2, 3...
  const termNumbers = new Map([...terms].sort((a, b) => a - b).map((key, index) => [key, index + 1]));

  // İkinci geçiş: notu olanları ayır, sonra tekrar edilen dersleri ele.
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

  // Tekrar alınan derste yalnızca EN SON notlu deneme sayılıyor — resmi AGNO
  // da böyle hesaplanıyor. Eski deneme de aktarılsaydı hem AKTS hem ortalama
  // iki kez sayılırdı. Notu henüz girilmemiş tekrar ("--") yukarıda elendiği
  // için eski not sayılmaya devam ediyor; bu da belgedeki AGNO ile tutarlı.
  const latestByCode = new Map<string, RawCourse>();
  for (const c of graded) {
    const prev = latestByCode.get(c.code);
    if (!prev || c.term >= prev.term) latestByCode.set(c.code, c);
  }
  const courses: TranscriptCourse[] = [];
  for (const c of graded) {
    if (latestByCode.get(c.code) !== c) {
      skipped.push({ code: c.code, lessonName: c.name, reason: `Tekrar alındı, eski not (${c.grade}) sayılmadı` });
      continue;
    }
    courses.push({
      code: c.code,
      lessonName: c.name,
      semester: termNumbers.get(c.term) ?? 1,
      akts: c.akts,
      grade: c.grade,
    });
  }

  return { courses, skipped, termCount: terms.size };
}
