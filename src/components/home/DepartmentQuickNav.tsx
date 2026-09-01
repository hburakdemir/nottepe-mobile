import React, { useEffect, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ChevronDown, GraduationCap, X } from 'lucide-react-native';
import { faculties as ALL_FACULTIES, departments as DEPARTMENTS_BY_FACULTY } from '../../data/departments';
import type { RootStackParamList } from '../../navigation/types';

const LAST_FACULTY_KEY = 'nottepe_last_faculty';

// Web'in home/DepartmentQuickNav.jsx'inin birebir karşılığı — Ana Sayfa'da
// varsayılan kapalı, açılınca fakülte seç + bölüm chip'leri, dokununca
// DepartmentDetail'e gidiyor. Web'de eksikti, burada eklendi.
export default function DepartmentQuickNav() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedFaculty, setSelectedFaculty] = useState('');
  const [showPicker, setShowPicker] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(LAST_FACULTY_KEY)
      .then((v) => {
        if (v) setSelectedFaculty(v);
      })
      .catch(() => {});
  }, []);

  const handleSelect = (faculty: string) => {
    setSelectedFaculty(faculty);
    setShowPicker(false);
    AsyncStorage.setItem(LAST_FACULTY_KEY, faculty).catch(() => {});
  };

  const facultyDepartments = selectedFaculty ? DEPARTMENTS_BY_FACULTY[selectedFaculty] || [] : [];

  return (
    <View style={styles.card}>
      <Pressable style={styles.header} onPress={() => setIsOpen((v) => !v)}>
        <View style={styles.headerLeft}>
          <GraduationCap size={18} color="#2F5755" />
          <Text style={styles.headerTitle}>Bölümünü Seç</Text>
        </View>
        <View style={{ transform: [{ rotate: isOpen ? '180deg' : '0deg' }] }}>
          <ChevronDown size={18} color="#9ca3af" />
        </View>
      </Pressable>

      {isOpen && (
        <View style={styles.body}>
          <Pressable style={styles.facultySelect} onPress={() => setShowPicker(true)}>
            <Text style={selectedFaculty ? styles.facultySelectText : styles.facultySelectPlaceholder} numberOfLines={1}>
              {selectedFaculty || 'Fakülte seçin...'}
            </Text>
            <ChevronDown size={16} color="#6b7280" />
          </Pressable>

          {!!selectedFaculty && (
            <View style={styles.chipRow}>
              {facultyDepartments.length === 0 ? (
                <Text style={styles.emptyText}>Bu fakülte için bölüm bulunamadı.</Text>
              ) : (
                facultyDepartments.map((department) => (
                  <Pressable
                    key={department}
                    style={styles.chip}
                    onPress={() => navigation.navigate('DepartmentDetail', { faculty: selectedFaculty, department })}
                  >
                    <Text style={styles.chipText}>{department}</Text>
                  </Pressable>
                ))
              )}
            </View>
          )}
        </View>
      )}

      <Modal visible={showPicker} transparent animationType="fade" onRequestClose={() => setShowPicker(false)}>
        <Pressable style={styles.overlay} onPress={() => setShowPicker(false)}>
          <View style={styles.sheet}>
            <View style={styles.sheetHeaderRow}>
              <Text style={styles.sheetTitle}>Fakülte seç</Text>
              <Pressable onPress={() => setShowPicker(false)} hitSlop={8}>
                <X size={20} color="#6b7280" />
              </Pressable>
            </View>
            <FlatList
              data={ALL_FACULTIES}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <Pressable style={styles.optionRow} onPress={() => handleSelect(item)}>
                  <Text style={[styles.optionText, selectedFaculty === item && styles.optionTextActive]}>{item}</Text>
                </Pressable>
              )}
            />
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 8,
    marginBottom: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: { fontSize: 14, fontWeight: '700', color: '#111827' },
  body: { paddingHorizontal: 16, paddingBottom: 16, paddingTop: 4, borderTopWidth: 1, borderTopColor: '#f3f4f6' },
  facultySelect: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  facultySelectText: { fontSize: 13.5, color: '#111827', flex: 1 },
  facultySelectPlaceholder: { fontSize: 13.5, color: '#6b7280', flex: 1 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  emptyText: { fontSize: 13, color: '#9ca3af' },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: '#2F575550',
  },
  chipText: { fontSize: 12.5, color: '#2F5755' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 18, borderTopRightRadius: 18, maxHeight: '70%', padding: 16 },
  sheetHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  sheetTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },
  optionRow: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  optionText: { fontSize: 14, color: '#374151' },
  optionTextActive: { color: '#2F5755', fontWeight: '700' },
});
