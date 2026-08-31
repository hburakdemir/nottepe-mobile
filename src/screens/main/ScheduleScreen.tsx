import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AlertTriangle, MapPin, Plus, Share2 } from 'lucide-react-native';
import { scheduleAPI } from '../../lib/api';
import CourseFormModal from '../../components/schedule/CourseFormModal';
import {
  DAY_NAMES,
  findConflictIds,
  getCourseColor,
  sanitizeCourse,
  toMinutes,
  type ScheduleCourse,
} from '../../utils/schedule';

const DAYS = [1, 2, 3, 4, 5, 6];

export default function ScheduleScreen() {
  const [courses, setCourses] = useState<ScheduleCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalCourse, setModalCourse] = useState<ScheduleCourse | 'new' | null>(null);
  const [shareId, setShareId] = useState<string | null>(null);
  const [shareEnabled, setShareEnabled] = useState(false);
  const [sharing, setSharing] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await scheduleAPI.getMine();
        const loaded = Array.isArray(res.data?.courses)
          ? res.data.courses.map(sanitizeCourse).filter(Boolean)
          : [];
        setCourses(loaded as ScheduleCourse[]);
        setShareId(res.data?.shareId || null);
        setShareEnabled(!!res.data?.shareEnabled);
      } catch {
        Alert.alert('Hata', 'Program yüklenemedi.');
      } finally {
        setLoading(false);
      }
    })();
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  const conflictIds = useMemo(() => findConflictIds(courses), [courses]);

  const persist = (next: ScheduleCourse[]) => {
    setCourses(next);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        const res = await scheduleAPI.save(next);
        setShareId(res.data?.shareId || null);
        setShareEnabled(!!res.data?.shareEnabled);
      } catch {
        Alert.alert('Hata', 'Program sunucuya kaydedilemedi.');
      }
    }, 500);
  };

  const handleSaveCourse = (course: ScheduleCourse) => {
    const exists = courses.some((c) => c.id === course.id);
    const next = exists ? courses.map((c) => (c.id === course.id ? course : c)) : [...courses, course];
    persist(next);
  };

  const handleDeleteCourse = (id: string) => {
    persist(courses.filter((c) => c.id !== id));
  };

  const handleToggleShare = async () => {
    setSharing(true);
    try {
      const res = await scheduleAPI.setShare(!shareEnabled);
      setShareId(res.data?.shareId || null);
      setShareEnabled(!!res.data?.shareEnabled);
    } catch {
      Alert.alert('Hata', 'Paylaşım ayarlanamadı. Önce programını kaydet.');
    } finally {
      setSharing(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#1d4ed8" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable style={styles.shareRow} onPress={handleToggleShare} disabled={sharing}>
          <Share2 size={16} color="#2F5755" />
          <Text style={styles.shareText}>
            {sharing ? 'Güncelleniyor…' : shareEnabled ? 'Paylaşım açık — kapatmak için dokun' : 'Programını paylaş'}
          </Text>
        </Pressable>
        {shareEnabled && shareId && (
          <Text selectable style={styles.shareLink}>
            nottepe.com/program/paylasilan/{shareId}
          </Text>
        )}

        {courses.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>Henüz ders eklenmedi.</Text>
          </View>
        ) : (
          DAYS.map((day) => {
            const dayCourses = courses
              .filter((c) => c.day === day)
              .sort((a, b) => toMinutes(a.start) - toMinutes(b.start));
            if (dayCourses.length === 0) return null;
            return (
              <View key={day} style={styles.dayCard}>
                <Text style={styles.dayTitle}>{DAY_NAMES[day]}</Text>
                <View style={{ gap: 8 }}>
                  {dayCourses.map((c) => {
                    const color = getCourseColor(c.colorIdx);
                    const conflicted = conflictIds.has(c.id);
                    return (
                      <Pressable
                        key={c.id}
                        style={[styles.courseRow, conflicted && styles.courseRowConflict]}
                        onPress={() => setModalCourse(c)}
                      >
                        <View style={[styles.colorBar, { backgroundColor: color.hex }]} />
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                            {conflicted && <AlertTriangle size={13} color="#dc2626" />}
                            <Text style={styles.courseName} numberOfLines={1}>
                              {c.name}
                            </Text>
                          </View>
                          <View style={styles.courseMetaRow}>
                            <Text style={styles.courseMeta}>
                              {c.start}–{c.end}
                            </Text>
                            {!!c.location && (
                              <>
                                <MapPin size={11} color="#9ca3af" />
                                <Text style={styles.courseMeta}>{c.location}</Text>
                              </>
                            )}
                          </View>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      <Pressable style={styles.fab} onPress={() => setModalCourse('new')}>
        <Plus size={20} color="#fff" />
        <Text style={styles.fabText}>Ders Ekle</Text>
      </Pressable>

      {modalCourse && (
        <CourseFormModal
          initial={modalCourse === 'new' ? null : modalCourse}
          courses={courses}
          onSave={handleSaveCourse}
          onDelete={handleDeleteCourse}
          onClose={() => setModalCourse(null)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 16, paddingBottom: 90 },
  shareRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#2F575519',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    marginBottom: 6,
  },
  shareText: { fontSize: 12.5, fontWeight: '600', color: '#2F5755' },
  shareLink: { fontSize: 11.5, color: '#1d4ed8', marginBottom: 14, paddingHorizontal: 4 },
  emptyBox: { alignItems: 'center', marginTop: 60 },
  emptyText: { color: '#9ca3af', fontSize: 14 },
  dayCard: { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginTop: 14 },
  dayTitle: { fontSize: 14.5, fontWeight: '700', color: '#111827', marginBottom: 10 },
  courseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: '#f3f4f6',
    borderRadius: 10,
    padding: 10,
  },
  courseRowConflict: { borderColor: '#fecaca', backgroundColor: '#fef2f2' },
  colorBar: { width: 4, height: 34, borderRadius: 2 },
  courseName: { fontSize: 13.5, fontWeight: '600', color: '#111827', flexShrink: 1 },
  courseMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  courseMeta: { fontSize: 11.5, color: '#6b7280' },
  fab: {
    position: 'absolute',
    bottom: 20,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#2F5755',
    borderRadius: 100,
    paddingHorizontal: 20,
    paddingVertical: 13,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  fabText: { color: '#fff', fontSize: 13.5, fontWeight: '700' },
});
