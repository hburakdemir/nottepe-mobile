import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useRoute } from '@react-navigation/native';
import * as DocumentPicker from 'expo-document-picker';
import {
  AlertTriangle,
  Calculator,
  CheckCircle2,
  ChevronDown,
  Filter,
  FileDown,
  FileSpreadsheet,
  FileUp,
  FlaskConical,
  GraduationCap,
  Info,
  Layers,
  ListOrdered,
  Pencil,
  Plus,
  RotateCcw,
  Save,
  Sigma,
  Sparkles,
  Target,
  Trash2,
  Upload,
  X,
  XCircle,
} from 'lucide-react-native';
import { aktsAPI } from '../../lib/api';
import { useTheme } from '../../context/ThemeContext';
import type { RootStackParamList } from '../../navigation/types';
import {
  ALL_GRADES,
  computeStats,
  computeTargetPlan,
  computeTotals,
  coursesToServerData,
  formatGpa,
  getCoefficient,
  GPA_SCALE_MAX,
  GRADE_COEFFICIENTS,
  gradeToScoreRange,
  isCreditedGrade,
  isFailGrade,
  isPassGrade,
  makeCourseId,
  projectGano,
  scoreToGrade,
  SCORE_RANGES,
  serverDataToCourses,
  UNCREDITED_GRADES,
  type Course,
  type Overrides,
} from '../../utils/gano';
import { exportCoursesToExcel, parseCoursesFromExcel, type ImportedCourse, type ImportError, MAX_IMPORT_BYTES, formatBytes } from '../../utils/ganoExcel';
import KeyboardAvoider, { KeyboardAwareScroll } from '../../components/layout/KeyboardAvoider';

interface SavedCalc {
  id: number;
  title: string;
  gpa: number | null;
  updated_at: string;
}

const SHADOW_MD = {
  shadowColor: '#000',
  shadowOpacity: 0.1,
  shadowRadius: 8,
  shadowOffset: { width: 0, height: 3 },
  elevation: 3,
};

const CREDITED_GRADES = Object.keys(GRADE_COEFFICIENTS);
const PLAN_GRADES = ['A1', 'A2', 'B1'];
const DEFAULT_PLANNED_AKTS = 5;
const UNCREDITED_LABELS: Record<string, string> = {
  G: 'Geçti — başarılı sayılır, ortalamaya girmez',
  K: 'Kaldı — başarısız sayılır, ortalamaya girmez',
  H: 'Hariç — ne başarılı ne başarısız sayılır',
  M: 'Muaf — başarılı sayılır, ortalamaya girmez',
};
const scoreRangeByGrade: Record<string, string> = Object.fromEntries(SCORE_RANGES.map((r) => [r.grade, `${r.min}-${r.max}`]));

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function emptyDraft() {
  return { code: '', name: '', semester: '1', akts: '', mode: 'grade' as 'grade' | 'score', grade: '', score: '' };
}

let quickRowCounter = 1;
function emptyQuickRow() {
  return { id: `q${quickRowCounter++}`, akts: '', mode: 'grade' as 'grade' | 'score', grade: '', score: '' };
}

