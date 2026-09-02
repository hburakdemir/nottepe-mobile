import React, { useEffect, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ChevronDown, GraduationCap, X } from 'lucide-react-native';
import { faculties as ALL_FACULTIES, departments as DEPARTMENTS_BY_FACULTY } from '../../data/departments';
import { useTheme } from '../../context/ThemeContext';
import type { RootStackParamList } from '../../navigation/types';

const LAST_FACULTY_KEY = 'nottepe_last_faculty';

// Web'in home/DepartmentQuickNav.jsx'inin birebir karşılığı — Ana Sayfa'da
// varsayılan kapalı, açılınca fakülte seç + bölüm chip'leri, dokununca
// DepartmentDetail'e gidiyor. Web'de eksikti, burada eklendi.
export default function DepartmentQuickNav() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
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
    <View className="bg-primary dark:bg-darkbgbutton" style={styles.card}>
      <Pressable style={styles.header} onPress={() => setIsOpen((v) => !v)}>
        <View style={styles.headerLeft}>
          <GraduationCap size={18} color={isDark ? '#5A9690' : '#2F5755'} />
          <Text className="text-gray-900 dark:text-darktext" style={styles.headerTitle}>Bölümünü Seç</Text>
        </View>
        <View style={{ transform: [{ rotate: isOpen ? '180deg' : '0deg' }] }}>
          <ChevronDown size={18} color={isDark ? '#6b7280' : '#9ca3af'} />
        </View>
      </Pressable>

      {isOpen && (
        <View className="border-gray-100 dark:border-gray-700/40" style={styles.body}>
          <Pressable className="border-gray-300 dark:border-gray-600" style={styles.facultySelect} onPress={() => setShowPicker(true)}>
            <Text
              className={selectedFaculty ? 'text-gray-900 dark:text-darktext' : 'text-gray-500 dark:text-gray-400'}
              style={styles.facultySelectText}
              numberOfLines={1}
            >
              {selectedFaculty || 'Fakülte seçin...'}
            </Text>
            <ChevronDown size={16} color={isDark ? '#9ca3af' : '#6b7280'} />
          </Pressable>

          {!!selectedFaculty && (
            <View style={styles.chipRow}>
              {facultyDepartments.length === 0 ? (
                <Text className="text-gray-400 dark:text-gray-500" style={styles.emptyText}>Bu fakülte için bölüm bulunamadı.</Text>
              ) : (
                facultyDepartments.map((department) => (
                  <Pressable
                    key={department}
                    className="border-brand/30 dark:border-brand-light/40"
                    style={styles.chip}
                    onPress={() => navigation.navigate('DepartmentDetail', { faculty: selectedFaculty, department })}
                  >
                    <Text className="text-brand dark:text-brand-light" style={styles.chipText}>{department}</Text>
                  </Pressable>
                ))
              )}
            </View>
          )}
        </View>
      )}

      <Modal visible={showPicker} transparent animationType="fade" onRequestClose={() => setShowPicker(false)}>
        <Pressable style={styles.overlay} onPress={() => setShowPicker(false)}>
          <View className="bg-primary dark:bg-darkbgbutton" style={styles.sheet}>
            <View style={styles.sheetHeaderRow}>
              <Text className="text-gray-900 dark:text-darktext" style={styles.sheetTitle}>Fakülte seç</Text>
              <Pressable onPress={() => setShowPicker(false)} hitSlop={8}>
                <X size={20} color={isDark ? '#9ca3af' : '#6b7280'} />
              </Pressable>
            </View>
            <FlatList
              data={ALL_FACULTIES}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <Pressable className="border-gray-100 dark:border-gray-700/40" style={styles.optionRow} onPress={() => handleSelect(item)}>
                  <Text
                    className={selectedFaculty === item ? 'text-brand dark:text-brand-light font-bold' : 'text-gray-700 dark:text-darktext'}
                    style={styles.optionText}
                  >
                    {item}
                  </Text>
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
  headerTitle: { fontSize: 14, fontWeight: '700' },
  body: { paddingHorizontal: 16, paddingBottom: 16, paddingTop: 4, borderTopWidth: 1 },
  facultySelect: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  facultySelectText: { fontSize: 13.5, flex: 1 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  emptyText: { fontSize: 13 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 100,
    borderWidth: 1,
  },
  chipText: { fontSize: 12.5 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 18, borderTopRightRadius: 18, maxHeight: '70%', padding: 16 },
  sheetHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  sheetTitle: { fontSize: 16, fontWeight: '700' },
  optionRow: { paddingVertical: 12, borderBottomWidth: 1 },
  optionText: { fontSize: 14 },
});
