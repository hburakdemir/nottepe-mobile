import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, Text, TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ChevronRight, Library, Search } from 'lucide-react-native';
import { faculties, departments } from '../../data/departments';
import type { RootStackParamList } from '../../navigation/types';

const SHADOW_MD = {
  shadowColor: '#000',
  shadowOpacity: 0.1,
  shadowRadius: 8,
  shadowOffset: { width: 0, height: 3 },
  elevation: 3,
};

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
    <View className="flex-1 bg-primary">
      <View className="px-4 pt-4">
        <Text className="text-4xl font-bold text-gray-900 mb-4">Fakülteler ve Bölümler</Text>
        <Text className="text-base font-normal text-gray-500">Fakülte ve bölümlere göre notları inceleyin</Text>
      </View>

      <View className="bg-white rounded-lg mx-4 mt-8 mb-1 p-6" style={SHADOW_MD}>
        <View className="flex-row items-center gap-2 bg-white rounded-lg px-3 py-2.5 border border-gray-300">
          <Search size={20} color="#5A9690" />
          <TextInput
            className="flex-1 text-sm text-gray-900"
            placeholder="Fakülte veya bölüm ara..."
            placeholderTextColor="#9ca3af"
            value={searchTerm}
            onChangeText={setSearchTerm}
          />
        </View>
      </View>

      <FlatList
        className="flex-1"
        contentContainerStyle={{ padding: 16, gap: 10 }}
        data={filteredFaculties}
        keyExtractor={(item) => item}
        ListEmptyComponent={<Text className="text-center text-gray-400 mt-10">Arama sonucu bulunamadı.</Text>}
        renderItem={({ item: faculty }) => {
          const isExpanded = expandedFaculty === faculty;
          return (
            <View className="bg-white rounded-lg mb-2.5 overflow-hidden" style={SHADOW_MD}>
              <Pressable
                className="flex-row items-center justify-between px-3.5 py-3.5"
                onPress={() => setExpandedFaculty(isExpanded ? null : faculty)}
              >
                <View className="flex-row items-center gap-2.5 flex-1">
                  <Library size={24} color="#5A9690" />
                  <Text className="text-lg font-semibold text-gray-900 flex-shrink">{faculty}</Text>
                </View>
                <ChevronRight
                  size={20}
                  color="#2F5755"
                  style={{ transform: [{ rotate: isExpanded ? '90deg' : '0deg' }] }}
                />
              </Pressable>

              {isExpanded && (
                <View className="gap-2 px-3.5 pb-3.5 border-t border-gray-200 pt-3 bg-gray-50">
                  {departments[faculty]?.map((department) => (
                    <Pressable
                      key={department}
                      className="bg-white border border-gray-400 rounded-lg p-3"
                      onPress={() => navigation.navigate('DepartmentDetail', { faculty, department })}
                    >
                      <Text className="text-sm text-gray-700 font-medium">{department}</Text>
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
