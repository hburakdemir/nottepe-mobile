import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, Text, TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ChevronRight, Library, Search } from 'lucide-react-native';
import { faculties, departments } from '../../data/departments';
import { useTheme } from '../../context/ThemeContext';
import type { RootStackParamList } from '../../navigation/types';
import { TAB_BAR_SAFE_PADDING } from '../../components/layout/tabBarMetrics';

const SHADOW_MD = {
  shadowColor: '#000',
  shadowOpacity: 0.1,
  shadowRadius: 8,
  shadowOffset: { width: 0, height: 3 },
  elevation: 3,
};

export default function DepartmentsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { theme, colors } = useTheme();
  const isDark = theme === 'dark';
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedFaculty, setExpandedFaculty] = useState<string | null>(null);

  const term = searchTerm.trim().toLowerCase();

  const filteredFaculties = useMemo(() => {
    if (!term) return faculties;
    return faculties.filter((faculty) => {
      const matchesFaculty = faculty.toLowerCase().includes(term);
      const matchesDepartment = departments[faculty]?.some((dept) => dept.toLowerCase().includes(term));
      return matchesFaculty || matchesDepartment;
    });
  }, [term]);

  // Aranan metin bir bölüm adıyla eşleşiyorsa, o bölümün altında olduğu
  // fakülte otomatik açılsın — kullanıcı bölümü görmek için ayrıca fakülteye
  // tıklamak zorunda kalmasın.
  useEffect(() => {
    if (!term) return;
    const facultyWithMatch = faculties.find((faculty) => departments[faculty]?.some((dept) => dept.toLowerCase().includes(term)));
    if (facultyWithMatch) setExpandedFaculty(facultyWithMatch);
  }, [term]);

  return (
    <View className="flex-1 bg-ground">
      {/* Ekran içi "Fakülteler" başlığı ve alt yazısı kaldırıldı — üst bar
          (AppHeader) zaten sayfa adını yazıyor. */}
      <View className="bg-surface rounded-lg mx-4 mt-4 mb-1 p-6" style={SHADOW_MD}>
        <View className="flex-row items-center gap-2 bg-inset rounded-lg px-3 py-2.5 border border-line">
          <Search size={20} color={colors.accent} />
          <TextInput
            className="flex-1 text-sm text-ink"
            placeholder="Fakülte veya bölüm ara..."
            placeholderTextColor={colors.muted2}
            value={searchTerm}
            onChangeText={setSearchTerm}
          />
        </View>
      </View>

      <FlatList
        showsVerticalScrollIndicator={false}
        className="flex-1"
        contentContainerStyle={{ padding: 16, paddingBottom: TAB_BAR_SAFE_PADDING, gap: 10 }}
        data={filteredFaculties}
        keyExtractor={(item) => item}
        ListEmptyComponent={<Text className="text-center text-muted2 mt-10">Arama sonucu bulunamadı.</Text>}
        renderItem={({ item: faculty }) => {
          const isExpanded = expandedFaculty === faculty;
          const facultyDepts = departments[faculty] || [];
          // Arama bir bölüm adıyla eşleşiyorsa yalnızca eşleşen bölümler
          // gösterilsin — eskiden fakülte açılınca arama terimi ne olursa
          // olsun TÜM bölümler listeleniyordu. Eşleşme yalnızca fakülte
          // adından geliyorsa (bölüm eşleşmesi yoksa) hepsini göstermeye
          // devam ediyoruz, çünkü daraltacak bir şey yok.
          const matchingDepts = term ? facultyDepts.filter((d) => d.toLowerCase().includes(term)) : facultyDepts;
          const deptsToShow = matchingDepts.length > 0 ? matchingDepts : facultyDepts;
          return (
            <View className="bg-surface rounded-lg mb-2.5 overflow-hidden" style={SHADOW_MD}>
              <Pressable
                className="flex-row items-center justify-between px-3.5 py-3.5"
                onPress={() => setExpandedFaculty(isExpanded ? null : faculty)}
              >
                <View className="flex-row items-center gap-2.5 flex-1">
                  <Library size={24} color={isDark ? '#5A9690' : '#2F5755'} />
                  <Text className="text-base font-semibold text-ink flex-shrink">{faculty}</Text>
                </View>
                <ChevronRight
                  size={20}
                  color={isDark ? '#5A9690' : '#2F5755'}
                  style={{ transform: [{ rotate: isExpanded ? '90deg' : '0deg' }] }}
                />
              </Pressable>

              {isExpanded && (
                <View className="gap-2 px-3.5 pb-3.5 border-t border-line-soft pt-3 bg-ground">
                  {deptsToShow.map((department) => (
                    <Pressable
                      key={department}
                      className="bg-surface border border-line-soft rounded-lg p-3"
                      onPress={() => navigation.navigate('DepartmentDetail', { faculty, department })}
                    >
                      <Text className="text-sm text-ink2 font-medium">{department}</Text>
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
