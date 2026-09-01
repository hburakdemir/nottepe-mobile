// GANO hesapları — web'deki utils/gano/gradeUtils.js + calculateGano.js portu.
// Ders modeli: { id, name, semester, akts, grade }

export const GRADE_COEFFICIENTS: Record<string, number> = {
  A1: 4.0,
  A2: 3.75,
  A3: 3.5,
  B1: 3.25,
  B2: 3.0,
  B3: 2.75,
  C1: 2.5,
  C2: 2.25,
  C3: 2.0,
  D1: 1.75,
  F1: 0,
  F2: 0,
  F3: 0,
};

export const UNCREDITED_GRADES = ['G', 'K', 'H', 'M'];
export const FAIL_GRADES = ['F1', 'F2', 'F3', 'K'];
const NEUTRAL_GRADES = ['H'];

export const ALL_GRADES = [...Object.keys(GRADE_COEFFICIENTS), ...UNCREDITED_GRADES];

export const GPA_SCALE_MAX = 4;
export const MIN_AKTS = 1;
export const MAX_AKTS = 60;
export const MIN_SEMESTER = 1;
export const MAX_SEMESTER = 30;

export function isValidGrade(grade: any): boolean {
  return ALL_GRADES.includes(grade);
}

export function isCreditedGrade(grade: string): boolean {
  return Object.prototype.hasOwnProperty.call(GRADE_COEFFICIENTS, grade);
}

export function getCoefficient(grade: string): number | null {
  return isCreditedGrade(grade) ? GRADE_COEFFICIENTS[grade] : null;
}

export function isFailGrade(grade: string): boolean {
  return FAIL_GRADES.includes(grade);
}

export function isPassGrade(grade: string): boolean {
  return isValidGrade(grade) && !isFailGrade(grade) && !NEUTRAL_GRADES.includes(grade);
}

export function formatGpa(value: number | null): string {
  return value === null || value === undefined ? '—' : value.toFixed(2);
}

// 100'lük not → harf notu dönüşüm aralıkları (min dahil, max dahil).
export const SCORE_RANGES: { min: number; max: number; grade: string }[] = [
  { min: 95, max: 100, grade: 'A1' },
  { min: 90, max: 94, grade: 'A2' },
  { min: 85, max: 89, grade: 'A3' },
  { min: 80, max: 84, grade: 'B1' },
  { min: 75, max: 79, grade: 'B2' },
  { min: 70, max: 74, grade: 'B3' },
  { min: 65, max: 69, grade: 'C1' },
  { min: 60, max: 64, grade: 'C2' },
  { min: 55, max: 59, grade: 'C3' },
  { min: 50, max: 54, grade: 'D1' },
  { min: 0, max: 49, grade: 'F3' },
];

export function scoreToGrade(score: string | number | null | undefined): string | null {
  if (score === null || score === undefined || String(score).trim() === '') return null;
  const value = Number(score);
  if (!Number.isFinite(value)) return null;
  const range = SCORE_RANGES.find((r) => value >= r.min && value <= r.max);
  return range ? range.grade : null;
}

export function gradeToScoreRange(grade: string): string | null {
  const range = SCORE_RANGES.find((r) => r.grade === grade);
  return range ? `${range.min}-${range.max}` : null;
}

export interface Course {
  id: string;
  code?: string;
  name: string;
  semester: number;
  akts: number | string;
  grade: string;
}

function parseAkts(course: Course): number | null {
  const akts = Number(course.akts);
  return Number.isFinite(akts) && akts > 0 ? akts : null;
}

export interface Totals {
  totalAkts: number;
  creditedAkts: number;
  qualityPoints: number;
  passedAkts: number;
  failedAkts: number;
  gano: number | null;
}

export type Overrides = Record<string, string>;

// Senaryo varsa senaryodaki notu, yoksa dersin gerçek notunu döner.
export function effectiveGrade(course: Course, overrides: Overrides = {}): string {
  const override = overrides[course.id];
  return isValidGrade(override) ? override : course.grade;
}

