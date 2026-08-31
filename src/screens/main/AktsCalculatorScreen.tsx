import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRoute } from '@react-navigation/native';
import {
  CheckCircle2,
  ChevronDown,
  GraduationCap,
  Layers,
  Plus,
  Save,
  Sigma,
  Trash2,
  X,
  XCircle,
} from 'lucide-react-native';
import { aktsAPI } from '../../lib/api';
import type { RootStackParamList } from '../../navigation/types';
import {
  ALL_GRADES,
  computeTotals,
  coursesToServerData,
  formatGpa,
  isFailGrade,
  isPassGrade,
  makeCourseId,
  serverDataToCourses,
  type Course,
} from '../../utils/gano';

interface SavedCalc {
  id: number;
  title: string;
  gpa: number | null;
  updated_at: string;
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function emptyDraft(): { name: string; semester: string; akts: string; grade: string } {
  return { name: '', semester: '1', akts: '', grade: '' };
}

export default function AktsCalculatorScreen() {
  const route = useRoute<any>();
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

  const totals = useMemo(() => computeTotals(courses), [courses]);
  const grouped = useMemo(() => {
    const bySemester = new Map<number, Course[]>();
    for (const c of courses) {
      const sem = Number(c.semester) || 1;
      if (!bySemester.has(sem)) bySemester.set(sem, []);
      bySemester.get(sem)!.push(c);
    }
    return [...bySemester.entries()].sort(([a], [b]) => a - b);
  }, [courses]);

  const openAddForm = () => {
    setEditingCourseId(null);
    setDraft(emptyDraft());
    setShowForm(true);
  };

  const openEditForm = (course: Course) => {
    setEditingCourseId(course.id);
    setDraft({ name: course.name, semester: String(course.semester), akts: String(course.akts), grade: course.grade });
    setShowForm(true);
  };

  const handleSaveDraft = () => {
    const name = draft.name.trim();
    const semester = Math.max(1, parseInt(draft.semester, 10) || 1);
    const akts = Number(draft.akts);
    if (!name) {
      Alert.alert('Hata', 'Ders adı gerekli.');
      return;
    }
    if (!Number.isFinite(akts) || akts <= 0) {
      Alert.alert('Hata', 'Geçerli bir AKTS gir.');
      return;
    }
    if (!draft.grade) {
      Alert.alert('Hata', 'Not seç.');
      return;
    }
    if (editingCourseId) {
      setCourses((prev) =>
        prev.map((c) => (c.id === editingCourseId ? { ...c, name, semester, akts, grade: draft.grade } : c))
      );
    } else {
      setCourses((prev) => [...prev, { id: makeCourseId(), name, semester, akts, grade: draft.grade }]);
    }
    setShowForm(false);
  };

  const handleDeleteCourse = (course: Course) => {
    Alert.alert('Dersi sil', `"${course.name}" dersini silmek istediğine emin misin?`, [
      { text: 'Vazgeç', style: 'cancel' },
      { text: 'Sil', style: 'destructive', onPress: () => setCourses((prev) => prev.filter((c) => c.id !== course.id)) },
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
      gpa: totals.gano !== null ? Number(totals.gano.toFixed(2)) : null,
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

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <View style={styles.statCardHeader}>
            <Layers size={14} color="#2F5755" />
            <Text style={styles.statCardLabel}>Toplam AKTS</Text>
          </View>
          <Text style={styles.statCardValue}>{totals.totalAkts.toLocaleString('tr-TR')}</Text>
        </View>
        <View style={styles.statCard}>
          <View style={styles.statCardHeader}>
            <CheckCircle2 size={14} color="#2F5755" />
            <Text style={styles.statCardLabel}>Başarılı AKTS</Text>
          </View>
          <Text style={styles.statCardValue}>{totals.passedAkts.toLocaleString('tr-TR')}</Text>
        </View>
        <View style={styles.statCard}>
          <View style={styles.statCardHeader}>
            <XCircle size={14} color="#2F5755" />
            <Text style={styles.statCardLabel}>Başarısız AKTS</Text>
          </View>
          <Text style={styles.statCardValue}>{totals.failedAkts.toLocaleString('tr-TR')}</Text>
        </View>
        <View style={styles.statCard}>
          <View style={styles.statCardHeader}>
            <Sigma size={14} color="#2F5755" />
            <Text style={styles.statCardLabel}>Toplam Kalite Puanı</Text>
          </View>
          <Text style={styles.statCardValue}>
            {totals.qualityPoints.toLocaleString('tr-TR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
          </Text>
        </View>
        <View style={[styles.statCard, styles.ganoCard]}>
          <View style={styles.statCardHeader}>
            <GraduationCap size={14} color="#fff" />
            <Text style={[styles.statCardLabel, { color: '#E0D9D9' }]}>GANO</Text>
          </View>
          <Text style={[styles.statCardValue, { color: '#fff' }]}>{formatGpa(totals.gano)}</Text>
        </View>
      </View>

      <View style={styles.titleRow}>
        <TextInput
          style={styles.titleInput}
          value={title}
          onChangeText={setTitle}
          maxLength={120}
          placeholder="Hesaplama adı"
          placeholderTextColor="#9ca3af"
        />
        <Pressable style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={handleSaveToProfile} disabled={saving}>
          <Save size={15} color="#fff" />
          <Text style={styles.saveBtnText}>{saving ? '...' : editingId ? 'Güncelle' : 'Kaydet'}</Text>
        </Pressable>
      </View>
      {editingId && (
        <Pressable onPress={handleNewCalc}>
          <Text style={styles.newCalcLink}>Profilindeki bir kaydı düzenliyorsun — yeni kayıt başlat</Text>
        </Pressable>
      )}

      <Pressable style={styles.savedToggle} onPress={() => setShowSaved((v) => !v)}>
        <Text style={styles.savedToggleText}>Kayıtlı Hesaplamalarım ({savedCalcs.length})</Text>
        <ChevronDown size={16} color="#6b7280" style={{ transform: [{ rotate: showSaved ? '180deg' : '0deg' }] }} />
      </Pressable>
      {showSaved && (
        <View style={{ gap: 8, marginBottom: 8 }}>
          {loadingSaved ? (
            <ActivityIndicator color="#1d4ed8" />
          ) : savedCalcs.length === 0 ? (
            <Text style={styles.emptyText}>Henüz kayıtlı hesaplama yok.</Text>
          ) : (
            savedCalcs.map((calc) => (
              <View key={calc.id} style={styles.savedRow}>
                <Pressable style={{ flex: 1 }} onPress={() => handleLoadSaved(calc)}>
                  <Text style={styles.savedTitle}>{calc.title}</Text>
                  <Text style={styles.savedMeta}>
                    GANO {formatGpa(calc.gpa)} · {formatDate(calc.updated_at)}
                  </Text>
                </Pressable>
                <Pressable onPress={() => handleDeleteSaved(calc)} hitSlop={8}>
                  <Trash2 size={16} color="#dc2626" />
                </Pressable>
              </View>
            ))
          )}
        </View>
      )}

      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionHeader}>Ders Listesi ({courses.length})</Text>
        <Pressable style={styles.addBtn} onPress={openAddForm}>
          <Plus size={14} color="#fff" />
          <Text style={styles.addBtnText}>Ders Ekle</Text>
        </Pressable>
      </View>

      {courses.length === 0 ? (
        <Text style={styles.emptyText}>Henüz ders eklenmedi.</Text>
      ) : (
        grouped.map(([semester, semCourses]) => (
          <View key={semester} style={{ marginBottom: 14 }}>
            <Text style={styles.semesterLabel}>{semester}. Dönem</Text>
            {semCourses.map((course) => (
              <Pressable key={course.id} style={styles.courseRow} onPress={() => openEditForm(course)}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.courseName}>{course.name}</Text>
                  <Text style={styles.courseMeta}>{course.akts} AKTS</Text>
                </View>
                <View
                  style={[
                    styles.gradeBadge,
                    isPassGrade(course.grade) && styles.gradeBadgePass,
                    isFailGrade(course.grade) && styles.gradeBadgeFail,
                  ]}
                >
                  <Text style={styles.gradeBadgeText}>{course.grade}</Text>
                </View>
                <Pressable onPress={() => handleDeleteCourse(course)} hitSlop={8} style={{ marginLeft: 10 }}>
                  <Trash2 size={16} color="#dc2626" />
                </Pressable>
              </Pressable>
            ))}
          </View>
        ))
      )}

      <Text style={styles.footnote}>
        GANO = Σ(AKTS × katsayı) / Σ(kredili AKTS). Kredisiz notlar (G, K, H, M) ortalamaya katılmaz; G ve M
        başarılı, K başarısız AKTS'ye sayılır.
      </Text>

      <Modal visible={showForm} transparent animationType="fade" onRequestClose={() => setShowForm(false)}>
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <View style={styles.headerRow}>
              <Text style={styles.sheetTitle}>{editingCourseId ? 'Dersi Düzenle' : 'Ders Ekle'}</Text>
              <Pressable onPress={() => setShowForm(false)} hitSlop={8}>
                <X size={20} color="#6b7280" />
              </Pressable>
            </View>
            <ScrollView style={{ marginTop: 12 }}>
              <Text style={styles.label}>Ders Adı *</Text>
              <TextInput
                style={styles.input}
                value={draft.name}
                onChangeText={(v) => setDraft((d) => ({ ...d, name: v }))}
                maxLength={120}
                placeholder="Örn: Matematik I"
                placeholderTextColor="#9ca3af"
              />
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Dönem</Text>
                  <TextInput
                    style={styles.input}
                    value={draft.semester}
                    onChangeText={(v) => setDraft((d) => ({ ...d, semester: v.replace(/[^0-9]/g, '') }))}
                    keyboardType="number-pad"
                    maxLength={2}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>AKTS *</Text>
                  <TextInput
                    style={styles.input}
                    value={draft.akts}
                    onChangeText={(v) => setDraft((d) => ({ ...d, akts: v.replace(/[^0-9]/g, '') }))}
                    keyboardType="number-pad"
                    maxLength={2}
                  />
                </View>
              </View>
              <Text style={styles.label}>Not *</Text>
              <View style={styles.gradeGrid}>
                {ALL_GRADES.map((g) => (
                  <Pressable
                    key={g}
                    style={[styles.gradeChip, draft.grade === g && styles.gradeChipActive]}
                    onPress={() => setDraft((d) => ({ ...d, grade: g }))}
                  >
                    <Text style={[styles.gradeChipText, draft.grade === g && styles.gradeChipTextActive]}>{g}</Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>
            <Pressable style={styles.formSaveBtn} onPress={handleSaveDraft}>
              <Text style={styles.formSaveBtnText}>{editingCourseId ? 'Güncelle' : 'Ekle'}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  content: { padding: 16, paddingBottom: 40 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  statCard: {
    width: '47.5%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
  },
  statCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  statCardLabel: { fontSize: 11.5, fontWeight: '600', color: '#4b5563' },
  statCardValue: { fontSize: 20, fontWeight: '700', color: '#111827' },
  ganoCard: { width: '100%', backgroundColor: '#2F5755' },
  titleRow: { flexDirection: 'row', gap: 10, marginBottom: 8 },
  titleInput: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#111827',
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#2F5755',
    borderRadius: 10,
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
  saveBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  newCalcLink: { fontSize: 11.5, color: '#1d4ed8', marginBottom: 14 },
  savedToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 6,
    marginBottom: 10,
  },
  savedToggleText: { fontSize: 13, fontWeight: '600', color: '#374151' },
  savedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  savedTitle: { fontSize: 13, fontWeight: '600', color: '#111827' },
  savedMeta: { fontSize: 11, color: '#9ca3af', marginTop: 2 },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, marginBottom: 10 },
  sectionHeader: { fontSize: 15, fontWeight: '700', color: '#111827' },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#2F5755', borderRadius: 100, paddingHorizontal: 12, paddingVertical: 7 },
  addBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  emptyText: { color: '#9ca3af', fontSize: 13, paddingVertical: 8 },
  semesterLabel: { fontSize: 11.5, fontWeight: '700', color: '#9ca3af', letterSpacing: 0.5, marginBottom: 6 },
  courseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 6,
  },
  courseName: { fontSize: 13.5, fontWeight: '600', color: '#111827' },
  courseMeta: { fontSize: 11.5, color: '#9ca3af', marginTop: 2 },
  gradeBadge: { backgroundColor: '#f3f4f6', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  gradeBadgePass: { backgroundColor: '#dcfce7' },
  gradeBadgeFail: { backgroundColor: '#fee2e2' },
  gradeBadgeText: { fontSize: 12, fontWeight: '700', color: '#374151' },
  footnote: { fontSize: 11, color: '#9ca3af', marginTop: 12, lineHeight: 16 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 16 },
  sheet: { backgroundColor: '#fff', borderRadius: 16, padding: 20, maxHeight: '85%' },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sheetTitle: { fontSize: 17, fontWeight: '700', color: '#111827' },
  label: { fontSize: 12.5, fontWeight: '600', color: '#374151', marginBottom: 6, marginTop: 12 },
  input: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 14,
    color: '#111827',
  },
  gradeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  gradeChip: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  gradeChipActive: { backgroundColor: '#2F5755', borderColor: '#2F5755' },
  gradeChipText: { fontSize: 12.5, fontWeight: '600', color: '#374151' },
  gradeChipTextActive: { color: '#fff' },
  formSaveBtn: { backgroundColor: '#2F5755', borderRadius: 10, alignItems: 'center', paddingVertical: 12, marginTop: 16 },
  formSaveBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});
