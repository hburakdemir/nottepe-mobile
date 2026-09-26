import React, { useCallback } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { CalendarDays, Edit2 } from 'lucide-react-native';
import { DAY_NAMES, getCourseColor, toMinutes, type ScheduleCourse } from '../../utils/schedule';
import type { RootStackParamList } from '../../navigation/types';
import { useMySchedule } from '../../hooks/profile/useProfileLists';
import PagerPage, { type ProfileTabProps } from './PagerPage';
import { EmptyState, SHADOW_SM, TabLoading } from './profileCommon';

// Pazartesi-Cumartesi. Pazar bilerek yok: ders programında kullanılmıyor.
const DAYS = [1, 2, 3, 4, 5, 6];

const DayCard = React.memo(function DayCard({ day, courses }: { day: number; courses: ScheduleCourse[] }) {
  return (
    <View className="bg-surface rounded-lg p-3.5 mb-3" style={SHADOW_SM}>
      <Text className="text-[13px] font-bold text-ink mb-2">{DAY_NAMES[day]}</Text>
      {courses.map((c) => (
        <View key={c.id} className="flex-row items-center gap-2 py-1.5">
          {/* Ders rengi çalışma zamanında seçiliyor (`colorIdx`), derleme
              zamanında bilinemeyeceği için NativeWind sınıfı olamaz. */}
          <View className="w-1 h-[26px] rounded-sm" style={{ backgroundColor: getCourseColor(c.colorIdx).hex }} />
          <View className="flex-1">
            <Text className="text-[12.5px] font-semibold text-ink" numberOfLines={1}>
              {c.name}
            </Text>
            <Text className="text-[11px] text-muted mt-px">
              {c.start}–{c.end}
              {c.location ? ` · ${c.location}` : ''}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
});

// Profil > Program sekmesi.
function ScheduleTab({ width, headerHeight, scrollY, onRememberOffset }: ProfileTabProps) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { data: schedule, isPending } = useMySchedule();
  // bkz. ChecklistsTab.tsx — aynı gecikmeli yükleme kuralı.
  const showLoading = isPending;

  const goToSchedule = useCallback(() => navigation.navigate('Schedule'), [navigation]);

  return (
    <PagerPage
      tabKey="schedule"
      width={width}
      headerHeight={headerHeight}
      scrollY={scrollY}
      onRememberOffset={onRememberOffset}
    >
      {/* Aktif OLMASA DA çiziliyor: sekme yalnızca aktifken ya da komşuyken
          mount'lu (bkz. ProfileScreen `mountedTabs`), içerik birkaç satır.
          Eskiden `active &&` kapısı vardı ve kaydırırken gelen sayfa boş
          görünüp içerik parmak kalkınca beliriyordu. Postlar/Kayıtlı'da kapı
          duruyor — orada onlarca kart var. */}
      {
        (showLoading ? (
          <TabLoading />
        ) : !schedule || schedule.length === 0 ? (
          <EmptyState
            icon={CalendarDays}
            text="Henüz ders programı oluşturmadın."
            actionLabel="Ders Programı Oluştur"
            onAction={goToSchedule}
          />
        ) : (
          <View>
            <Pressable
              className="flex-row self-end items-center gap-1.5 bg-brand rounded-lg px-3 py-2 mb-2.5"
              onPress={goToSchedule}
            >
              <Edit2 size={13} color="#fff" />
              <Text className="text-white text-xs font-bold">Düzenle</Text>
            </Pressable>
            {DAYS.map((day) => {
              const dayCourses = schedule
                .filter((c) => c.day === day)
                .sort((a, b) => toMinutes(a.start) - toMinutes(b.start));
              if (dayCourses.length === 0) return null;
              return <DayCard key={day} day={day} courses={dayCourses} />;
            })}
          </View>
        ))}
    </PagerPage>
  );
}

export default React.memo(ScheduleTab);
