// Excel/CSV içe ve dışa aktarma — web'in utils/gano/excelParser.js portu.
// Beklenen kolonlar: Ders | Dönem | AKTS | Not (Kod isteğe bağlı).
import * as XLSX from 'xlsx';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { getCoefficient, isValidGrade, MAX_AKTS, MAX_SEMESTER, MIN_AKTS, MIN_SEMESTER, type Course } from './gano';

const HEADER_ALIASES: Record<string, string[]> = {
  code: ['kod', 'ders kodu', 'course code', 'code'],
  lessonName: ['ders', 'ders adı', 'ders adi', 'lesson', 'lesson name', 'course'],
  semester: ['dönem', 'donem', 'semester', 'yarıyıl', 'yariyil'],
  akts: ['akts', 'ects', 'kredi', 'credit'],
  grade: ['not', 'harf notu', 'grade'],
};
const REQUIRED_FIELDS = ['lessonName', 'semester', 'akts', 'grade'];

function normalizeHeader(value: unknown): string {
  return String(value ?? '').trim().toLocaleLowerCase('tr-TR');
}

function mapHeaders(headerRow: unknown[]): { columnIndex: Record<string, number>; missing: string[] } {
  const columnIndex: Record<string, number> = {};
  headerRow.forEach((cell, index) => {
    const normalized = normalizeHeader(cell);
    for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
      if (columnIndex[field] === undefined && aliases.includes(normalized)) {
        columnIndex[field] = index;
      }
    }
  });
  const missing = REQUIRED_FIELDS.filter((f) => columnIndex[f] === undefined);
  return { columnIndex, missing };
}

export interface ImportError {
  rowNumber: number;
  lessonName: string;
  message: string;
}

export interface ImportedCourse {
  code: string;
  lessonName: string;
  semester: number;
  akts: number;
  grade: string;
}

function parseRow(
  row: unknown[],
  columnIndex: Record<string, number>,
  rowNumber: number
): { ok: true; course: ImportedCourse } | { ok: false; error: ImportError } {
  const errors: string[] = [];

  const code = columnIndex.code !== undefined ? String(row[columnIndex.code] ?? '').trim().toUpperCase() : '';

  const lessonName = String(row[columnIndex.lessonName] ?? '').trim();
  if (!lessonName) errors.push('Ders adı boş');

  const semester = Number(row[columnIndex.semester]);
  if (!Number.isInteger(semester) || semester < MIN_SEMESTER || semester > MAX_SEMESTER) {
    errors.push(`Dönem geçersiz (${MIN_SEMESTER}-${MAX_SEMESTER} arası tam sayı olmalı)`);
  }

  const akts = Number(row[columnIndex.akts]);
  if (!Number.isFinite(akts) || akts < MIN_AKTS || akts > MAX_AKTS) {
    errors.push(`AKTS eksik veya geçersiz (${MIN_AKTS}-${MAX_AKTS} arası olmalı)`);
  }

  const grade = String(row[columnIndex.grade] ?? '').trim().toUpperCase();
  if (!isValidGrade(grade)) errors.push(`Geçersiz not: "${grade || 'boş'}"`);

  if (errors.length > 0) {
    return { ok: false, error: { rowNumber, lessonName, message: errors.join(', ') } };
  }
  return { ok: true, course: { code, lessonName, semester, akts, grade } };
}

export async function parseCoursesFromExcel(
  uri: string,
  name: string
): Promise<{ valid: ImportedCourse[]; errors: ImportError[] }> {
  const file = new File(uri);
  const isCsv = name.toLowerCase().endsWith('.csv');
  // CSV'yi metin, xlsx/xls'i base64 olarak okuyup XLSX.read'e veriyoruz — array buffer
  // yolunda Türkçe karakterler (ö, ı, ş, ğ, İ) bozulabiliyor.
  const workbook = isCsv ? XLSX.read(await file.text(), { type: 'string' }) : XLSX.read(await file.base64(), { type: 'base64' });

  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new Error('Dosyada sayfa bulunamadı.');

  const rows: unknown[][] = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
    header: 1,
    defval: '',
    blankrows: false,
  });
  if (rows.length < 2) throw new Error('Dosyada başlık satırından başka veri yok.');

  const { columnIndex, missing } = mapHeaders(rows[0]);
  if (missing.length > 0) {
    throw new Error(
      `Beklenen kolonlar bulunamadı: ${missing.map((f) => HEADER_ALIASES[f][0]).join(', ')}. Başlık satırı "Ders | Dönem | AKTS | Not" olmalı (Kod isteğe bağlı).`
    );
  }

  const valid: ImportedCourse[] = [];
  const errors: ImportError[] = [];
  rows.slice(1).forEach((row, index) => {
    const rowNumber = index + 2;
    const result = parseRow(row, columnIndex, rowNumber);
    if (result.ok) valid.push(result.course);
    else errors.push(result.error);
  });

  return { valid, errors };
}

// Mevcut dersleri "Kod | Ders | Dönem | AKTS | Not | Katsayı" kolonlarıyla .xlsx olarak paylaşır
// (tarayıcı gibi doğrudan indirme yok — RN'de paylaşım sayfası açılır).
export async function exportCoursesToExcel(courses: Course[]): Promise<void> {
  const header = ['Kod', 'Ders', 'Dönem', 'AKTS', 'Not', 'Katsayı'];
  const dataRows = courses.map((course) => {
    const coefficient = getCoefficient(course.grade);
    return [
      course.code || '',
      course.name,
      Number(course.semester),
      Number(course.akts),
      course.grade,
      coefficient === null ? '' : coefficient,
    ];
  });

  const worksheet = XLSX.utils.aoa_to_sheet([header, ...dataRows]);
  worksheet['!cols'] = [{ wch: 10 }, { wch: 36 }, { wch: 8 }, { wch: 8 }, { wch: 6 }, { wch: 8 }];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Dersler');
  const base64 = XLSX.write(workbook, { type: 'base64', bookType: 'xlsx' });

  const file = new File(Paths.cache, 'nottepe-gano-dersleri.xlsx');
  file.create({ overwrite: true });
  file.write(base64, { encoding: 'base64' });

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, {
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      dialogTitle: 'GANO dersleri (.xlsx)',
    });
  }
}
