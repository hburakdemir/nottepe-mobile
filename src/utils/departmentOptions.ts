import { faculties, departments } from '../data/departments';

export interface DepartmentOption {
  faculty: string;
  department: string;
  value: string;
  label: string;
}

function buildDepartmentOptions(): DepartmentOption[] {
  const raw: { faculty: string; department: string }[] = [];
  for (const faculty of faculties) {
    const depts = departments[faculty] || [];
    for (const department of depts) {
      if (department === 'Fakülte Notu') continue;
      raw.push({ faculty, department });
    }
  }

  const nameCounts: Record<string, number> = {};
  raw.forEach(({ department }) => {
    nameCounts[department] = (nameCounts[department] || 0) + 1;
  });

  return raw.map(({ faculty, department }) => ({
    faculty,
    department,
    value: `${faculty}::${department}`,
    label: nameCounts[department] > 1 ? `${department} (${faculty})` : department,
  }));
}

export const departmentOptions = buildDepartmentOptions();

export const facultyOptions = faculties.map((f) => ({ value: f, label: f }));
