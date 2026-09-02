import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, Text, View } from 'react-native';
import {
  CalendarDays,
  CalendarX,
  ChevronLeft,
  ChevronRight,
  Flame,
  Leaf,
  ListTree,
  Moon,
  Sparkles,
  Sun,
  UtensilsCrossed,
} from 'lucide-react-native';
import { menuAPI } from '../../lib/api';
import { useTheme } from '../../context/ThemeContext';

interface MenuItem {
  name: string;
  category?: string;
  calories?: number;
}

interface Meal {
  status: 'ok' | 'preview' | 'none';
  items: MenuItem[];
}

interface Day {
  date: string;
  meals: Record<string, Meal>;
}

const MEAL_LABELS: Record<string, { label: string; icon: any }> = {
  lunch: { label: 'Öğle Yemeği', icon: Sun },
  dinner: { label: 'Akşam Yemeği', icon: Moon },
  vegan: { label: 'Vegan Menü', icon: Leaf },
};

const CATEGORY_ORDER = ['ÇORBA', 'ANAYEMEK', 'VEGAN', 'PİLAV', 'MAKARNA', 'SALATA', 'MEYVE'];
const WEEKDAY_LABELS = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];

function sortItems(items: MenuItem[]): MenuItem[] {
  return [...items].sort((a, b) => {
    const ai = CATEGORY_ORDER.indexOf(a.category || '');
    const bi = CATEGORY_ORDER.indexOf(b.category || '');
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });
}

function formatDayLabel(dateStr: string) {
  const date = new Date(`${dateStr}T12:00:00`);
  return {
    day: date.toLocaleDateString('tr-TR', { weekday: 'short' }),
    num: date.getDate(),
    full: date.toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long' }),
  };
}

function dayStatus(day: Day | undefined): 'ok' | 'preview' | 'none' {
  const meals = Object.values(day?.meals || {});
  if (meals.some((m) => m.status === 'ok')) return 'ok';
  if (meals.some((m) => m.status === 'preview')) return 'preview';
  return 'none';
}

