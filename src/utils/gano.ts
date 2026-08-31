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

export interface Course {
  id: string;
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

// GANO = Σ(AKTS × katsayı) / Σ(kredili AKTS). Kredisiz dersler (G/K/H/M) orana girmez.
export function computeTotals(courses: Course[]): Totals {
  let creditedAkts = 0;
  let qualityPoints = 0;
  let totalAkts = 0;
  let passedAkts = 0;
  let failedAkts = 0;

  for (const course of courses) {
    const akts = parseAkts(course);
    const grade = course.grade;
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

export function computeSemesterRows(courses: Course[]): SemesterRow[] {
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
      const totals = computeTotals(semesterCourses);
      return { semester, courseCount: semesterCourses.length, totalAkts: totals.totalAkts, gano: totals.gano };
    });
}

export interface AktsServerData {
  semesters: { name: string; courses: { name: string; akts: number; grade: string }[] }[];
}

// Düz liste → sunucu formatı (dönem numarasına göre gruplanır) — /api/akts'nin beklediği şekil.
export function coursesToServerData(courses: Course[]): AktsServerData {
  const bySemester = new Map<number, { name: string; akts: number; grade: string }[]>();
  for (const course of courses) {
    const semester = Number(course.semester) > 0 ? Math.trunc(Number(course.semester)) : 1;
    if (!bySemester.has(semester)) bySemester.set(semester, []);
    bySemester.get(semester)!.push({ name: course.name, akts: Number(course.akts), grade: course.grade });
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
      const akts = Number(raw?.akts);
      const grade = String(raw?.grade ?? '').trim().toUpperCase();
      if (name && Number.isFinite(akts) && akts > 0 && isValidGrade(grade)) {
        courses.push({ id: makeCourseId(), name, semester: semesterNumber, akts, grade });
      } else if (name) {
        skipped += 1;
      }
    });
  });
  return { courses, skipped };
}
