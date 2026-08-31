// Haftalık ders programı — web utils/schedule/{colors,conflicts,scheduleStorage}.js portu.
// Ders şekli: { id, name, day (1-6 Pzt-Cmt), start "09:00", end "10:50", location, colorIdx }

export interface ScheduleCourse {
  id: string;
  name: string;
  day: number;
  start: string;
  end: string;
  location: string;
  colorIdx: number;
}

export const COURSE_COLORS = [
  { name: 'Marka', hex: '#2F5755' },
  { name: 'Açık Marka', hex: '#4f7d7a' },
  { name: 'Kehribar', hex: '#d97706' },
  { name: 'Gül', hex: '#e11d48' },
  { name: 'Çivit', hex: '#4f46e5' },
  { name: 'Zümrüt', hex: '#059669' },
  { name: 'Arduvaz', hex: '#475569' },
  { name: 'Fuşya', hex: '#a21caf' },
];

export const getCourseColor = (idx: number) =>
  COURSE_COLORS[((idx % COURSE_COLORS.length) + COURSE_COLORS.length) % COURSE_COLORS.length];

export const DAY_NAMES: Record<number, string> = {
  1: 'Pazartesi',
  2: 'Salı',
  3: 'Çarşamba',
  4: 'Perşembe',
  5: 'Cuma',
  6: 'Cumartesi',
};

export const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

export function coursesOverlap(a: ScheduleCourse, b: ScheduleCourse): boolean {
  if (a.day !== b.day) return false;
  return toMinutes(a.start) < toMinutes(b.end) && toMinutes(b.start) < toMinutes(a.end);
}

export function findConflictIds(courses: ScheduleCourse[]): Set<string> {
  const ids = new Set<string>();
  for (let i = 0; i < courses.length; i++) {
    for (let j = i + 1; j < courses.length; j++) {
      if (coursesOverlap(courses[i], courses[j])) {
        ids.add(courses[i].id);
        ids.add(courses[j].id);
      }
    }
  }
  return ids;
}

export function conflictsForCourse(candidate: ScheduleCourse, courses: ScheduleCourse[]): ScheduleCourse[] {
  return courses.filter((c) => c.id !== candidate.id && coursesOverlap(candidate, c));
}

export const makeCourseId = () => `c_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export function sanitizeCourse(raw: any): ScheduleCourse | null {
  if (!raw || typeof raw !== 'object') return null;
  const day = parseInt(raw.day, 10);
  if (!Number.isInteger(day) || day < 1 || day > 6) return null;
  if (!TIME_RE.test(raw.start) || !TIME_RE.test(raw.end)) return null;
  const name = String(raw.name || '').trim();
  if (!name) return null;
  return {
    id: raw.id || makeCourseId(),
    name: name.slice(0, 80),
    day,
    start: raw.start,
    end: raw.end,
    location: String(raw.location || '').trim().slice(0, 60),
    colorIdx: Number.isInteger(raw.colorIdx) ? raw.colorIdx : 0,
  };
}
