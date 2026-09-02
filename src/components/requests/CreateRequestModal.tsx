import React, { useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { HeartHandshake, X } from 'lucide-react-native';
import { noteRequestAPI } from '../../lib/api';
import { faculties, departments } from '../../data/departments';
import { useTheme } from '../../context/ThemeContext';

interface Props {
  onClose: () => void;
  onCreated: () => void;
}

export default function CreateRequestModal({ onClose, onCreated }: Props) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [faculty, setFaculty] = useState('');
  const [department, setDepartment] = useState('');
  const [courseName, setCourseName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [showFacultyPicker, setShowFacultyPicker] = useState(false);
  const [showDeptPicker, setShowDeptPicker] = useState(false);

  const handleSubmit = async () => {
    if (!faculty || !department || !courseName.trim()) {
      Alert.alert('Hata', 'Fakülte, bölüm ve ders adı zorunlu');
      return;
    }
    setSaving(true);
    try {
      await noteRequestAPI.create({
        faculty,
        department,
        course_name: courseName.trim(),
        description: description.trim(),
      });
      onCreated();
      onClose();
    } catch (err: any) {
      Alert.alert('Hata', err.response?.data?.message || 'İstek oluşturulamadı');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View className="bg-primary dark:bg-darkbgbutton" style={styles.sheet}>
          <View style={styles.headerRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <HeartHandshake size={20} color={isDark ? '#5A9690' : '#2F5755'} />
              <Text className="text-gray-900 dark:text-darktext" style={styles.title}>Not İsteği Oluştur</Text>
            </View>
            <Pressable onPress={onClose} hitSlop={8}>
              <X size={20} color={isDark ? '#9ca3af' : '#6b7280'} />
            </Pressable>
          </View>

          <ScrollView style={{ marginTop: 14 }}>
            <Text className="text-gray-900 dark:text-darktext" style={styles.label}>Fakülte *</Text>
            <Pressable className="border-gray-200 dark:border-gray-600" style={styles.selectBox} onPress={() => setShowFacultyPicker(true)}>
              <Text className={faculty ? 'text-gray-900 dark:text-darktext' : 'text-gray-500 dark:text-gray-400'} style={styles.selectText}>{faculty || 'Fakülte seç'}</Text>
            </Pressable>

            <Text className="text-gray-900 dark:text-darktext" style={styles.label}>Bölüm *</Text>
            <Pressable className="border-gray-200 dark:border-gray-600" style={[styles.selectBox, !faculty && { opacity: 0.5 }]} onPress={() => faculty && setShowDeptPicker(true)}>
              <Text className={department ? 'text-gray-900 dark:text-darktext' : 'text-gray-500 dark:text-gray-400'} style={styles.selectText}>{department || 'Bölüm seç'}</Text>
            </Pressable>

            <Text className="text-gray-900 dark:text-darktext" style={styles.label}>Ders adı *</Text>
            <TextInput
              className="text-gray-900 dark:text-darktext border-gray-200 dark:border-gray-600"
              style={styles.input}
              value={courseName}
              onChangeText={setCourseName}
              maxLength={150}
              placeholder="Örn: MAT123 Matematik I vize notu"
              placeholderTextColor="#9ca3af"
            />

            <Text className="text-gray-900 dark:text-darktext" style={styles.label}>Açıklama (isteğe bağlı)</Text>
            <TextInput
              className="text-gray-900 dark:text-darktext border-gray-200 dark:border-gray-600"
              style={[styles.input, styles.textArea]}
              value={description}
              onChangeText={setDescription}
              maxLength={1000}
              multiline
              placeholder="Hangi dönem, hangi hoca, vize mi final mi..."
              placeholderTextColor="#9ca3af"
            />
          </ScrollView>

          <Pressable style={[styles.submitBtn, saving && { opacity: 0.6 }]} onPress={handleSubmit} disabled={saving}>
            <Text style={styles.submitBtnText}>{saving ? 'Yayınlanıyor...' : 'İsteği Yayınla'}</Text>
          </Pressable>
        </View>
      </View>

      <Modal visible={showFacultyPicker} transparent animationType="slide" onRequestClose={() => setShowFacultyPicker(false)}>
        <Pressable style={styles.pickerOverlay} onPress={() => setShowFacultyPicker(false)}>
          <View className="bg-primary dark:bg-darkbgbutton" style={styles.pickerSheet}>
            <ScrollView>
              {faculties.map((f) => (
                <Pressable
                  key={f}
                  className="border-gray-100 dark:border-gray-700/40"
                  style={styles.pickerOption}
                  onPress={() => {
                    setFaculty(f);
                    setDepartment('');
                    setShowFacultyPicker(false);
                  }}
                >
                  <Text className="text-gray-900 dark:text-darktext" style={styles.pickerOptionText}>{f}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>

      <Modal visible={showDeptPicker} transparent animationType="slide" onRequestClose={() => setShowDeptPicker(false)}>
        <Pressable style={styles.pickerOverlay} onPress={() => setShowDeptPicker(false)}>
          <View className="bg-primary dark:bg-darkbgbutton" style={styles.pickerSheet}>
            <ScrollView>
              {(departments[faculty] || []).map((d) => (
                <Pressable
                  key={d}
                  className="border-gray-100 dark:border-gray-700/40"
                  style={styles.pickerOption}
                  onPress={() => {
                    setDepartment(d);
                    setShowDeptPicker(false);
                  }}
                >
                  <Text className="text-gray-900 dark:text-darktext" style={styles.pickerOptionText}>{d}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 16 },
  sheet: { borderRadius: 12, padding: 24, maxHeight: '85%' },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 20, fontWeight: '800' },
  label: { fontSize: 14, fontWeight: '500', marginBottom: 4, marginTop: 14 },
  input: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 9, fontSize: 14 },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  selectBox: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 11 },
  selectText: { fontSize: 14 },
  selectPlaceholder: { fontSize: 14 },
  submitBtn: { backgroundColor: '#2F5755', borderRadius: 8, alignItems: 'center', paddingVertical: 10, marginTop: 16 },
  submitBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  pickerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  pickerSheet: { borderTopLeftRadius: 16, borderTopRightRadius: 16, paddingVertical: 8, maxHeight: '70%' },
  pickerOption: { paddingHorizontal: 20, paddingVertical: 13, borderBottomWidth: 1 },
  pickerOptionText: { fontSize: 14.5 },
});
