import React, { useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { HeartHandshake, X } from 'lucide-react-native';
import { noteRequestAPI } from '../../lib/api';
import { faculties, departments } from '../../data/departments';

interface Props {
  onClose: () => void;
  onCreated: () => void;
}

export default function CreateRequestModal({ onClose, onCreated }: Props) {
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
        <View style={styles.sheet}>
          <View style={styles.headerRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <HeartHandshake size={18} color="#2F5755" />
              <Text style={styles.title}>Not İsteği Oluştur</Text>
            </View>
            <Pressable onPress={onClose} hitSlop={8}>
              <X size={20} color="#6b7280" />
            </Pressable>
          </View>

          <ScrollView style={{ marginTop: 14 }}>
            <Text style={styles.label}>Fakülte *</Text>
            <Pressable style={styles.selectBox} onPress={() => setShowFacultyPicker(true)}>
              <Text style={faculty ? styles.selectText : styles.selectPlaceholder}>{faculty || 'Fakülte seç'}</Text>
            </Pressable>

            <Text style={styles.label}>Bölüm *</Text>
            <Pressable style={[styles.selectBox, !faculty && { opacity: 0.5 }]} onPress={() => faculty && setShowDeptPicker(true)}>
              <Text style={department ? styles.selectText : styles.selectPlaceholder}>{department || 'Bölüm seç'}</Text>
            </Pressable>

            <Text style={styles.label}>Ders adı *</Text>
            <TextInput
              style={styles.input}
              value={courseName}
              onChangeText={setCourseName}
              maxLength={150}
              placeholder="Örn: MAT123 Matematik I vize notu"
              placeholderTextColor="#9ca3af"
            />

            <Text style={styles.label}>Açıklama (isteğe bağlı)</Text>
            <TextInput
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
          <View style={styles.pickerSheet}>
            <ScrollView>
              {faculties.map((f) => (
                <Pressable
                  key={f}
                  style={styles.pickerOption}
                  onPress={() => {
                    setFaculty(f);
                    setDepartment('');
                    setShowFacultyPicker(false);
                  }}
                >
                  <Text style={styles.pickerOptionText}>{f}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>

      <Modal visible={showDeptPicker} transparent animationType="slide" onRequestClose={() => setShowDeptPicker(false)}>
        <Pressable style={styles.pickerOverlay} onPress={() => setShowDeptPicker(false)}>
          <View style={styles.pickerSheet}>
            <ScrollView>
              {(departments[faculty] || []).map((d) => (
                <Pressable
                  key={d}
                  style={styles.pickerOption}
                  onPress={() => {
                    setDepartment(d);
                    setShowDeptPicker(false);
                  }}
                >
                  <Text style={styles.pickerOptionText}>{d}</Text>
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
  sheet: { backgroundColor: '#fff', borderRadius: 16, padding: 20, maxHeight: '85%' },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 17, fontWeight: '700', color: '#111827' },
  label: { fontSize: 12.5, fontWeight: '600', color: '#374151', marginBottom: 6, marginTop: 14 },
  input: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: '#111827' },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  selectBox: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 12 },
  selectText: { fontSize: 14, color: '#111827' },
  selectPlaceholder: { fontSize: 14, color: '#9ca3af' },
  submitBtn: { backgroundColor: '#2F5755', borderRadius: 10, alignItems: 'center', paddingVertical: 13, marginTop: 16 },
  submitBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  pickerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  pickerSheet: { backgroundColor: '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16, paddingVertical: 8, maxHeight: '70%' },
  pickerOption: { paddingHorizontal: 20, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  pickerOptionText: { fontSize: 14.5, color: '#374151' },
});
