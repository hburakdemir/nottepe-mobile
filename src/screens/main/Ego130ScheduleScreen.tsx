import React, { useMemo, useState } from 'react';
import { Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { Bus, ExternalLink, Info } from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';
import { EGO_130_SCHEDULES, EGO_130_SOURCE_LABEL, EGO_130_SOURCE_URL, type Ego130DayKey } from '../../data/ego130Schedule';

const SHADOW_MD = {
  shadowColor: '#000',
  shadowOpacity: 0.1,
  shadowRadius: 8,
  shadowOffset: { width: 0, height: 3 },
  elevation: 3,
};

export default function Ego130ScheduleScreen() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [activeDay, setActiveDay] = useState<Ego130DayKey>('weekday');

  const activeSchedule = useMemo(() => EGO_130_SCHEDULES.find((s) => s.key === activeDay)!, [activeDay]);

  return (
    <ScrollView className="flex-1 bg-primary dark:bg-darkbgbutton" contentContainerClassName="p-4 pt-6 pb-10">
      <View className="flex-row items-center gap-3">
        <Bus size={32} color={isDark ? '#5A9690' : '#2F5755'} />
        <Text className="text-3xl font-bold text-gray-900 dark:text-darktext">130 Ring Saatleri</Text>
      </View>
      <Text className="text-sm text-gray-500 dark:text-gray-400 mt-2 mb-4">
        Beytepe Metro İstasyonu ↔ Hacettepe Beytepe Kampüsü ring hattı sefer saatleri
      </Text>

      <View className="flex-row items-start gap-2.5 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-xl p-3.5 mb-5">
        <Info size={16} color={isDark ? '#fbbf24' : '#b45309'} style={{ marginTop: 1 }} />
        <Text className="flex-1 text-xs text-amber-800 dark:text-amber-300 leading-[18px]">
          Bu saatler EGO'nun resmi kaynağı değil, {EGO_130_SOURCE_LABEL} sitesinden derlendi ve değişmiş olabilir.
          Önemli bir sefer için resmi kaynaktan doğrulamanı öneririz.
        </Text>
      </View>

      <View className="flex-row bg-gray-100 dark:bg-darkbg rounded-full p-1 mb-4">
        {EGO_130_SCHEDULES.map((s) => {
          const active = s.key === activeDay;
          return (
            <Pressable
              key={s.key}
              className={`flex-1 items-center py-2 rounded-full ${active ? 'bg-brand' : ''}`}
              onPress={() => setActiveDay(s.key)}
            >
              <Text className={`text-xs font-semibold ${active ? 'text-white' : 'text-gray-600 dark:text-gray-400'}`}>{s.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <View className="bg-primary dark:bg-darkbgbutton rounded-xl p-4" style={SHADOW_MD}>
        <View className="flex-row flex-wrap gap-2">
          {activeSchedule.departures.map((d, i) => (
            <View
              key={`${d.time}-${i}`}
              className="min-w-[76px] items-center bg-gray-50 dark:bg-darkbg border border-gray-200 dark:border-gray-600 rounded-lg px-2.5 py-2"
            >
              <Text className="text-sm font-semibold text-gray-900 dark:text-darktext">{d.time}</Text>
              {d.note && <Text className="text-[9px] text-brand dark:text-brand-light font-medium mt-0.5 text-center">{d.note}</Text>}
            </View>
          ))}
        </View>
      </View>

      <Pressable
        className="flex-row items-center justify-center gap-2 mt-4 py-2"
        onPress={() => Linking.openURL(EGO_130_SOURCE_URL)}
      >
        <ExternalLink size={13} color={isDark ? '#9ca3af' : '#6b7280'} />
        <Text className="text-xs text-gray-500 dark:text-gray-400">Kaynak: {EGO_130_SOURCE_LABEL}</Text>
      </Pressable>
    </ScrollView>
  );
}