// GANO = Σ(AKTS × katsayı) / Σ(kredili AKTS). Kredisiz dersler (G/K/H/M) orana girmez.
export function computeTotals(courses: Course[], overrides: Overrides = {}): Totals {
  let creditedAkts = 0;
  let qualityPoints = 0;
  let totalAkts = 0;
  let passedAkts = 0;
  let failedAkts = 0;

  for (const course of courses) {
    const akts = parseAkts(course);
    const grade = effectiveGrade(course, overrides);
    if (akts === null || !isValidGrade(grade)) continue;

    totalAkts += akts;
    if (isPassGrade(grade)) passedAkts += akts;
    if (isFailGrade(grade)) failedAkts += akts;

    if (isCreditedGrade(grade)) {
      creditedAkts += akts;
      qualityPoints += akts * (getCoefficient(grade) as number);
    }
  }

  return {
    totalAkts,
    creditedAkts,
    qualityPoints,
    passedAkts,
    failedAkts,
    gano: creditedAkts > 0 ? qualityPoints / creditedAkts : null,
  };
}

export interface SemesterRow {
  semester: number;
  courseCount: number;
  totalAkts: number;
  gano: number | null;
}

export function computeSemesterRows(courses: Course[], overrides: Overrides = {}): SemesterRow[] {
  const bySemester = new Map<number, Course[]>();
  for (const course of courses) {
    const semester = Number(course.semester);
    if (!Number.isInteger(semester) || semester <= 0) continue;
    if (!bySemester.has(semester)) bySemester.set(semester, []);
    bySemester.get(semester)!.push(course);
  }

  return [...bySemester.entries()]
    .sort(([a], [b]) => a - b)
    .map(([semester, semesterCourses]) => {
      const totals = computeTotals(semesterCourses, overrides);
      return { semester, courseCount: semesterCourses.length, totalAkts: totals.totalAkts, gano: totals.gano };
    });
}

export interface Stats {
  totalCourses: number;
  passedCourses: number;
  failedCourses: number;
  successRate: number | null;
  avgAktsPerSemester: number | null;
  semesterRows: SemesterRow[];
  gradeDistribution: Record<string, number>;
}

// İstatistik kutuları: ders sayıları, başarı oranı, dönem başına ortalama AKTS.
export function computeStats(courses: Course[], overrides: Overrides = {}): Stats {
  const semesterRows = computeSemesterRows(courses, overrides);
  let totalCourses = 0;
  let passedCourses = 0;
  let failedCourses = 0;
  const gradeDistribution: Record<string, number> = {};

  for (const course of courses) {
    const grade = effectiveGrade(course, overrides);
    if (parseAkts(course) === null || !isValidGrade(grade)) continue;
    totalCourses += 1;
    if (isPassGrade(grade)) passedCourses += 1;
    if (isFailGrade(grade)) failedCourses += 1;
    gradeDistribution[grade] = (gradeDistribution[grade] || 0) + 1;
  }

  const judgedCourses = passedCourses + failedCourses;
  const totalAkts = semesterRows.reduce((sum, row) => sum + row.totalAkts, 0);

  return {
    totalCourses,
    passedCourses,
    failedCourses,
    successRate: judgedCourses > 0 ? (passedCourses / judgedCourses) * 100 : null,
    avgAktsPerSemester: semesterRows.length > 0 ? totalAkts / semesterRows.length : null,
    semesterRows,
    gradeDistribution,
  };
}

// Hızlı tahmin: "GANO'm X, şu derslerden şu notları alırsam ortalamam kaç olur?"
export function projectGano({
  currentGano,
  currentAkts,
  newCourses,
}: {
  currentGano: string | number;
  currentAkts: string | number;
  newCourses: { akts: string | number; coefficient: number | null }[];
}): { newGano: number; addedAkts: number } | null {
  const gano = Number(currentGano);
  const akts = Number(currentAkts);
  if (!Number.isFinite(gano) || gano < 0 || gano > GPA_SCALE_MAX) return null;
  if (!Number.isFinite(akts) || akts < 0) return null;

  let addedAkts = 0;
  let addedPoints = 0;
  for (const course of newCourses) {
    const courseAkts = Number(course.akts);
    const coefficient = Number(course.coefficient);
    if (!Number.isFinite(courseAkts) || courseAkts <= 0) continue;
    if (!Number.isFinite(coefficient)) continue;
    addedAkts += courseAkts;
    addedPoints += courseAkts * coefficient;
  }

  const totalAkts = akts + addedAkts;
  if (totalAkts <= 0 || addedAkts <= 0) return null;
  return {
    newGano: (gano * akts + addedPoints) / totalAkts,
    addedAkts,
  };
}

