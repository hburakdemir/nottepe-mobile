import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ChevronRight, Library, Search } from 'lucide-react-native';
import { faculties, departments } from '../../data/departments';
import type { RootStackParamList } from '../../navigation/types';

export default function DepartmentsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedFaculty, setExpandedFaculty] = useState<string | null>(null);

  const filteredFaculties = useMemo(() => {
    const term = searchTerm.toLowerCase();
    if (!term) return faculties;
    return faculties.filter((faculty) => {
      const matchesFaculty = faculty.toLowerCase().includes(term);
      const matchesDepartment = departments[faculty]?.some((dept) => dept.toLowerCase().includes(term));
      return matchesFaculty || matchesDepartment;
    });
  }, [searchTerm]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Fakülteler ve Bölümler</Text>
        <Text style={styles.subtitle}>Fakülte ve bölümlere göre notları inceleyin</Text>
      </View>

      <View style={styles.searchBox}>
        <Search size={18} color="#4f7d7a" />
        <TextInput
          style={styles.searchInput}
          placeholder="Fakülte veya bölüm ara..."
          placeholderTextColor="#9ca3af"
          value={searchTerm}
          onChangeText={setSearchTerm}
        />
      </View>

      <FlatList
        style={styles.list}
        contentContainerStyle={styles.listContent}
        data={filteredFaculties}
        keyExtractor={(item) => item}
        ListEmptyComponent={<Text style={styles.empty}>Arama sonucu bulunamadı.</Text>}
        renderItem={({ item: faculty }) => {
          const isExpanded = expandedFaculty === faculty;
          return (
            <View style={styles.facultyCard}>
              <Pressable
                style={styles.facultyHeader}
                onPress={() => setExpandedFaculty(isExpanded ? null : faculty)}
              >
                <View style={styles.facultyHeaderLeft}>
                  <Library size={20} color="#4f7d7a" />
                  <Text style={styles.facultyTitle}>{faculty}</Text>
                </View>
                <ChevronRight
                  size={18}
                  color="#2F5755"
                  style={{ transform: [{ rotate: isExpanded ? '90deg' : '0deg' }] }}
                />
              </Pressable>

              {isExpanded && (
                <View style={styles.deptGrid}>
                  {departments[faculty]?.map((department) => (
                    <Pressable
                      key={department}
                      style={styles.deptChip}
                      onPress={() => navigation.navigate('DepartmentDetail', { faculty, department })}
                    >
                      <Text style={styles.deptChipText}>{department}</Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  header: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  title: { fontSize: 24, fontWeight: '700', color: '#111827' },
  subtitle: { fontSize: 13.5, color: '#6b7280', marginTop: 4 },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 4,
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  searchInput: { flex: 1, fontSize: 14, color: '#111827' },
  list: { flex: 1 },
  listContent: { padding: 16, gap: 10 },
  empty: { textAlign: 'center', color: '#9ca3af', marginTop: 40 },
  facultyCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },
  facultyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  facultyHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  facultyTitle: { fontSize: 15, fontWeight: '600', color: '#111827', flexShrink: 1 },
  deptGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 14,
    paddingBottom: 14,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    paddingTop: 12,
  },
  deptChip: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  deptChipText: { fontSize: 12.5, color: '#374151', fontWeight: '500' },
});