export default function AktsCalculatorScreen() {
  const route = useRoute<any>();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const loadId = (route.params as RootStackParamList['AktsCalculator'])?.loadId;
  const [title, setTitle] = useState('Hesaplamam');
  const [courses, setCourses] = useState<Course[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [editingCourseId, setEditingCourseId] = useState<string | null>(null);
  const [draft, setDraft] = useState(emptyDraft());

  const [savedCalcs, setSavedCalcs] = useState<SavedCalc[]>([]);
  const [showSaved, setShowSaved] = useState(false);
  const [loadingSaved, setLoadingSaved] = useState(false);

  const [overrides, setOverrides] = useState<Overrides>({});
  const [semesterFilter, setSemesterFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'passed' | 'failed'>('all');
  const [collapsedSemesters, setCollapsedSemesters] = useState<Set<number | string>>(new Set());

  const [scenarioCourseId, setScenarioCourseId] = useState('');
  const [scenarioGrade, setScenarioGrade] = useState('');

  const [targetGpa, setTargetGpa] = useState('');
  const [plannedAkts, setPlannedAkts] = useState(String(DEFAULT_PLANNED_AKTS));

  const [quickGano, setQuickGano] = useState('');
  const [quickAkts, setQuickAkts] = useState('');
  const [quickRows, setQuickRows] = useState([emptyQuickRow()]);

  const [gradeScaleOpen, setGradeScaleOpen] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [importPreview, setImportPreview] = useState<{ valid: ImportedCourse[]; errors: ImportError[] } | null>(null);
  const [importParsing, setImportParsing] = useState(false);

  const fetchSaved = async () => {
    setLoadingSaved(true);
    try {
      const res = await aktsAPI.getAll();
      setSavedCalcs(res.data.calculations || []);
      return res.data.calculations || [];
    } catch {
      return [];
    } finally {
      setLoadingSaved(false);
    }
  };

  useEffect(() => {
    (async () => {
      const calcs = await fetchSaved();
      if (loadId) {
        const full = calcs.find((c: any) => c.id === loadId);
        if (full) {
          const { courses: loaded } = serverDataToCourses(full.data);
          setCourses(loaded);
          setTitle(full.title);
          setEditingId(full.id);
        }
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const baseTotals = useMemo(() => computeTotals(courses), [courses]);
  const scenarioTotals = useMemo(() => computeTotals(courses, overrides), [courses, overrides]);
  const stats = useMemo(() => computeStats(courses), [courses]);

  const semesters = useMemo(
    () => [...new Set(courses.map((c) => Number(c.semester)).filter((s) => Number.isInteger(s)))].sort((a, b) => a - b),
    [courses]
  );

  const filteredCourses = useMemo(
    () =>
      courses.filter((course) => {
        if (semesterFilter !== 'all' && Number(course.semester) !== Number(semesterFilter)) return false;
        if (statusFilter === 'passed') return isPassGrade(course.grade);
        if (statusFilter === 'failed') return isFailGrade(course.grade);
        return true;
      }),
    [courses, semesterFilter, statusFilter]
  );

  const groupedFiltered = useMemo(() => {
    if (semesterFilter !== 'all') return null;
    const bySemester = new Map<number | string, Course[]>();
    for (const c of filteredCourses) {
      const sem = Number(c.semester);
      const key = Number.isInteger(sem) && sem > 0 ? sem : 'diger';
      if (!bySemester.has(key)) bySemester.set(key, []);
      bySemester.get(key)!.push(c);
    }
    return [...bySemester.entries()].sort(([a], [b]) => {
      if (a === 'diger') return 1;
      if (b === 'diger') return -1;
      return (a as number) - (b as number);
    });
  }, [filteredCourses, semesterFilter]);

  const toggleSemesterCollapse = (key: number | string) => {
    setCollapsedSemesters((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const openAddForm = () => {
    setEditingCourseId(null);
    setDraft(emptyDraft());
    setShowForm(true);
  };

  const openEditForm = (course: Course) => {
    setEditingCourseId(course.id);
    setDraft({
      code: course.code || '',
      name: course.name,
      semester: String(course.semester),
      akts: String(course.akts),
      mode: 'grade',
      grade: course.grade,
      score: '',
    });
    setShowForm(true);
  };

  const effectiveDraftGrade = draft.mode === 'score' ? scoreToGrade(draft.score) : draft.grade;

  const commitSaveDraft = () => {
    const name = draft.name.trim();
    const semester = Math.max(1, parseInt(draft.semester, 10) || 1);
    const akts = Number(draft.akts);
    const grade = effectiveDraftGrade;
    const code = draft.code.trim().toUpperCase();
    if (editingCourseId) {
      setCourses((prev) =>
        prev.map((c) => (c.id === editingCourseId ? { ...c, code: code || undefined, name, semester, akts, grade: grade! } : c))
      );
    } else {
      setCourses((prev) => [...prev, { id: makeCourseId(), code: code || undefined, name, semester, akts, grade: grade! }]);
    }
    setShowForm(false);
  };

  const handleSaveDraft = () => {
    const name = draft.name.trim();
    const semester = Number(draft.semester);
    const akts = Number(draft.akts);
    if (!name) {
      Alert.alert('Hata', 'Ders adı boş olamaz.');
      return;
    }
    if (!Number.isInteger(semester) || semester < 1 || semester > 30) {
      Alert.alert('Hata', 'Dönem 1-30 arası tam sayı olmalı.');
      return;
    }
    if (!Number.isFinite(akts) || akts < 1 || akts > 60) {
      Alert.alert('Hata', 'AKTS 1-60 arası olmalı.');
      return;
    }
    if (!effectiveDraftGrade || !ALL_GRADES.includes(effectiveDraftGrade)) {
      Alert.alert('Hata', draft.mode === 'score' ? "Geçerli bir 100'lük not gir (0-100)." : 'Bir not seçmelisin.');
      return;
    }
    if (editingCourseId) {
      Alert.alert('Değişiklikleri kaydet', 'Değişiklikleri kaydetmek istediğine emin misin?', [
        { text: 'Vazgeç', style: 'cancel' },
        { text: 'Kaydet', onPress: commitSaveDraft },
      ]);
    } else {
      commitSaveDraft();
    }
  };

  const handleDeleteCourse = (course: Course) => {
    Alert.alert('Dersi sil', `"${course.name}" dersini silmek istediğine emin misin?`, [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: () => {
          setCourses((prev) => prev.filter((c) => c.id !== course.id));
          setOverrides((prev) => {
            if (!(course.id in prev)) return prev;
            const next = { ...prev };
            delete next[course.id];
            return next;
          });
        },
      },
    ]);
  };

  const handleSaveToProfile = async () => {
    if (courses.length === 0) {
      Alert.alert('Hata', 'Kaydedecek ders yok.');
      return;
    }
    const payload = {
      title: title.trim() || 'Hesaplamam',
      data: coursesToServerData(courses),
      gpa: baseTotals.gano !== null ? Number(baseTotals.gano.toFixed(2)) : null,
    };
    setSaving(true);
    try {
      if (editingId) {
        await aktsAPI.update(editingId, payload);
        Alert.alert('Başarılı', 'Hesaplama güncellendi!');
      } else {
        const res = await aktsAPI.save(payload);
        setEditingId(res.data?.calculation?.id || null);
        Alert.alert('Başarılı', 'Hesaplama profiline kaydedildi!');
      }
      fetchSaved();
    } catch (err: any) {
      Alert.alert('Hata', err.response?.data?.message || 'Kaydedilemedi.');
    } finally {
      setSaving(false);
    }
  };

  const handleLoadSaved = async (calc: SavedCalc) => {
    try {
      const res = await aktsAPI.getAll();
      const full = (res.data.calculations || []).find((c: any) => c.id === calc.id);
      if (!full) return;
      const { courses: loaded, skipped } = serverDataToCourses(full.data);
      setCourses(loaded);
      setTitle(full.title);
      setEditingId(full.id);
      setShowSaved(false);
      if (skipped > 0) {
        Alert.alert('Bilgi', `${skipped} ders eski not sistemine ait olduğu için aktarılamadı.`);
      }
    } catch {
      Alert.alert('Hata', 'Kayıt yüklenemedi.');
    }
  };

  const handleDeleteSaved = (calc: SavedCalc) => {
    Alert.alert('Kaydı sil', `"${calc.title}" kaydını silmek istediğine emin misin?`, [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: async () => {
          try {
            await aktsAPI.delete(calc.id);
            setSavedCalcs((prev) => prev.filter((c) => c.id !== calc.id));
            if (editingId === calc.id) setEditingId(null);
          } catch {
            Alert.alert('Hata', 'Silinemedi.');
          }
        },
      },
    ]);
  };

  const handleNewCalc = () => {
    setCourses([]);
    setTitle('Hesaplamam');
    setEditingId(null);
  };

  const handleClear = () => {
    Alert.alert('Tüm dersler silinecek', 'Emin misiniz?', [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Temizle',
        style: 'destructive',
        onPress: () => {
          setCourses([]);
          setOverrides({});
          setEditingId(null);
          setTitle('Hesaplamam');
        },
      },
    ]);
  };

  const handleExport = async () => {
    if (courses.length === 0) {
      Alert.alert('Hata', 'Aktarılacak ders yok.');
      return;
    }
    try {
      await exportCoursesToExcel(courses);
    } catch {
      Alert.alert('Hata', 'Excel dosyası oluşturulamadı.');
    }
  };

  const openImportPicker = async () => {
    setShowImport(true);
    setImportPreview(null);
  };

  const handleImportFile = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['text/csv', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
      copyToCacheDirectory: true,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];

    // Parse'a HİÇ başlamadan ele. `parseCoursesFromExcel` içindeki `XLSX.read`
    // tamamen senkron: başladıktan sonra iptal edilemiyor, JS thread'i bloke
    // ediyor ve büyük dosyada Android'in "yanıt vermiyor" (ANR) diyalogunu
    // tetikleyebiliyor. `size` opsiyonel bir alan — gelmezse eleme dosyanın
    // kendisinden okunarak ganoExcel içinde tekrar yapılıyor.
    if (typeof asset.size === 'number' && asset.size > MAX_IMPORT_BYTES) {
      Alert.alert(
        'Dosya çok büyük',
        `Seçtiğin dosya ${formatBytes(asset.size)}. En fazla ${formatBytes(MAX_IMPORT_BYTES)} olabilir.\n\nTranskriptini sadece ders satırlarını bırakacak şekilde sadeleştirip tekrar dene.`
      );
      return;
    }

    setImportParsing(true);
    try {
      const preview = await parseCoursesFromExcel(asset.uri, asset.name);
      setImportPreview(preview);
    } catch (err: any) {
      Alert.alert('Hata', err.message || 'Dosya okunamadı.');
    } finally {
      setImportParsing(false);
    }
  };

  const handleConfirmImport = () => {
    if (!importPreview) return;
    setCourses((prev) => [
      ...prev,
      ...importPreview.valid.map((c) => ({
        id: makeCourseId(),
        code: c.code || undefined,
        name: c.lessonName,
        semester: c.semester,
        akts: c.akts,
        grade: c.grade,
      })),
    ]);
    setShowImport(false);
    setImportPreview(null);
  };

  // ── Senaryo hesaplama ────────────────────────────────────────────────────
  const availableScenarioCourses = courses.filter((c) => !(c.id in overrides));
  const overrideEntries = Object.entries(overrides)
    .map(([courseId, grade]) => ({ course: courses.find((c) => c.id === courseId), grade }))
    .filter((e): e is { course: Course; grade: string } => !!e.course);
  const hasScenario = overrideEntries.length > 0;
  const scenarioDelta =
    hasScenario && baseTotals.gano !== null && scenarioTotals.gano !== null ? scenarioTotals.gano - baseTotals.gano : null;

  const addScenarioOverride = () => {
    if (!scenarioCourseId || !scenarioGrade) return;
    setOverrides((prev) => ({ ...prev, [scenarioCourseId]: scenarioGrade }));
    setScenarioCourseId('');
    setScenarioGrade('');
  };
  const removeScenarioOverride = (courseId: string) => {
    setOverrides((prev) => {
      const next = { ...prev };
      delete next[courseId];
      return next;
    });
  };

  // ── Hedef GANO ───────────────────────────────────────────────────────────
  const targetPlan = computeTargetPlan({ totals: scenarioTotals, targetGpa, plannedAkts, planGrades: PLAN_GRADES });

  // ── Hızlı tahmin ─────────────────────────────────────────────────────────
  useEffect(() => {
    setQuickGano(baseTotals.gano !== null ? baseTotals.gano.toFixed(2) : '');
    setQuickAkts(baseTotals.creditedAkts > 0 ? String(baseTotals.creditedAkts) : '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const quickNewCourses = quickRows
    .map((row) => ({ akts: row.akts, coefficient: getCoefficient(row.mode === 'score' ? scoreToGrade(row.score) || '' : row.grade) }))
    .filter((c) => c.coefficient !== null);
  const quickResult = projectGano({ currentGano: quickGano, currentAkts: quickAkts, newCourses: quickNewCourses });
  const quickDelta = quickResult !== null ? quickResult.newGano - Number(quickGano) : null;

  // ── Grafikler ────────────────────────────────────────────────────────────
  const distributionRows = ALL_GRADES.filter((g) => stats.gradeDistribution[g] > 0).map((grade) => ({
    grade,
    count: stats.gradeDistribution[grade],
  }));
  const maxDistCount = Math.max(1, ...distributionRows.map((r) => r.count));
  const judgedAkts = baseTotals.passedAkts + baseTotals.failedAkts;

  return (
    <KeyboardAwareScroll showsVerticalScrollIndicator={false} className="flex-1 bg-ground" contentContainerClassName="px-4 pt-6 pb-[110px] gap-4" keyboardShouldPersistTaps="handled">
      {/* Başlık */}
      <View className="gap-1">
        <View className="flex-row items-center gap-2.5">
          <Calculator size={32} color={isDark ? '#5A9690' : '#2F5755'} />
          <Text className="text-3xl font-extrabold text-ink flex-shrink">AKTS / GANO Hesaplama</Text>
        </View>
        <Text className="text-sm text-muted mt-1">
          Derslerini gir veya dosyadan aktar; GANO'nu, senaryolarını ve hedefini hesapla. Taslağın bu cihazda saklanır.
        </Text>

        <View className="bg-brand rounded-xl px-5 py-3.5 items-center mt-3" style={SHADOW_MD}>
          <Text className="text-xs text-white/80 uppercase tracking-[0.5px]">Genel Ortalama (GANO)</Text>
          <Text className="text-2xl font-extrabold text-white mt-0.5">{formatGpa(baseTotals.gano)}</Text>
          <Text className="text-xs text-white/80">{baseTotals.creditedAkts} kredili AKTS</Text>
        </View>
      </View>

      {/* Üst bilgi kartları */}
      <View className="flex-row flex-wrap gap-2.5">
        <StatCard
          icon={Layers}
          label="Toplam AKTS"
          value={baseTotals.totalAkts.toLocaleString('tr-TR')}
          isDark={isDark}
          info="Bu hesaplamaya girdiğin derslerin AKTS toplamı — resmi transkriptindeki gerçek toplam AKTS'den farklı olabilir, çünkü sadece burada eklediğin dersleri sayar."
        />
        <StatCard
          icon={CheckCircle2}
          label="Başarılı AKTS"
          value={baseTotals.passedAkts.toLocaleString('tr-TR')}
          isDark={isDark}
          info="Geçer bir notla tamamladığın derslerin AKTS toplamı."
        />
        <StatCard
          icon={XCircle}
          label="Başarısız AKTS"
          value={baseTotals.failedAkts.toLocaleString('tr-TR')}
          isDark={isDark}
          info="Kaldığın (FF/FD gibi başarısız notlu) derslerin AKTS toplamı."
        />
        <StatCard
          icon={Sigma}
          label="Toplam Kalite Puanı"
          value={baseTotals.qualityPoints.toLocaleString('tr-TR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
          isDark={isDark}
          info="Kredili her dersin AKTS × katsayı değerlerinin toplamı. GANO = Toplam Kalite Puanı ÷ Kredili AKTS."
        />
        <View className="w-[47.5%] bg-brand rounded-lg p-4" style={SHADOW_MD}>
          <View className="flex-row items-center gap-1.5 mb-1">
            <GraduationCap size={16} color="#fff" />
            <Text className="text-xs font-medium text-white/90">GANO</Text>
          </View>
          <Text className="text-2xl font-extrabold text-white">{formatGpa(baseTotals.gano)}</Text>
        </View>
      </View>

      {/* Kayıt adı + aksiyonlar */}
      <View className="flex-row gap-2.5">
        <TextInput
          className="flex-1 bg-surface border border-line rounded-lg px-4 py-2 text-base text-ink"
          value={title}
          onChangeText={setTitle}
          maxLength={120}
          placeholder="Hesaplama adı (örn. Lisans Notlarım)"
          placeholderTextColor="#9ca3af"
        />
      </View>
      <View className="flex-row flex-wrap gap-2">
        <Pressable
          className={`flex-row items-center gap-2 bg-brand rounded-lg px-5 py-2 ${saving ? 'opacity-50' : ''}`}
          onPress={handleSaveToProfile}
          disabled={saving}
        >
          <Save size={16} color="#fff" />
          <Text className="text-white text-sm font-semibold">
            {saving ? 'Kaydediliyor...' : editingId ? 'Güncelle' : 'Profilime Kaydet'}
          </Text>
        </Pressable>
        <Pressable className="flex-row items-center gap-2 border border-line rounded-lg px-4 py-2" onPress={openImportPicker}>
          <FileUp size={16} color={isDark ? '#9ca3af' : '#374151'} />
          <Text className="text-ink2 text-sm font-semibold">Dosyadan Aktar</Text>
        </Pressable>
        <Pressable className="flex-row items-center gap-2 border border-line rounded-lg px-4 py-2" onPress={handleExport}>
          <FileDown size={16} color={isDark ? '#9ca3af' : '#374151'} />
          <Text className="text-ink2 text-sm font-semibold">Excel'e Aktar</Text>
        </Pressable>
        <Pressable className="flex-row items-center gap-2 border border-line rounded-lg px-4 py-2" onPress={handleClear}>
          <RotateCcw size={16} color={isDark ? '#9ca3af' : '#374151'} />
          <Text className="text-ink2 text-sm font-semibold">Temizle</Text>
        </Pressable>
      </View>

      {editingId && (
        <Text className="text-xs text-muted">
          Profilindeki "{title}" kaydını düzenliyorsun.{' '}
          <Text className="underline text-ink2" onPress={() => setEditingId(null)}>
            Yeni kayıt olarak kaydet
          </Text>
        </Text>
      )}

      <Pressable
        className="flex-row items-center justify-between bg-surface rounded-lg px-3.5 py-3"
        style={SHADOW_MD}
        onPress={() => setShowSaved((v) => !v)}
      >
        <Text className="text-sm font-semibold text-ink2">Kayıtlı Hesaplamalarım ({savedCalcs.length})</Text>
        <ChevronDown size={16} color={isDark ? '#9ca3af' : '#6b7280'} style={{ transform: [{ rotate: showSaved ? '180deg' : '0deg' }] }} />
      </Pressable>
      {showSaved && (
        <View className="gap-2 mb-2">
          {loadingSaved ? (
            <ActivityIndicator color={isDark ? '#5A9690' : '#2F5755'} />
          ) : savedCalcs.length === 0 ? (
            <Text className="text-muted2 text-sm py-1">Henüz kayıtlı hesaplama yok.</Text>
          ) : (
            savedCalcs.map((calc) => (
              <View key={calc.id} className="flex-row items-center bg-surface rounded-lg px-3.5 py-[11px]" style={SHADOW_MD}>
                <Pressable className="flex-1" onPress={() => handleLoadSaved(calc)}>
                  <Text className="text-sm font-semibold text-ink">{calc.title}</Text>
                  <Text className="text-xs text-muted2 mt-0.5">
                    GANO {formatGpa(calc.gpa)} · {formatDate(calc.updated_at)}
                  </Text>
                </Pressable>
                <Pressable onPress={() => handleDeleteSaved(calc)} hitSlop={8}>
                  <Trash2 size={16} color={isDark ? '#f87171' : '#dc2626'} />
                </Pressable>
              </View>
            ))
          )}
        </View>
      )}

      {/* Ders Ekle */}
      <View className="bg-surface rounded-xl p-5 border border-line-soft" style={SHADOW_MD}>
        <View className="flex-row items-center gap-2">
          <Plus size={18} color={isDark ? '#5A9690' : '#2F5755'} />
          <Text className="text-base font-semibold text-ink">Ders Ekle</Text>
        </View>
        <Pressable className="flex-row items-center gap-1.5 bg-brand rounded-lg px-4 py-2 mt-3 self-start" onPress={openAddForm}>
          <Plus size={14} color="#fff" />
          <Text className="text-white text-sm font-semibold">Ders Ekle</Text>
        </Pressable>
      </View>

      {/* Not baremi */}
      <Pressable
        className="bg-surface rounded-xl p-5 border border-line-soft"
        style={SHADOW_MD}
        onPress={() => setGradeScaleOpen((v) => !v)}
      >
        <View className="flex-row items-center justify-between flex-wrap gap-2">
          <View className="flex-row items-center gap-2">
            <ListOrdered size={18} color={isDark ? '#5A9690' : '#2F5755'} />
            <Text className="text-base font-semibold text-ink">Harf Notları ve Karşılıkları</Text>
          </View>
          <View className="flex-row items-center gap-2">
            {baseTotals.gano !== null && (
              <View className="bg-brand rounded-full px-3 py-[5px]">
                <Text className="text-white text-xs font-semibold">Genel Ortalama: {formatGpa(baseTotals.gano)}</Text>
              </View>
            )}
            <ChevronDown
              size={18}
              color={isDark ? '#9ca3af' : '#6b7280'}
              style={{ transform: [{ rotate: gradeScaleOpen ? '180deg' : '0deg' }] }}
            />
          </View>
        </View>
        {gradeScaleOpen && (
          <View className="mt-3">
            <View className="flex-row border-b border-line pb-1.5">
              <Text className="text-xs font-semibold text-muted uppercase flex-1">Not</Text>
              <Text className="text-xs font-semibold text-muted uppercase flex-1">Katsayı</Text>
              <Text className="text-xs font-semibold text-muted uppercase" style={{ flex: 1.4 }}>
                100'lük
              </Text>
            </View>
            {Object.entries(GRADE_COEFFICIENTS).map(([grade, coefficient]) => (
              <View key={grade} className="flex-row py-1.5 border-b border-line-soft">
                <Text className="text-[13.5px] font-semibold text-ink2 flex-1">{grade}</Text>
                <Text className="text-[13.5px] text-ink2 flex-1">{coefficient.toFixed(2)}</Text>
                <Text className="text-[13.5px] text-muted" style={{ flex: 1.4 }}>
                  {scoreRangeByGrade[grade] ?? '—'}
                </Text>
              </View>
            ))}
            <View className="mt-3 gap-1">
              {UNCREDITED_GRADES.map((g) => (
                <Text key={g} className="text-[11.5px] text-muted leading-[17px]">
                  <Text className="font-bold text-ink2">{g}</Text>: {UNCREDITED_LABELS[g]}
                </Text>
              ))}
            </View>
          </View>
        )}
      </Pressable>

      {/* Filtreler + ders listesi */}
      <View className="bg-surface rounded-xl p-5 border border-line-soft" style={SHADOW_MD}>
        <View className="flex-row items-center justify-between">
          <Text className="text-base font-semibold text-ink">
            Ders Listesi{' '}
            <Text className="text-sm font-normal text-muted">
              ({filteredCourses.length}/{courses.length})
            </Text>
          </Text>
        </View>
        <View className="flex-row items-center gap-1.5 mt-3">
          <Filter size={14} color={isDark ? '#9ca3af' : '#6b7280'} />
          <ScrollView
            showsVerticalScrollIndicator={false}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 6 }}
          >
            <FilterChip label="Tüm Dönemler" active={semesterFilter === 'all'} onPress={() => setSemesterFilter('all')} />
            {semesters.map((s) => (
              <FilterChip
                key={s}
                label={`${s}. Dönem`}
                active={semesterFilter === String(s)}
                onPress={() => setSemesterFilter(String(s))}
              />
            ))}
          </ScrollView>
        </View>
        <View className="flex-row items-center gap-1.5 mt-2">
          <FilterChip label="Tüm Dersler" active={statusFilter === 'all'} onPress={() => setStatusFilter('all')} />
          <FilterChip label="Başarılı" active={statusFilter === 'passed'} onPress={() => setStatusFilter('passed')} />
          <FilterChip label="Başarısız" active={statusFilter === 'failed'} onPress={() => setStatusFilter('failed')} />
        </View>

        {filteredCourses.length === 0 ? (
          <Text className="text-muted2 text-sm py-1">Gösterilecek ders yok. Yukarıdan ders ekle veya dosyadan içe aktar.</Text>
        ) : groupedFiltered ? (
          groupedFiltered.map(([semKey, semCourses]) => {
            const semGano = computeTotals(semCourses).gano;
            const isOpen = !collapsedSemesters.has(semKey);
            return (
              <View key={String(semKey)} className="mt-3">
                <Pressable
                  className="flex-row items-center gap-1.5 bg-inset rounded-md px-2.5 py-[7px]"
                  onPress={() => toggleSemesterCollapse(semKey)}
                >
                  <ChevronDown
                    size={14}
                    color={isDark ? '#5A9690' : '#2F5755'}
                    style={{ transform: [{ rotate: isOpen ? '180deg' : '0deg' }] }}
                  />
                  <Text className="text-xs font-semibold text-accent uppercase">
                    {semKey === 'diger' ? 'Diğer' : `${semKey}. Dönem`}{' '}
                    <Text className="text-muted2 font-normal normal-case">({semCourses.length} ders)</Text>
                    {semGano !== null && (
                      <Text className="text-muted2 font-normal normal-case"> · Dönem Ortalaması: {formatGpa(semGano)}</Text>
                    )}
                  </Text>
                </Pressable>
                {isOpen && (
                  <View className="gap-1.5 mt-1.5">
                    {semCourses.map((course) => (
                      <CourseRow key={course.id} course={course} onEdit={openEditForm} onDelete={handleDeleteCourse} isDark={isDark} />
                    ))}
                  </View>
                )}
              </View>
            );
          })
        ) : (
          <View className="gap-1.5 mt-3">
            {filteredCourses.map((course) => (
              <CourseRow key={course.id} course={course} onEdit={openEditForm} onDelete={handleDeleteCourse} isDark={isDark} />
            ))}
          </View>
        )}
      </View>

      {/* Senaryo hesaplama */}
      <View className="bg-surface rounded-xl p-5 border border-line-soft" style={SHADOW_MD}>
        <View className="flex-row items-center gap-2">
          <FlaskConical size={18} color={isDark ? '#5A9690' : '#2F5755'} />
          <Text className="text-base font-semibold text-ink">Senaryo Hesaplama</Text>
        </View>
        <Text className="text-sm text-muted mt-1">Bir dersten farklı not alsaydın GANO'n ne olurdu? Gerçek verin değişmez.</Text>

        <Text className="text-sm font-medium text-ink2 mb-1.5 mt-3">Ders</Text>
        <ScrollView
          showsVerticalScrollIndicator={false}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 6 }}
        >
          {availableScenarioCourses.length === 0 ? (
            <Text className="text-muted2 text-sm py-1">Uygun ders yok.</Text>
          ) : (
            availableScenarioCourses.map((c) => (
              <FilterChip
                key={c.id}
                label={`${c.name} (${c.grade})`}
                active={scenarioCourseId === c.id}
                onPress={() => setScenarioCourseId(c.id)}
              />
            ))
          )}
        </ScrollView>
        <Text className="text-sm font-medium text-ink2 mb-1.5 mt-3">Yeni not</Text>
        <View className="flex-row flex-wrap gap-2">
          {ALL_GRADES.map((g) => (
            <Pressable
              key={g}
              className={`border rounded-lg px-3 py-[7px] ${scenarioGrade === g ? 'bg-brand border-brand' : 'border-line'}`}
              onPress={() => setScenarioGrade(g)}
            >
              <Text className={`text-[12.5px] font-semibold ${scenarioGrade === g ? 'text-white' : 'text-ink2'}`}>{g}</Text>
            </Pressable>
          ))}
        </View>
        <Pressable
          className={`flex-row items-center gap-1.5 bg-brand rounded-lg px-4 py-2 mt-3 self-start ${!scenarioCourseId || !scenarioGrade ? 'opacity-50' : ''}`}
          onPress={addScenarioOverride}
          disabled={!scenarioCourseId || !scenarioGrade}
        >
          <Plus size={14} color="#fff" />
          <Text className="text-white text-sm font-semibold">Senaryoya Ekle</Text>
        </Pressable>

        {hasScenario ? (
          <View className="gap-2 mt-3">
            {overrideEntries.map(({ course, grade }) => (
              <View key={course.id} className="flex-row items-center gap-2 bg-inset rounded-lg px-3 py-2.5">
                <Text className="flex-1 text-sm font-semibold text-ink2" numberOfLines={1}>
                  {course.name}
                </Text>
                <Text className="text-[12.5px] text-muted">{course.grade}</Text>
                <Text className="text-muted2">→</Text>
                <Text className="text-[12.5px] font-bold text-accent">{grade}</Text>
                <Pressable onPress={() => removeScenarioOverride(course.id)} hitSlop={8}>
                  <X size={16} color={isDark ? '#f87171' : '#660B05'} />
                </Pressable>
              </View>
            ))}
          </View>
        ) : (
          <Text className="text-muted2 text-sm py-1 mt-3">Henüz senaryo yok. Birden fazla dersi aynı anda değiştirebilirsin.</Text>
        )}

        <View className="bg-brand rounded-xl p-5 items-center mt-4">
          <Text className="text-xs text-white/80 uppercase tracking-[0.5px]">Yeni GANO</Text>
          <Text className="text-3xl font-extrabold text-white my-1">
            {hasScenario ? formatGpa(scenarioTotals.gano) : formatGpa(baseTotals.gano)}
          </Text>
          {scenarioDelta !== null ? (
            <Text className="text-sm text-white/90">
              {scenarioDelta >= 0 ? '+' : ''}
              {scenarioDelta.toFixed(2)} (şu an {formatGpa(baseTotals.gano)})
            </Text>
          ) : (
            !hasScenario && <Text className="text-xs text-white/70">Senaryo eklediğinde güncellenir</Text>
          )}
        </View>
      </View>

      {/* Hedef GANO */}
      <View className="bg-surface rounded-xl p-5 border border-line-soft" style={SHADOW_MD}>
        <View className="flex-row items-center gap-2">
          <Target size={18} color={isDark ? '#5A9690' : '#2F5755'} />
          <Text className="text-base font-semibold text-ink">Hedef GANO</Text>
        </View>
        <Text className="text-sm text-muted mt-1">
          Hedefine ulaşmak için gelecek dönemlerde yaklaşık kaç ders gerektiğini gör. Senaryoların varsa hesaba katılır.
        </Text>
        <View className="flex-row gap-3 mt-3">
          <View className="flex-1">
            <Text className="text-sm font-medium text-ink2 mb-1.5 mt-3">Hedef</Text>
            <TextInput
              className="border border-line rounded-lg px-3 py-2 text-sm text-ink"
              value={targetGpa}
              onChangeText={setTargetGpa}
              placeholder="3.00"
              placeholderTextColor="#9ca3af"
              keyboardType="decimal-pad"
            />
          </View>
          <View className="flex-1">
            <Text className="text-sm font-medium text-ink2 mb-1.5 mt-3">Ders başına AKTS</Text>
            <TextInput
              className="border border-line rounded-lg px-3 py-2 text-sm text-ink"
              value={plannedAkts}
              onChangeText={setPlannedAkts}
              placeholderTextColor="#9ca3af"
              keyboardType="number-pad"
            />
          </View>
        </View>

        {!targetPlan ? (
          <Text className="text-muted2 text-sm py-1 mt-3">Geçerli bir hedef gir (0 - {GPA_SCALE_MAX} arası).</Text>
        ) : targetPlan.achieved ? (
          <Text className="text-sm font-medium text-accent mt-3">
            Tebrikler — mevcut GANO'n ({formatGpa(scenarioTotals.gano)}) hedefinin üzerinde.
          </Text>
        ) : (
          <View className="mt-3">
            <Text className="text-sm text-muted mt-1">
              Şu anki GANO {formatGpa(scenarioTotals.gano)}. Hedefe ulaşmak için yaklaşık olarak şunlardan birisi yeterli:
            </Text>
            <View className="flex-row flex-wrap gap-2 mt-2.5">
              {targetPlan.neededByGrade.map(({ grade, coefficient, count }) => (
                <View key={grade} className="grow bg-inset rounded-lg py-2.5 items-center" style={{ minWidth: '30%' }}>
                  <Text className="text-[11.5px] text-muted">
                    {grade} ({coefficient?.toFixed(1)})
                  </Text>
                  <Text className="text-base font-bold text-ink mt-0.5">{count === null ? 'İnandın mı?' : `${count} ders`}</Text>
                </View>
              ))}
            </View>
            <Text className="text-xs text-muted2 mt-2.5">
              "İnandın mı?": o notun katsayısı hedefin altında olduğu için yalnızca o notla hedefe ulaşılamaz.
            </Text>
          </View>
        )}
      </View>

      {/* Hızlı tahmin */}
      <View className="bg-surface rounded-xl p-5 border border-line-soft" style={SHADOW_MD}>
        <View className="flex-row items-center gap-2">
          <Sparkles size={18} color={isDark ? '#5A9690' : '#2F5755'} />
          <Text className="text-base font-semibold text-ink">Hızlı Tahmin — Ortalamam Kaç Olur?</Text>
        </View>
        <Text className="text-sm text-muted mt-1">
          Ders listesi girmene gerek yok: mevcut GANO'nu ve alacağın notları yaz, yeni ortalamanı gör.
        </Text>
        <View className="flex-row gap-3 mt-3">
          <View className="flex-1">
            <Text className="text-sm font-medium text-ink2 mb-1.5 mt-3">Mevcut GANO</Text>
            <TextInput
              className="border border-line rounded-lg px-3 py-2 text-sm text-ink"
              value={quickGano}
              onChangeText={setQuickGano}
              placeholder="3.34"
              placeholderTextColor="#9ca3af"
              keyboardType="decimal-pad"
            />
          </View>
          <View className="flex-1">
            <Text className="text-sm font-medium text-ink2 mb-1.5 mt-3">Mevcut kredili AKTS</Text>
            <TextInput
              className="border border-line rounded-lg px-3 py-2 text-sm text-ink"
              value={quickAkts}
              onChangeText={setQuickAkts}
              placeholder="120"
              placeholderTextColor="#9ca3af"
              keyboardType="number-pad"
            />
          </View>
        </View>

        {quickRows.map((row) => {
          const rowGrade = row.mode === 'score' ? scoreToGrade(row.score) : row.grade;
          return (
            <View key={row.id} className="flex-row items-center gap-2 mt-2.5 flex-wrap">
              <TextInput
                className="border border-line rounded-lg px-3 py-2 text-sm text-ink"
                style={{ width: 70 }}
                value={row.akts}
                onChangeText={(v) => setQuickRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, akts: v } : r)))}
                placeholder="AKTS"
                placeholderTextColor="#9ca3af"
                keyboardType="number-pad"
              />
              <Pressable
                className="border border-line rounded-lg px-2.5 py-[7px]"
                onPress={() =>
                  setQuickRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, mode: r.mode === 'grade' ? 'score' : 'grade' } : r)))
                }
              >
                <Text className="text-xs font-medium text-ink2">{row.mode === 'grade' ? 'Harf' : "100'lük"}</Text>
              </Pressable>
              {row.mode === 'grade' ? (
                <View className="flex-row flex-wrap gap-1 flex-1">
                  {CREDITED_GRADES.map((g) => (
                    <Pressable
                      key={g}
                      className={`border rounded-md px-2 py-1 ${row.grade === g ? 'bg-brand border-brand' : 'border-line'}`}
                      onPress={() => setQuickRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, grade: g } : r)))}
                    >
                      <Text className={`text-[11px] font-semibold ${row.grade === g ? 'text-white' : 'text-ink2'}`}>{g}</Text>
                    </Pressable>
                  ))}
                </View>
              ) : (
                <>
                  <TextInput
                    className="border border-line rounded-lg px-3 py-2 text-sm text-ink"
                    style={{ width: 60 }}
                    value={row.score}
                    onChangeText={(v) => setQuickRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, score: v } : r)))}
                    placeholder="68"
                    placeholderTextColor="#9ca3af"
                    keyboardType="number-pad"
                  />
                  {rowGrade && (
                    <View className="bg-accent-soft rounded-full px-2 py-1">
                      <Text className="text-[11px] font-bold text-accent">{rowGrade}</Text>
                    </View>
                  )}
                </>
              )}
              {quickRows.length > 1 && (
                <Pressable onPress={() => setQuickRows((prev) => prev.filter((r) => r.id !== row.id))} hitSlop={8}>
                  <X size={16} color={isDark ? '#f87171' : '#660B05'} />
                </Pressable>
              )}
            </View>
          );
        })}
        <Pressable className="flex-row items-center gap-[5px] mt-2" onPress={() => setQuickRows((prev) => [...prev, emptyQuickRow()])}>
          <Plus size={14} color={isDark ? '#5A9690' : '#2F5755'} />
          <Text className="text-sm font-medium text-accent">Ders Ekle</Text>
        </Pressable>

        <View className="bg-brand rounded-xl p-5 items-center mt-4">
          <Text className="text-xs text-white/80 uppercase tracking-[0.5px]">Tahmini Yeni GANO</Text>
          <Text className="text-3xl font-extrabold text-white my-1">{quickResult !== null ? formatGpa(quickResult.newGano) : '—'}</Text>
          {quickResult !== null ? (
            <Text className="text-sm text-white/90">
              {quickDelta! >= 0 ? '+' : ''}
              {quickDelta!.toFixed(2)} ({quickResult.addedAkts} yeni AKTS)
            </Text>
          ) : (
            <Text className="text-xs text-white/70">GANO, AKTS ve en az bir ders gir</Text>
          )}
        </View>
      </View>

      {/* İstatistikler + grafikler */}
      <View className="flex-row flex-wrap gap-2.5">
        <StatCard icon={FileSpreadsheet} label="Toplam Ders" value={String(stats.totalCourses)} isDark={isDark} />
        <StatCard
          icon={CheckCircle2}
          label="Başarı Oranı"
          value={stats.successRate === null ? '—' : `%${stats.successRate.toFixed(0)}`}
          isDark={isDark}
        />
        <StatCard icon={CheckCircle2} label="Başarılı Ders" value={String(stats.passedCourses)} isDark={isDark} />
        <StatCard icon={XCircle} label="Başarısız Ders" value={String(stats.failedCourses)} isDark={isDark} />
        <StatCard
          icon={Layers}
          label="Ort. AKTS / Dönem"
          value={stats.avgAktsPerSemester === null ? '—' : stats.avgAktsPerSemester.toFixed(1)}
          isDark={isDark}
        />
      </View>

      <View className="bg-surface rounded-xl p-5 border border-line-soft" style={SHADOW_MD}>
        <Text className="text-[13.5px] font-semibold text-ink mb-3">Dönem Bazlı GANO</Text>
        {stats.semesterRows.length === 0 ? (
          <Text className="text-muted2 text-sm py-1">Veri yok.</Text>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false} horizontal showsHorizontalScrollIndicator={false}>
            <View className="flex-row items-end gap-3.5 h-40 pr-2">
              {stats.semesterRows.map((row) => (
                <View key={row.semester} className="items-center" style={{ width: 52 }}>
                  <Text className="text-[11px] font-semibold text-ink2 mb-1">{formatGpa(row.gano)}</Text>
                  <View className="w-7 justify-end" style={{ height: 110 }}>
                    <View
                      className="w-full bg-brand rounded-t"
                      style={{ height: `${((row.gano ?? 0) / GPA_SCALE_MAX) * 100}%`, minHeight: 2 }}
                    />
                  </View>
                  <Text className="text-[10.5px] text-muted mt-1.5 text-center">{row.semester}. Dönem</Text>
                </View>
              ))}
            </View>
          </ScrollView>
        )}
      </View>

      <View className="bg-surface rounded-xl p-5 border border-line-soft" style={SHADOW_MD}>
        <Text className="text-[13.5px] font-semibold text-ink mb-3">Harf Notu Dağılımı (ders sayısı)</Text>
        {distributionRows.length === 0 ? (
          <Text className="text-muted2 text-sm py-1">Veri yok.</Text>
        ) : (
          <View className="gap-2">
            {distributionRows.map(({ grade, count }) => (
              <View key={grade} className="flex-row items-center gap-2">
                <Text className="w-[30px] text-xs font-semibold text-ink2">{grade}</Text>
                <View className="flex-1 h-4 bg-inset rounded overflow-hidden">
                  <View
                    className={`h-full rounded ${isFailGrade(grade) ? 'bg-fail' : isCreditedGrade(grade) ? 'bg-brand' : 'bg-muted2'}`}
                    style={{ width: `${(count / maxDistCount) * 100}%` }}
                  />
                </View>
                <Text className="w-[22px] text-xs text-ink2 text-right">{count}</Text>
              </View>
            ))}
          </View>
        )}
      </View>

      <View className="bg-surface rounded-xl p-5 border border-line-soft" style={SHADOW_MD}>
        <Text className="text-[13.5px] font-semibold text-ink mb-3">Başarılı / Başarısız AKTS</Text>
        {judgedAkts === 0 ? (
          <Text className="text-muted2 text-sm py-1">Veri yok.</Text>
        ) : (
          <View>
            <View className="flex-row h-6 rounded-lg overflow-hidden gap-px">
              {baseTotals.passedAkts > 0 && <View className="bg-brand" style={{ flex: baseTotals.passedAkts }} />}
              {baseTotals.failedAkts > 0 && (
                <View style={{ flex: baseTotals.failedAkts, backgroundColor: isDark ? '#dc2626' : '#8C1007' }} />
              )}
            </View>
            <View className="flex-row flex-wrap gap-4 mt-3">
              <View className="flex-row items-center gap-1.5">
                <View className="w-3 h-3 rounded-[3px]" style={{ backgroundColor: isDark ? '#5A9690' : '#2F5755' }} />
                <Text className="text-sm text-ink2">
                  Başarılı: <Text className="font-bold">{baseTotals.passedAkts} AKTS</Text>
                </Text>
              </View>
              <View className="flex-row items-center gap-1.5">
                <View className="w-3 h-3 rounded-[3px]" style={{ backgroundColor: isDark ? '#dc2626' : '#8C1007' }} />
                <Text className="text-sm text-ink2">
                  Başarısız: <Text className="font-bold">{baseTotals.failedAkts} AKTS</Text>
                </Text>
              </View>
            </View>
          </View>
        )}
      </View>

      <Text className="text-xs text-muted2 leading-4">
        GANO = Σ(AKTS × katsayı) / Σ(kredili AKTS), 2 ondalıkla gösterilir. Kredisiz notlar (G, K, H, M) ortalamaya katılmaz; G ve M
        başarılı, K başarısız AKTS'ye sayılır.
      </Text>

      {/* Ders ekleme/düzenleme modalı */}
      <Modal visible={showForm} transparent animationType="fade" onRequestClose={() => setShowForm(false)}>
        <KeyboardAvoider>
          <View className="flex-1 bg-black/50 justify-center p-4">
            <View className="bg-surface rounded-2xl p-5 max-h-[88%]">
              <View className="flex-row items-center justify-between">
                <Text className="text-xl font-bold text-ink flex-1 pr-3">{editingCourseId ? 'Dersi Düzenle' : 'Ders Ekle'}</Text>
                <Pressable onPress={() => setShowForm(false)} hitSlop={8}>
                  <X size={20} color={isDark ? '#9ca3af' : '#6b7280'} />
                </Pressable>
              </View>
              <ScrollView showsVerticalScrollIndicator={false} style={{ marginTop: 12 }}>
                <Text className="text-sm font-medium text-gray-700 mb-1.5 mt-3">Ders Adı *</Text>
                <TextInput
                  className="border border-line rounded-lg px-3 py-2 text-sm text-ink"
                  value={draft.name}
                  onChangeText={(v) => setDraft((d) => ({ ...d, name: v }))}
                  maxLength={120}
                  placeholder="Örn: Matematik I"
                  placeholderTextColor="#9ca3af"
                />
                <Text className="text-sm font-medium text-gray-700 mb-1.5 mt-3">Ders Kodu (ops.)</Text>
                <TextInput
                  className="border border-line rounded-lg px-3 py-2 text-sm text-ink"
                  value={draft.code}
                  onChangeText={(v) => setDraft((d) => ({ ...d, code: v }))}
                  maxLength={20}
                  placeholder="Örn: MAT101"
                  placeholderTextColor="#9ca3af"
                  autoCapitalize="characters"
                />
                <View className="flex-row gap-2.5">
                  <View className="flex-1">
                    <Text className="text-sm font-medium text-gray-700 mb-1.5 mt-3">Dönem</Text>
                    <TextInput
                      className="border border-line rounded-lg px-3 py-2 text-sm text-ink"
                      value={draft.semester}
                      onChangeText={(v) => setDraft((d) => ({ ...d, semester: v.replace(/[^0-9]/g, '') }))}
                      keyboardType="number-pad"
                      maxLength={2}
                    />
                  </View>
                  <View className="flex-1">
                    <Text className="text-sm font-medium text-gray-700 mb-1.5 mt-3">AKTS *</Text>
                    <TextInput
                      className="border border-line rounded-lg px-3 py-2 text-sm text-ink"
                      value={draft.akts}
                      onChangeText={(v) => setDraft((d) => ({ ...d, akts: v.replace(/[^0-9]/g, '') }))}
                      keyboardType="number-pad"
                      maxLength={2}
                    />
                  </View>
                </View>

                <View className="flex-row gap-2 mt-3">
                  <Pressable
                    className={`flex-1 items-center py-2 rounded-lg border ${draft.mode === 'grade' ? 'bg-brand border-brand' : 'border-line'}`}
                    onPress={() => setDraft((d) => ({ ...d, mode: 'grade' }))}
                  >
                    <Text className={`text-sm font-medium ${draft.mode === 'grade' ? 'text-white' : 'text-ink2'}`}>Harf Notu</Text>
                  </Pressable>
                  <Pressable
                    className={`flex-1 items-center py-2 rounded-lg border ${draft.mode === 'score' ? 'bg-brand border-brand' : 'border-line'}`}
                    onPress={() => setDraft((d) => ({ ...d, mode: 'score' }))}
                  >
                    <Text className={`text-sm font-medium ${draft.mode === 'score' ? 'text-white' : 'text-ink2'}`}>100'lük Not</Text>
                  </Pressable>
                </View>

                {draft.mode === 'grade' ? (
                  <>
                    <Text className="text-sm font-medium text-ink2 mb-1.5 mt-3">Not *</Text>
                    <View className="flex-row flex-wrap gap-2">
                      {ALL_GRADES.map((g) => (
                        <Pressable
                          key={g}
                          className={`border rounded-lg px-3 py-[7px] ${draft.grade === g ? 'bg-brand border-brand' : 'border-line'}`}
                          onPress={() => setDraft((d) => ({ ...d, grade: g }))}
                        >
                          <Text className={`text-[12.5px] font-semibold ${draft.grade === g ? 'text-white' : 'text-ink2'}`}>{g}</Text>
                        </Pressable>
                      ))}
                    </View>
                  </>
                ) : (
                  <>
                    <Text className="text-sm font-medium text-ink2 mb-1.5 mt-3">100'lük Not *</Text>
                    <View className="flex-row items-center gap-2.5">
                      <TextInput
                        className="border border-line rounded-lg px-3 py-2 text-sm text-ink"
                        style={{ width: 90 }}
                        value={draft.score}
                        onChangeText={(v) => setDraft((d) => ({ ...d, score: v.replace(/[^0-9]/g, '') }))}
                        keyboardType="number-pad"
                        maxLength={3}
                        placeholder="68"
                        placeholderTextColor="#9ca3af"
                      />
                      {effectiveDraftGrade && CREDITED_GRADES.includes(effectiveDraftGrade) && (
                        <View className="bg-accent-soft rounded-full px-2 py-1">
                          <Text className="text-[11px] font-bold text-accent">{effectiveDraftGrade}</Text>
                        </View>
                      )}
                    </View>
                  </>
                )}
              </ScrollView>
              <Pressable className="bg-brand rounded-lg items-center py-3 mt-4" onPress={handleSaveDraft}>
                <Text className="text-white text-sm font-semibold">{editingCourseId ? 'Güncelle' : 'Ekle'}</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoider>
      </Modal>

      {/* İçe aktarma modalı */}
      <Modal visible={showImport} transparent animationType="fade" onRequestClose={() => setShowImport(false)}>
        <KeyboardAvoider>
          <View className="flex-1 bg-black/50 justify-center p-4">
            <View className="bg-surface rounded-2xl p-5 max-h-[88%]">
              <View className="flex-row items-center justify-between">
                <Text className="text-xl font-bold text-ink flex-1 pr-3">AKTS İçe Aktar (Excel / CSV)</Text>
                <Pressable onPress={() => setShowImport(false)} hitSlop={8}>
                  <X size={20} color={isDark ? '#9ca3af' : '#6b7280'} />
                </Pressable>
              </View>
              <ScrollView showsVerticalScrollIndicator={false} style={{ marginTop: 12 }}>
                <Text className="text-sm text-muted mt-1">
                  Beklenen kolonlar: Ders | Dönem | AKTS | Not (Kod isteğe bağlı; büyük/küçük harf fark etmez, ilk sayfa okunur).
                </Text>
                <Pressable
                  className="border-2 border-line border-dashed rounded-xl py-6 items-center gap-2 mt-3"
                  onPress={handleImportFile}
                >
                  <Upload size={22} color={isDark ? '#9ca3af' : '#6b7280'} />
                  <Text className="text-[13.5px] font-medium text-ink2">
                    {importParsing ? 'Okunuyor...' : 'xlsx / xls / csv dosyası seç'}
                  </Text>
                </Pressable>

                {importPreview && (
                  <View className="mt-4 gap-2.5">
                    <Text className="text-[13.5px] font-semibold text-ink">Aktarılacak dersler ({importPreview.valid.length})</Text>
                    {importPreview.valid.length === 0 ? (
                      <Text className="text-muted2 text-sm py-1">Geçerli satır yok.</Text>
                    ) : (
                      <View className="gap-1.5">
                        {importPreview.valid.map((c, i) => (
                          <View key={i} className="bg-inset rounded-lg px-3 py-2">
                            <Text className="text-sm text-gray-800 font-medium" numberOfLines={1}>
                              {c.code ? `${c.code} · ` : ''}
                              {c.lessonName}
                            </Text>
                            <Text className="text-[11.5px] text-muted mt-0.5">
                              {c.semester}. Dönem · {c.akts} AKTS · {c.grade}
                            </Text>
                          </View>
                        ))}
                      </View>
                    )}
                    {importPreview.errors.length > 0 && (
                      <View>
                        <View className="flex-row items-center gap-1.5 mb-1.5">
                          <AlertTriangle size={15} color={isDark ? '#dc2626' : '#8C1007'} />
                          <Text className="text-sm font-semibold text-fail">Hatalı satırlar ({importPreview.errors.length})</Text>
                        </View>
                        {importPreview.errors.map((err, i) => (
                          <Text key={i} className="text-[12.5px] text-ink2 mb-1">
                            Satır {err.rowNumber}
                            {err.lessonName ? ` (${err.lessonName})` : ''}: {err.message}
                          </Text>
                        ))}
                      </View>
                    )}
                  </View>
                )}
              </ScrollView>
              <View className="flex-row gap-2.5 mt-4">
                <Pressable className="py-3 px-5 rounded-lg border border-line items-center" onPress={() => setShowImport(false)}>
                  <Text className="text-ink2 text-sm font-semibold">Vazgeç</Text>
                </Pressable>
                <Pressable
                  className={`flex-1 items-center rounded-lg bg-brand py-3 ${!importPreview || importPreview.valid.length === 0 ? 'opacity-50' : ''}`}
                  onPress={handleConfirmImport}
                  disabled={!importPreview || importPreview.valid.length === 0}
                >
                  <Text className="text-white text-sm font-semibold">Onayla ({importPreview?.valid.length ?? 0} ders)</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </KeyboardAvoider>
      </Modal>
    </KeyboardAwareScroll>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  isDark,
  info,
}: {
  icon: any;
  label: string;
  value: string;
  isDark: boolean;
  info?: string;
}) {
  return (
    <View className="w-[47.5%] bg-surface rounded-lg p-4" style={SHADOW_MD}>
      <View className="flex-row items-center gap-1.5 mb-1">
        <Icon size={16} color={isDark ? '#5A9690' : '#2F5755'} />
        <Text className="text-xs font-medium text-muted flex-1" numberOfLines={1}>
          {label}
        </Text>
      </View>
      <Text className="text-2xl font-extrabold text-ink">{value}</Text>
      {!!info && (
        <Pressable
          onPress={() => Alert.alert(label, info)}
          hitSlop={8}
          className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full items-center justify-center bg-inset"
        >
          <Info size={12} color={isDark ? '#5A9690' : '#2F5755'} />
        </Pressable>
      )}
    </View>
  );
}

function FilterChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable className={`px-3 py-1.5 rounded-lg ${active ? 'bg-brand' : 'bg-inset'}`} onPress={onPress}>
      <Text className={`text-[12.5px] font-medium ${active ? 'text-white' : 'text-muted'}`}>{label}</Text>
    </Pressable>
  );
}

function CourseRow({
  course,
  onEdit,
  onDelete,
  isDark,
}: {
  course: Course;
  onEdit: (c: Course) => void;
  onDelete: (c: Course) => void;
  isDark: boolean;
}) {
  const coefficient = getCoefficient(course.grade);
  const qualityPoints = coefficient === null ? null : Number(course.akts) * coefficient;
  const failed = isFailGrade(course.grade);
  const credited = isCreditedGrade(course.grade);
  return (
    <View className="flex-row items-center bg-surface rounded-lg border border-line-soft px-3 py-2.5">
      <Pressable className="flex-1" onPress={() => onEdit(course)}>
        <Text className="text-[13.5px] font-semibold text-ink">
          {course.code ? <Text className="text-gray-400 font-normal">{course.code} · </Text> : null}
          {course.name}
        </Text>
        <Text className="text-[11px] text-muted2 mt-[3px]">
          {course.semester}. Dönem · {course.akts} AKTS · Katsayı {coefficient === null ? '—' : coefficient.toFixed(1)} · Kalite{' '}
          {qualityPoints === null ? '—' : qualityPoints.toLocaleString('tr-TR')} · 100'lük {gradeToScoreRange(course.grade) ?? '—'}
        </Text>
      </Pressable>
      <View className={`rounded-full px-2.5 py-1 ${failed ? 'bg-fail-soft' : credited ? 'bg-accent-soft' : 'bg-inset'}`}>
        <Text className="text-xs font-bold text-ink2">{course.grade}</Text>
      </View>
      <Pressable onPress={() => onEdit(course)} hitSlop={8} className="ml-2.5">
        <Pencil size={16} color={isDark ? '#5A9690' : '#2F5755'} />
      </Pressable>
      <Pressable onPress={() => onDelete(course)} hitSlop={8} className="ml-2.5">
        <Trash2 size={16} color={isDark ? '#f87171' : '#660B05'} />
      </Pressable>
    </View>
  );
}