export interface TargetPlan {
  achieved: boolean;
  neededByGrade: { grade: string; coefficient: number | null; count: number | null }[];
}

// Hedef GANO planı: mevcut (senaryo dahil) toplamların üzerine, her biri
// plannedAkts AKTS'lik kaç yeni ders gerektiğini not bazında çözer.
export function computeTargetPlan({
  totals,
  targetGpa,
  plannedAkts,
  planGrades,
}: {
  totals: Totals;
  targetGpa: string | number;
  plannedAkts: string | number;
  planGrades: string[];
}): TargetPlan | null {
  const target = Number(targetGpa);
  const akts = Number(plannedAkts);
  if (!Number.isFinite(target) || target <= 0 || target > GPA_SCALE_MAX) return null;
  if (!Number.isFinite(akts) || akts <= 0) return null;

  const achieved = totals.gano !== null && totals.gano >= target;
  const deficit = target * totals.creditedAkts - totals.qualityPoints;

  const neededByGrade = planGrades.map((grade) => {
    const coefficient = getCoefficient(grade);
    if (coefficient === null || coefficient <= target) {
      return { grade, coefficient, count: null };
    }
    const count = Math.max(0, Math.ceil(deficit / (akts * (coefficient - target))));
    return { grade, coefficient, count };
  });

  return { achieved, neededByGrade };
}

export interface AktsServerData {
  semesters: { name: string; courses: { code?: string; name: string; akts: number; grade: string }[] }[];
}

// Düz liste → sunucu formatı (dönem numarasına göre gruplanır) — /api/akts'nin beklediği şekil.
export function coursesToServerData(courses: Course[]): AktsServerData {
  const bySemester = new Map<number, { code?: string; name: string; akts: number; grade: string }[]>();
  for (const course of courses) {
    const semester = Number(course.semester) > 0 ? Math.trunc(Number(course.semester)) : 1;
    if (!bySemester.has(semester)) bySemester.set(semester, []);
    bySemester.get(semester)!.push({ code: course.code, name: course.name, akts: Number(course.akts), grade: course.grade });
  }
  return {
    semesters: [...bySemester.entries()]
      .sort(([a], [b]) => a - b)
      .map(([semester, semesterCourses]) => ({ name: `${semester}. Dönem`, courses: semesterCourses })),
  };
}

function semesterNumberFromName(name: string | undefined, index: number): number {
  const match = /^\s*(\d+)/.exec(String(name ?? ''));
  const parsed = match ? Number(match[1]) : NaN;
  return Number.isInteger(parsed) && parsed > 0 ? parsed : index + 1;
}

let idCounter = 1;
export function makeCourseId(): string {
  return `g${Date.now()}_${idCounter++}`;
}

// Sunucudaki kayıt formatı → düz liste. Yeni baremde karşılığı olmayan notlar atlanır.
export function serverDataToCourses(data: AktsServerData | null | undefined): { courses: Course[]; skipped: number } {
  const courses: Course[] = [];
  let skipped = 0;
  const semesters = Array.isArray(data?.semesters) ? data!.semesters : [];
  semesters.forEach((sem, index) => {
    const semesterNumber = semesterNumberFromName(sem?.name, index);
    (Array.isArray(sem?.courses) ? sem.courses : []).forEach((raw) => {
      const name = String(raw?.name ?? '').trim();
      const code = String(raw?.code ?? '').trim();
      const akts = Number(raw?.akts);
      const grade = String(raw?.grade ?? '').trim().toUpperCase();
      if (name && Number.isFinite(akts) && akts > 0 && isValidGrade(grade)) {
        courses.push({ id: makeCourseId(), code: code || undefined, name, semester: semesterNumber, akts, grade });
      } else if (name) {
        skipped += 1;
      }
    });
  });
  return { courses, skipped };
}
