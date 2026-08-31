import React, { useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { AlertTriangle, CalendarDays, Trash2, X } from 'lucide-react-native';
import { conflictsForCourse, COURSE_COLORS, DAY_NAMES, makeCourseId, toMinutes, type ScheduleCourse } from '../../utils/schedule';

interface Props {
  initial: ScheduleCourse | null;
  courses: ScheduleCourse[];
  onSave: (course: ScheduleCourse) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export default function CourseFormModal({ initial, courses, onSave, onDelete, onClose }: Props) {
  const isEdit = !!initial;
  const [name, setName] = useState(initial?.name || '');
  const [day, setDay] = useState(initial?.day || 1);
  const [start, setStart] = useState(initial?.start || '09:00');
  const [end, setEnd] = useState(initial?.end || '10:50');
  const [location, setLocation] = useState(initial?.location || '');
  const [colorIdx, setColorIdx] = useState(initial?.colorIdx ?? 0);

  const candidate: ScheduleCourse = { id: initial?.id || 'aday', name, day, start, end, location, colorIdx };
  const timesValid = TIME_RE.test(start) && TIME_RE.test(end) && toMinutes(end) > toMinutes(start);
  const conflicts = timesValid ? conflictsForCourse(candidate, courses) : [];

  const handleSubmit = () => {
    if (!name.trim()) {
      Alert.alert('Hata', 'Ders adı gerekli.');
      return;
    }
    if (!TIME_RE.test(start) || !TIME_RE.test(end)) {
      Alert.alert('Hata', 'Saatleri SS:DD biçiminde gir (örn. 09:00).');
      return;
    }
    if (!timesValid) {
      Alert.alert('Hata', 'Bitiş saati başlangıçtan sonra olmalı.');
      return;
    }
    onSave({ ...candidate, id: initial?.id || makeCourseId(), name: name.trim(), location: location.trim() });
    onClose();
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.headerRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <CalendarDays size={18} color="#2F5755" />
              <Text style={styles.title}>{isEdit ? 'Dersi Düzenle' : 'Ders Ekle'}</Text>
            </View>
            <Pressable onPress={onClose} hitSlop={8}>
              <X size={20} color="#6b7280" />
            </Pressable>
          </View>

          <ScrollView style={{ marginTop: 14 }}>
            <Text style={styles.label}>Ders adı *</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              maxLength={80}
              placeholder="Örn: MAT123 Matematik I"
              placeholderTextColor="#9ca3af"
            />

            <Text style={styles.label}>Gün *</Text>
            <View style={styles.dayGrid}>
              {Object.entries(DAY_NAMES).map(([v, label]) => (
                <Pressable
                  key={v}
                  style={[styles.dayChip, day === Number(v) && styles.dayChipActive]}
                  onPress={() => setDay(Number(v))}
                >
                  <Text style={[styles.dayChipText, day === Number(v) && styles.dayChipTextActive]}>{label}</Text>
                </Pressable>
              ))}
            </View>

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Başlangıç *</Text>
                <TextInput
                  style={styles.input}
                  value={start}
                  onChangeText={setStart}
                  placeholder="09:00"
                  placeholderTextColor="#9ca3af"
                  maxLength={5}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Bitiş *</Text>
                <TextInput
                  style={styles.input}
                  value={end}
                  onChangeText={setEnd}
                  placeholder="10:50"
                  placeholderTextColor="#9ca3af"
                  maxLength={5}
                />
              </View>
            </View>

            <Text style={styles.label}>Konum (isteğe bağlı)</Text>
            <TextInput
              style={styles.input}
              value={location}
              onChangeText={setLocation}
              maxLength={60}
              placeholder="Örn: Derslik B2-201"
              placeholderTextColor="#9ca3af"
            />

            <Text style={styles.label}>Renk</Text>
            <View style={styles.colorRow}>
              {COURSE_COLORS.map((c, i) => (
                <Pressable
                  key={c.name}
                  onPress={() => setColorIdx(i)}
                  style={[styles.swatch, { backgroundColor: c.hex }, colorIdx === i && styles.swatchActive]}
                />
              ))}
            </View>

            {conflicts.length > 0 && (
              <View style={styles.conflictBox}>
                <AlertTriangle size={15} color="#dc2626" />
                <Text style={styles.conflictText}>
                  Bu saatler şu derslerle çakışıyor: {conflicts.map((c) => c.name).join(', ')}. Yine de kaydedebilirsin.
                </Text>
              </View>
            )}
          </ScrollView>

          <View style={styles.actionsRow}>
            <Pressable style={styles.saveBtn} onPress={handleSubmit}>
              <Text style={styles.saveBtnText}>{isEdit ? 'Kaydet' : 'Ekle'}</Text>
            </Pressable>
            {isEdit && (
              <Pressable
                style={styles.deleteBtn}
                onPress={() => {
                  onDelete(initial!.id);
                  onClose();
                }}
                hitSlop={8}
              >
                <Trash2 size={18} color="#dc2626" />
              </Pressable>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 16 },
  sheet: { backgroundColor: '#fff', borderRadius: 16, padding: 20, maxHeight: '88%' },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 17, fontWeight: '700', color: '#111827' },
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
  dayGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  dayChip: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7 },
  dayChipActive: { backgroundColor: '#2F5755', borderColor: '#2F5755' },
  dayChipText: { fontSize: 12, fontWeight: '600', color: '#374151' },
  dayChipTextActive: { color: '#fff' },
  colorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  swatch: { width: 30, height: 30, borderRadius: 15, opacity: 0.75 },
  swatchActive: { opacity: 1, borderWidth: 2, borderColor: '#111827' },
  conflictBox: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 10,
    padding: 10,
    marginTop: 14,
  },
  conflictText: { flex: 1, fontSize: 11.5, color: '#dc2626', lineHeight: 16 },
  actionsRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
  saveBtn: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 10, backgroundColor: '#2F5755' },
  saveBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  deleteBtn: {
    width: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
});
