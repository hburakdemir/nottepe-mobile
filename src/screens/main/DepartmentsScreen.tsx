import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, ListRenderItem, Pressable, Text, TextInput, View } from 'react-native';
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

// Arama kutusuna yazarken her tuşta değil, yazmaya ara verilince filtreleniyor.
//
// ESKİDEN debounce YOKTU ve her tuş İKİ render turu tetikliyordu: önce
// `filteredFaculties` tüm fakülte×bölüm ağacını tarıyor, sonra otomatik-açma
// efekti (aşağıda) ağacı İKİNCİ KEZ tarayıp `setExpandedFaculty` çağırıyordu.
// Satırlar da memoize olmadığı için her turda hepsi yeniden çiziliyordu —
// testçilerin "Fakülteler'de takılıyor" dediği şey buydu.
const SEARCH_DEBOUNCE_MS = 250;

interface FacultyRowProps {
  faculty: string;
  isExpanded: boolean;
  term: string;
  isDark: boolean;
  onToggle: (faculty: string) => void;
  onSelectDepartment: (faculty: string, department: string) => void;
}

// SATIR AYRI VE MEMOİZE.
//
// Eskiden `renderItem` bir `useCallback`'ti ve `expandedFaculty` ile `term`'e
// bağlıydı: ikisinden biri değişince fonksiyon kimliği değişiyor, FlatList de
// BÜTÜN satırları yeniden çiziyordu. Artık her satır kendi prop'larına bakıyor;
// bir fakülte açılıp kapandığında yalnızca o satır çiziliyor.
//
// Memo'nun tutması için `onToggle` ve `onSelectDepartment` referanslarının
// sabit olması şart — ikisi de ekran gövdesinde bağımlılıksız `useCallback`.
const FacultyRow = React.memo(function FacultyRow({
  faculty,
  isExpanded,
  term,
  isDark,
  onToggle,
  onSelectDepartment,
}: FacultyRowProps) {
  const facultyDepts = departments[faculty] || [];
  // Arama bir bölüm adıyla eşleşiyorsa yalnızca eşleşen bölümler gösterilsin —
  // eskiden fakülte açılınca arama terimi ne olursa olsun TÜM bölümler
  // listeleniyordu. Eşleşme yalnızca fakülte adından geliyorsa (bölüm eşleşmesi
  // yoksa) hepsini göstermeye devam ediyoruz, çünkü daraltacak bir şey yok.
  const deptsToShow = useMemo(() => {
    if (!term) return facultyDepts;
    const matching = facultyDepts.filter((d) => d.toLowerCase().includes(term));
    return matching.length > 0 ? matching : facultyDepts;
  }, [facultyDepts, term]);

  const accent = isDark ? '#5A9690' : '#2F5755';

  return (
    <View className="bg-surface rounded-lg mb-2.5 overflow-hidden" style={SHADOW_MD}>
      <Pressable className="flex-row items-center justify-between px-3.5 py-3.5" onPress={() => onToggle(faculty)}>
        <View className="flex-row items-center gap-2.5 flex-1">
          <Library size={24} color={accent} />
          <Text className="text-base font-semibold text-ink flex-shrink">{faculty}</Text>
        </View>
        <ChevronRight size={20} color={accent} style={{ transform: [{ rotate: isExpanded ? '90deg' : '0deg' }] }} />
      </Pressable>

      {isExpanded && (
        <View className="gap-2 px-3.5 pb-3.5 border-t border-line-soft pt-3 bg-ground">
          {deptsToShow.map((department) => (
            <Pressable
              key={department}
              className="bg-surface border border-line-soft rounded-lg p-3"
              onPress={() => onSelectDepartment(faculty, department)}
            >
              <Text className="text-sm text-ink2 font-medium">{department}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
});

export default function DepartmentsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { theme, colors } = useTheme();
  const isDark = theme === 'dark';
  // İki ayrı state: `searchInput` kutunun ANLIK değeri (yazarken takılma
  // olmasın diye doğrudan bağlı), `term` ise filtrelemeyi tetikleyen gecikmeli
  // değer. Kutuya yazmak artık ağacı taramıyor.
  const [searchInput, setSearchInput] = useState('');
  const [term, setTerm] = useState('');
  const [expandedFaculty, setExpandedFaculty] = useState<string | null>(null);

  useEffect(() => {
    const id = setTimeout(() => setTerm(searchInput.trim().toLowerCase()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [searchInput]);

  const filteredFaculties = useMemo(() => {
    if (!term) return faculties;
    return faculties.filter((faculty) => {
      const matchesFaculty = faculty.toLowerCase().includes(term);
      const matchesDepartment = departments[faculty]?.some((dept) => dept.toLowerCase().includes(term));
      return matchesFaculty || matchesDepartment;
    });
  }, [term]);

  // Aranan metin bir bölüm adıyla eşleşiyorsa, o bölümün altında olduğu fakülte
  // otomatik açılsın — kullanıcı bölümü görmek için ayrıca fakülteye tıklamak
  // zorunda kalmasın. Artık `term`'e (gecikmeli değere) bağlı, yani tuş başına
  // değil arama oturumu başına bir kez çalışıyor.
  useEffect(() => {
    if (!term) return;
    const facultyWithMatch = faculties.find((faculty) => departments[faculty]?.some((dept) => dept.toLowerCase().includes(term)));
    if (facultyWithMatch) setExpandedFaculty(facultyWithMatch);
  }, [term]);

  // Bağımlılıksız: referansları sabit kalsın ki `FacultyRow`'un memo'su tutsun.
  const handleToggle = useCallback((faculty: string) => {
    setExpandedFaculty((prev) => (prev === faculty ? null : faculty));
  }, []);

  const handleSelectDepartment = useCallback(
    (faculty: string, department: string) => {
      navigation.navigate('DepartmentDetail', { faculty, department });
    },
    [navigation]
  );

  const renderFaculty = useCallback<ListRenderItem<string>>(
    ({ item: faculty }) => (
      <FacultyRow
        faculty={faculty}
        isExpanded={expandedFaculty === faculty}
        term={term}
        isDark={isDark}
        onToggle={handleToggle}
        onSelectDepartment={handleSelectDepartment}
      />
    ),
    [expandedFaculty, term, isDark, handleToggle, handleSelectDepartment]
  );

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
            value={searchInput}
            onChangeText={setSearchInput}
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
        renderItem={renderFaculty}
        // `removeClippedSubviews` KAPATILDI. Satırlar açılıp kapandığı için
        // değişken yükseklikli ve hepsi dokunulabilir; bu prop'un Android'de
        // ekrandan çıkıp giren satırlarda boş satır bırakması ve dokunuş
        // yutması bilinen bir sorun. Aynı gerekçe ProfileScreen ve
        // LeaderboardScreen'deki listelerde de yazılı.
        removeClippedSubviews={false}
        maxToRenderPerBatch={6}
        windowSize={7}
        initialNumToRender={6}
      />
    </View>
  );
}
