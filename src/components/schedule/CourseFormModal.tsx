import React, { useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { AlertTriangle, CalendarDays, Trash2, X } from 'lucide-react-native';
import { conflictsForCourse, COURSE_COLORS, DAY_NAMES, makeCourseId, toMinutes, type ScheduleCourse } from '../../utils/schedule';
import { useTheme } from '../../context/ThemeContext';
import KeyboardAvoider from '../layout/KeyboardAvoider';

interface Props {
  initial: ScheduleCourse | null;
  courses: ScheduleCourse[];
  onSave: (course: ScheduleCourse) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export default function CourseFormModal({ initial, courses, onSave, onDelete, onClose }: Props) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const brandColor = isDark ? '#5A9690' : '#2F5755';
  const mutedColor = isDark ? '#9ca3af' : '#6b7280';
  const dangerColor = isDark ? '#f87171' : '#dc2626';
  const placeholderColor = isDark ? '#6b7280' : '#9ca3af';
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
      <KeyboardAvoider>
        <View style={styles.overlay}>
          <View className="bg-surface" style={styles.sheet}>
            <View style={styles.headerRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <CalendarDays size={18} color={brandColor} />
                <Text className="text-ink" style={styles.title}>
                  {isEdit ? 'Dersi Düzenle' : 'Ders Ekle'}
                </Text>
              </View>
              <Pressable onPress={onClose} hitSlop={8}>
                <X size={20} color={mutedColor} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ marginTop: 14 }}>
              <Text className="text-muted" style={styles.label}>
                Ders adı *
              </Text>
              <TextInput
                className="border-line bg-inset text-ink"
                style={styles.input}
                value={name}
                onChangeText={setName}
                maxLength={80}
                placeholder="Örn: MAT123 Matematik I"
                placeholderTextColor={placeholderColor}
              />

              <Text className="text-muted" style={styles.label}>
                Gün *
              </Text>
              <View style={styles.dayGrid}>
                {Object.entries(DAY_NAMES).map(([v, label]) => {
                  const active = day === Number(v);
                  return (
                    <Pressable
                      key={v}
                      className="border-line"
                      style={[styles.dayChip, active && { backgroundColor: brandColor, borderColor: brandColor }]}
                      onPress={() => setDay(Number(v))}
                    >
                      <Text className={active ? undefined : 'text-muted'} style={[styles.dayChipText, active && { color: '#fff' }]}>
                        {label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text className="text-muted" style={styles.label}>
                    Başlangıç *
                  </Text>
                  <TextInput
                    className="border-line bg-inset text-ink"
                    style={styles.input}
                    value={start}
                    onChangeText={setStart}
                    placeholder="09:00"
                    placeholderTextColor={placeholderColor}
                    maxLength={5}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text className="text-muted" style={styles.label}>
                    Bitiş *
                  </Text>
                  <TextInput
                    className="border-line bg-inset text-ink"
                    style={styles.input}
                    value={end}
                    onChangeText={setEnd}
                    placeholder="10:50"
                    placeholderTextColor={placeholderColor}
                    maxLength={5}
                  />
                </View>
              </View>

              <Text className="text-muted" style={styles.label}>
                Konum (isteğe bağlı)
              </Text>
              <TextInput
                className="border-line bg-inset text-ink"
                style={styles.input}
                value={location}
                onChangeText={setLocation}
                maxLength={60}
                placeholder="Örn: Derslik B2-201"
                placeholderTextColor={placeholderColor}
              />

              <Text className="text-muted" style={styles.label}>
                Renk
              </Text>
              <View style={styles.colorRow}>
                {COURSE_COLORS.map((c, i) => (
                  <Pressable
                    key={c.name}
                    onPress={() => setColorIdx(i)}
                    style={[
                      styles.swatch,
                      { backgroundColor: c.hex },
                      colorIdx === i && { opacity: 1, borderWidth: 2, borderColor: isDark ? '#DFD0B8' : '#111827' },
                    ]}
                  />
                ))}
              </View>

              {conflicts.length > 0 && (
                <View className="bg-danger-soft border-danger-line" style={styles.conflictBox}>
                  <AlertTriangle size={15} color={dangerColor} />
                  <Text className="text-danger" style={styles.conflictText}>
                    Bu saatler şu derslerle çakışıyor: {conflicts.map((c) => c.name).join(', ')}. Yine de kaydedebilirsin.
                  </Text>
                </View>
              )}
            </ScrollView>

            <View style={styles.actionsRow}>
              <Pressable className="bg-accent" style={styles.saveBtn} onPress={handleSubmit}>
                <Text style={styles.saveBtnText}>{isEdit ? 'Kaydet' : 'Ekle'}</Text>
              </Pressable>
              {isEdit && (
                <Pressable
                  className="border-danger-line"
                  style={styles.deleteBtn}
                  onPress={() => {
                    onDelete(initial!.id);
                    onClose();
                  }}
                  hitSlop={8}
                >
                  <Trash2 size={18} color={dangerColor} />
                </Pressable>
              )}
            </View>
          </View>
        </View>
      </KeyboardAvoider>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 16 },
  sheet: { borderRadius: 16, padding: 20, maxHeight: '88%' },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 20, fontWeight: '800' },
  label: { fontSize: 12.5, fontWeight: '600', marginBottom: 6, marginTop: 12 },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 14,
  },
  dayGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  dayChip: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7 },
  dayChipText: { fontSize: 12, fontWeight: '600' },
  colorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  swatch: { width: 30, height: 30, borderRadius: 15, opacity: 0.75 },
  conflictBox: {
    flexDirection: 'row',
    gap: 8,
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    marginTop: 14,
  },
  conflictText: { flex: 1, fontSize: 11.5, lineHeight: 16 },
  actionsRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
  saveBtn: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 10 },
  saveBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  deleteBtn: {
    width: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    borderWidth: 1,
  },
});