function buildMonthGrid(year: number, month: number): (string | null)[] {
  const first = new Date(year, month - 1, 1);
  const daysInMonth = new Date(year, month, 0).getDate();
  const leading = (first.getDay() + 6) % 7;
  const cells: (string | null)[] = Array(leading).fill(null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(`${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
  }
  return cells;
}

function MealCard({ mealType, meal, isDark }: { mealType: string; meal?: Meal; isDark: boolean }) {
  const config = MEAL_LABELS[mealType];
  if (!config || !meal || meal.status !== 'ok' || !meal.items?.length) return null;
  const Icon = config.icon;
  const totalCal = meal.items.reduce((sum, i) => sum + (i.calories || 0), 0);

  return (
    <View className="bg-primary dark:bg-darkbgbutton rounded-[14px] p-3.5 border border-gray-100 dark:border-gray-700/40">
      <View className="flex-row items-center justify-between mb-2.5">
        <View className="flex-row items-center gap-2">
          <Icon size={17} color={isDark ? '#5A9690' : '#2F5755'} />
          <Text className="text-sm font-bold text-gray-900 dark:text-darktext">{config.label}</Text>
        </View>
        {totalCal > 0 && (
          <View className="flex-row items-center gap-1">
            <Flame size={12} color="#ea580c" />
            <Text className="text-[11px] text-orange-600 dark:text-orange-400 font-semibold">{totalCal} kcal</Text>
          </View>
        )}
      </View>
      <View className="gap-2">
        {sortItems(meal.items).map((item, idx) => (
          <View key={idx} className="flex-row items-center justify-between gap-2">
            <View className="flex-1">
              {!!item.category && <Text className="text-[9.5px] text-gray-400 dark:text-gray-500 uppercase tracking-[0.3px]">{item.category}</Text>}
              <Text className="text-[13px] text-gray-800 dark:text-darktext font-medium">{item.name}</Text>
            </View>
            {!!item.calories && <Text className="text-[11px] text-gray-400 dark:text-gray-500">{item.calories} kcal</Text>}
          </View>
        ))}
      </View>
    </View>
  );
}

function MealPreviewCard({ mealType, meal, isDark }: { mealType: string; meal?: Meal; isDark: boolean }) {
  const config = MEAL_LABELS[mealType];
  if (!config || !meal || meal.status !== 'preview' || !meal.items?.length) return null;
  const Icon = config.icon;

  return (
    <View className="bg-primary dark:bg-darkbgbutton rounded-[14px] p-3.5 border border-gray-200 dark:border-gray-600 border-dashed mt-2.5">
      <View className="flex-row items-center justify-between mb-2.5">
        <View className="flex-row items-center gap-2">
          <Icon size={17} color={isDark ? '#5A9690' : '#2F5755'} />
          <Text className="text-sm font-bold text-gray-900 dark:text-darktext">{config.label}</Text>
        </View>
        <View className="flex-row items-center gap-1">
          <Sparkles size={12} color={isDark ? '#6b7280' : '#9ca3af'} />
          <Text className="text-[11px] text-gray-400 dark:text-gray-500">Önizleme</Text>
        </View>
      </View>
      {meal.items.map((item, idx) => (
        <Text key={idx} className="text-[12.5px] text-gray-500 dark:text-gray-400 mb-1">
          {item.name}
        </Text>
      ))}
      <Text className="text-[10.5px] text-gray-400 dark:text-gray-500 mt-1">
        beslenme.hacettepe.edu.tr'nin aylık görünümünden alınan kısaltılmış önizleme.
      </Text>
    </View>
  );
}

export default function CafeteriaMenuScreen() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [days, setDays] = useState<Day[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'week' | 'month'>('week');

  const now = new Date();
  const [monthCursor, setMonthCursor] = useState({ year: now.getFullYear(), month: now.getMonth() + 1 });
  const [monthCache, setMonthCache] = useState<Record<string, Day[]>>({});
  const [monthLoading, setMonthLoading] = useState(false);
  const [selectedMonthDate, setSelectedMonthDate] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [todayRes, weekRes] = await Promise.all([menuAPI.getToday(), menuAPI.getWeek()]);
        let weekDays: Day[] = weekRes.data.days || [];
        if (todayRes.data?.available) {
          weekDays = weekDays.map((d) => (d.date === todayRes.data.date ? { ...d, meals: todayRes.data.meals } : d));
        }
        setDays(weekDays);
        setSelectedDate(weekDays[0]?.date || null);
      } catch {
        setDays([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const monthKey = `${monthCursor.year}-${monthCursor.month}`;
  useEffect(() => {
    if (viewMode !== 'month' || monthCache[monthKey]) return;
    setMonthLoading(true);
    menuAPI
      .getMonth(monthCursor.year, monthCursor.month)
      .then((res) => setMonthCache((prev) => ({ ...prev, [monthKey]: res.data.days || [] })))
      .catch(() => setMonthCache((prev) => ({ ...prev, [monthKey]: [] })))
      .finally(() => setMonthLoading(false));
  }, [viewMode, monthKey, monthCursor, monthCache]);

  const selectedDay = days.find((d) => d.date === selectedDate);
  const hasMenu = selectedDay && Object.values(selectedDay.meals || {}).some((m) => m.status === 'ok');

  const monthDaysList = monthCache[monthKey] || [];
  const monthDaysByDate = useMemo(() => Object.fromEntries(monthDaysList.map((d) => [d.date, d])), [monthDaysList]);
  const monthGrid = useMemo(() => buildMonthGrid(monthCursor.year, monthCursor.month), [monthCursor]);
  const selectedMonthDay = selectedMonthDate ? monthDaysByDate[selectedMonthDate] : undefined;
  const todayStr = new Date().toLocaleDateString('en-CA');

  const goMonth = (delta: number) => {
    setSelectedMonthDate(null);
    setMonthCursor(({ year, month }) => {
      let m = month + delta;
      let y = year;
      if (m < 1) {
        m = 12;
        y -= 1;
      } else if (m > 12) {
        m = 1;
        y += 1;
      }
      return { year: y, month: m };
    });
  };

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" color={isDark ? '#5A9690' : '#2F5755'} />
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-gray-50 dark:bg-darkbg" contentContainerClassName="p-4 pb-10">
      <View className="flex-row items-center gap-2.5">
        <UtensilsCrossed size={22} color={isDark ? '#5A9690' : '#2F5755'} />
        <Text className="text-2xl font-extrabold text-gray-900 dark:text-darktext">Yemek Listesi</Text>
      </View>
      <Text className="text-[12.5px] text-gray-500 dark:text-gray-400 mt-1.5 mb-3.5 leading-[17px]">
        Hacettepe yemekhanesi menüsü —{' '}
        <Text className="text-brand dark:text-brand-light underline" onPress={() => Linking.openURL('https://beslenme.hacettepe.edu.tr/')}>
          beslenme.hacettepe.edu.tr
        </Text>{' '}
        kaynağından alınır.
      </Text>

      <View className="flex-row gap-2 mb-3.5">
        <Pressable
          className={`flex-row items-center gap-1.5 rounded-[10px] px-3.5 py-[9px] ${viewMode === 'week' ? 'bg-brand' : 'bg-primary dark:bg-darkbgbutton'}`}
          onPress={() => setViewMode('week')}
        >
          <ListTree size={14} color={viewMode === 'week' ? '#fff' : isDark ? '#9ca3af' : '#4b5563'} />
          <Text className={`text-[12.5px] font-semibold ${viewMode === 'week' ? 'text-white' : 'text-gray-600 dark:text-gray-300'}`}>Haftalık</Text>
        </Pressable>
        <Pressable
          className={`flex-row items-center gap-1.5 rounded-[10px] px-3.5 py-[9px] ${viewMode === 'month' ? 'bg-brand' : 'bg-primary dark:bg-darkbgbutton'}`}
          onPress={() => setViewMode('month')}
        >
          <CalendarDays size={14} color={viewMode === 'month' ? '#fff' : isDark ? '#9ca3af' : '#4b5563'} />
          <Text className={`text-[12.5px] font-semibold ${viewMode === 'month' ? 'text-white' : 'text-gray-600 dark:text-gray-300'}`}>Aylık</Text>
        </Pressable>
      </View>

      {viewMode === 'week' && (
        <>
          {days.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
              <View className="flex-row gap-2">
                {days.map((d, idx) => {
                  const { day, num } = formatDayLabel(d.date);
                  const isSelected = d.date === selectedDate;
                  const dayHasMenu = Object.values(d.meals || {}).some((m) => m.status === 'ok');
                  return (
                    <Pressable
                      key={d.date}
                      className={`items-center rounded-xl px-4 py-2.5 min-w-[60px] border ${
                        isSelected
                          ? 'bg-brand border-brand'
                          : !dayHasMenu
                            ? 'bg-gray-100 dark:bg-gray-700/40 border-gray-100 dark:border-gray-700/40'
                            : 'bg-primary dark:bg-darkbgbutton border-gray-200 dark:border-gray-600'
                      }`}
                      onPress={() => setSelectedDate(d.date)}
                    >
                      <Text className={`text-[11px] capitalize ${isSelected ? 'text-white' : 'text-gray-500 dark:text-gray-400'}`}>{idx === 0 ? 'Bugün' : day}</Text>
                      <Text className={`text-base font-bold mt-0.5 ${isSelected ? 'text-white' : 'text-gray-900 dark:text-darktext'}`}>{num}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>
          )}

          {!!selectedDay && <Text className="text-[12.5px] text-gray-500 dark:text-gray-400 mb-3 capitalize">{formatDayLabel(selectedDay.date).full}</Text>}

          {!hasMenu ? (
            <View className="items-center py-10 gap-2 bg-primary dark:bg-darkbgbutton rounded-[14px]">
              <CalendarX size={40} color={isDark ? '#4b5563' : '#d1d5db'} />
              <Text className="text-sm text-gray-500 dark:text-gray-400">Bu gün için menü bulunamadı.</Text>
              <Text className="text-[11.5px] text-gray-400 dark:text-gray-500 text-center px-5">Hafta sonu / resmi tatil olabilir ya da menü henüz yayınlanmamış olabilir.</Text>
            </View>
          ) : (
            <View className="gap-3">
              {Object.keys(MEAL_LABELS).map((mealType) => (
                <MealCard key={mealType} mealType={mealType} meal={selectedDay!.meals[mealType]} isDark={isDark} />
              ))}
            </View>
          )}
        </>
      )}

      {viewMode === 'month' && (
        <>
          <View className="flex-row items-center justify-between mb-3">
            <Pressable onPress={() => goMonth(-1)} hitSlop={8}>
              <ChevronLeft size={20} color={isDark ? '#9ca3af' : '#6b7280'} />
            </Pressable>
            <Text className="text-[13.5px] font-bold text-gray-700 dark:text-darktext capitalize">
              {new Date(monthCursor.year, monthCursor.month - 1, 1).toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' })}
            </Text>
            <Pressable onPress={() => goMonth(1)} hitSlop={8}>
              <ChevronRight size={20} color={isDark ? '#9ca3af' : '#6b7280'} />
            </Pressable>
          </View>

          {monthLoading ? (
            <ActivityIndicator style={{ marginVertical: 24 }} color={isDark ? '#5A9690' : '#2F5755'} />
          ) : (
            <>
              <View className="bg-primary dark:bg-darkbgbutton rounded-[14px] p-3 mb-3.5">
                <View className="flex-row mb-1.5">
                  {WEEKDAY_LABELS.map((w) => (
                    <Text key={w} className="flex-1 text-center text-[10.5px] font-bold text-gray-400 dark:text-gray-500">
                      {w}
                    </Text>
                  ))}
                </View>
                <View className="flex-row flex-wrap">
                  {monthGrid.map((date, idx) => {
                    if (!date) return <View key={`empty-${idx}`} style={{ width: `${100 / 7}%`, aspectRatio: 1, padding: 2 }} />;
                    const day = monthDaysByDate[date];
                    const status = dayStatus(day);
                    const isSelected = date === selectedMonthDate;
                    const isToday = date === todayStr;
                    return (
                      <Pressable
                        key={date}
                        style={{ width: `${100 / 7}%`, aspectRatio: 1, padding: 2 }}
                        className={`items-center justify-center rounded-lg gap-0.5 ${isSelected ? 'bg-brand' : ''} ${isToday && !isSelected ? 'border border-brand' : ''}`}
                        onPress={() => setSelectedMonthDate(date)}
                      >
                        <Text className={`text-[12.5px] ${isSelected ? 'text-white font-bold' : 'text-gray-700 dark:text-darktext'}`}>{parseInt(date.slice(8, 10), 10)}</Text>
                        {status !== 'none' && (
                          <View
                            className="w-[5px] h-[5px] rounded-[2.5px]"
                            style={{ backgroundColor: status === 'ok' ? (isSelected ? '#fff' : '#10b981') : isSelected ? 'rgba(255,255,255,0.7)' : '#fbbf24' }}
                          />
                        )}
                      </Pressable>
                    );
                  })}
                </View>
                <View className="flex-row gap-4 mt-2.5 pt-2.5 border-t border-gray-100 dark:border-gray-700/40">
                  <View className="flex-row items-center gap-1.5">
                    <View className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#10b981' }} />
                    <Text className="text-[11px] text-gray-600 dark:text-gray-400">Kesin menü</Text>
                  </View>
                  <View className="flex-row items-center gap-1.5">
                    <View className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#fbbf24' }} />
                    <Text className="text-[11px] text-gray-600 dark:text-gray-400">Önizleme</Text>
                  </View>
                </View>
              </View>

              {!!selectedMonthDate && (
                <>
                  <Text className="text-[12.5px] text-gray-500 dark:text-gray-400 mb-3 capitalize">{formatDayLabel(selectedMonthDate).full}</Text>
                  {dayStatus(selectedMonthDay) === 'none' ? (
                    <View className="items-center py-10 gap-2 bg-primary dark:bg-darkbgbutton rounded-[14px]">
                      <CalendarX size={40} color={isDark ? '#4b5563' : '#d1d5db'} />
                      <Text className="text-sm text-gray-500 dark:text-gray-400">Bu gün için menü bulunamadı.</Text>
                    </View>
                  ) : (
                    <View className="gap-3">
                      {Object.keys(MEAL_LABELS).map((mealType) => (
                        <View key={mealType} className="gap-3">
                          <MealCard mealType={mealType} meal={selectedMonthDay?.meals?.[mealType]} isDark={isDark} />
                          <MealPreviewCard mealType={mealType} meal={selectedMonthDay?.meals?.[mealType]} isDark={isDark} />
                        </View>
                      ))}
                    </View>
                  )}
                </>
              )}
            </>
          )}
        </>
      )}
    </ScrollView>
  );
}
