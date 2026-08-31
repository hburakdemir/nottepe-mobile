import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
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

function MealCard({ mealType, meal }: { mealType: string; meal?: Meal }) {
  const config = MEAL_LABELS[mealType];
  if (!config || !meal || meal.status !== 'ok' || !meal.items?.length) return null;
  const Icon = config.icon;
  const totalCal = meal.items.reduce((sum, i) => sum + (i.calories || 0), 0);

  return (
    <View style={styles.mealCard}>
      <View style={styles.mealCardHeader}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Icon size={17} color="#2F5755" />
          <Text style={styles.mealCardTitle}>{config.label}</Text>
        </View>
        {totalCal > 0 && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Flame size={12} color="#ea580c" />
            <Text style={styles.mealCardCal}>{totalCal} kcal</Text>
          </View>
        )}
      </View>
      <View style={{ gap: 8 }}>
        {sortItems(meal.items).map((item, idx) => (
          <View key={idx} style={styles.mealItemRow}>
            <View style={{ flex: 1 }}>
              {!!item.category && <Text style={styles.mealItemCategory}>{item.category}</Text>}
              <Text style={styles.mealItemName}>{item.name}</Text>
            </View>
            {!!item.calories && <Text style={styles.mealItemCal}>{item.calories} kcal</Text>}
          </View>
        ))}
      </View>
    </View>
  );
}

function MealPreviewCard({ mealType, meal }: { mealType: string; meal?: Meal }) {
  const config = MEAL_LABELS[mealType];
  if (!config || !meal || meal.status !== 'preview' || !meal.items?.length) return null;
  const Icon = config.icon;

  return (
    <View style={styles.previewCard}>
      <View style={styles.mealCardHeader}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Icon size={17} color="#2F5755" />
          <Text style={styles.mealCardTitle}>{config.label}</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Sparkles size={12} color="#9ca3af" />
          <Text style={styles.previewLabel}>Önizleme</Text>
        </View>
      </View>
      {meal.items.map((item, idx) => (
        <Text key={idx} style={styles.previewItemName}>
          {item.name}
        </Text>
      ))}
      <Text style={styles.previewHint}>
        beslenme.hacettepe.edu.tr'nin aylık görünümünden alınan kısaltılmış önizleme.
      </Text>
    </View>
  );
}

export default function CafeteriaMenuScreen() {
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
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2F5755" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.titleRow}>
        <UtensilsCrossed size={22} color="#2F5755" />
        <Text style={styles.title}>Yemek Listesi</Text>
      </View>
      <Text style={styles.subtitle}>
        Hacettepe yemekhanesi menüsü —{' '}
        <Text style={styles.subtitleLink} onPress={() => Linking.openURL('https://beslenme.hacettepe.edu.tr/')}>
          beslenme.hacettepe.edu.tr
        </Text>{' '}
        kaynağından alınır.
      </Text>

      <View style={styles.viewModeRow}>
        <Pressable style={[styles.viewModeBtn, viewMode === 'week' && styles.viewModeBtnActive]} onPress={() => setViewMode('week')}>
          <ListTree size={14} color={viewMode === 'week' ? '#fff' : '#4b5563'} />
          <Text style={[styles.viewModeBtnText, viewMode === 'week' && styles.viewModeBtnTextActive]}>Haftalık</Text>
        </Pressable>
        <Pressable style={[styles.viewModeBtn, viewMode === 'month' && styles.viewModeBtnActive]} onPress={() => setViewMode('month')}>
          <CalendarDays size={14} color={viewMode === 'month' ? '#fff' : '#4b5563'} />
          <Text style={[styles.viewModeBtnText, viewMode === 'month' && styles.viewModeBtnTextActive]}>Aylık</Text>
        </Pressable>
      </View>

      {viewMode === 'week' && (
        <>
          {days.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {days.map((d, idx) => {
                  const { day, num } = formatDayLabel(d.date);
                  const isSelected = d.date === selectedDate;
                  const dayHasMenu = Object.values(d.meals || {}).some((m) => m.status === 'ok');
                  return (
                    <Pressable
                      key={d.date}
                      style={[styles.dayChip, isSelected && styles.dayChipActive, !dayHasMenu && !isSelected && styles.dayChipMuted]}
                      onPress={() => setSelectedDate(d.date)}
                    >
                      <Text style={[styles.dayChipLabel, isSelected && styles.dayChipLabelActive]}>{idx === 0 ? 'Bugün' : day}</Text>
                      <Text style={[styles.dayChipNum, isSelected && styles.dayChipLabelActive]}>{num}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>
          )}

          {!!selectedDay && <Text style={styles.selectedDayText}>{formatDayLabel(selectedDay.date).full}</Text>}

          {!hasMenu ? (
            <View style={styles.emptyBox}>
              <CalendarX size={40} color="#d1d5db" />
              <Text style={styles.emptyText}>Bu gün için menü bulunamadı.</Text>
              <Text style={styles.emptyHint}>Hafta sonu / resmi tatil olabilir ya da menü henüz yayınlanmamış olabilir.</Text>
            </View>
          ) : (
            <View style={{ gap: 12 }}>
              {Object.keys(MEAL_LABELS).map((mealType) => (
                <MealCard key={mealType} mealType={mealType} meal={selectedDay!.meals[mealType]} />
              ))}
            </View>
          )}
        </>
      )}

      {viewMode === 'month' && (
        <>
          <View style={styles.monthNavRow}>
            <Pressable onPress={() => goMonth(-1)} hitSlop={8}>
              <ChevronLeft size={20} color="#6b7280" />
            </Pressable>
            <Text style={styles.monthNavText}>
              {new Date(monthCursor.year, monthCursor.month - 1, 1).toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' })}
            </Text>
            <Pressable onPress={() => goMonth(1)} hitSlop={8}>
              <ChevronRight size={20} color="#6b7280" />
            </Pressable>
          </View>

          {monthLoading ? (
            <ActivityIndicator style={{ marginVertical: 24 }} color="#2F5755" />
          ) : (
            <>
              <View style={styles.calendarCard}>
                <View style={styles.weekdayRow}>
                  {WEEKDAY_LABELS.map((w) => (
                    <Text key={w} style={styles.weekdayLabel}>
                      {w}
                    </Text>
                  ))}
                </View>
                <View style={styles.gridRow}>
                  {monthGrid.map((date, idx) => {
                    if (!date) return <View key={`empty-${idx}`} style={styles.gridCell} />;
                    const day = monthDaysByDate[date];
                    const status = dayStatus(day);
                    const isSelected = date === selectedMonthDate;
                    const isToday = date === todayStr;
                    return (
                      <Pressable
                        key={date}
                        style={[styles.gridCell, styles.gridDay, isSelected && styles.gridDaySelected, isToday && !isSelected && styles.gridDayToday]}
                        onPress={() => setSelectedMonthDate(date)}
                      >
                        <Text style={[styles.gridDayNum, isSelected && styles.gridDayNumActive]}>{parseInt(date.slice(8, 10), 10)}</Text>
                        {status !== 'none' && (
                          <View
                            style={[
                              styles.gridDot,
                              { backgroundColor: status === 'ok' ? (isSelected ? '#fff' : '#10b981') : isSelected ? 'rgba(255,255,255,0.7)' : '#fbbf24' },
                            ]}
                          />
                        )}
                      </Pressable>
                    );
                  })}
                </View>
                <View style={styles.legendRow}>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: '#10b981' }]} />
                    <Text style={styles.legendText}>Kesin menü</Text>
                  </View>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: '#fbbf24' }]} />
                    <Text style={styles.legendText}>Önizleme</Text>
                  </View>
                </View>
              </View>

              {!!selectedMonthDate && (
                <>
                  <Text style={styles.selectedDayText}>{formatDayLabel(selectedMonthDate).full}</Text>
                  {dayStatus(selectedMonthDay) === 'none' ? (
                    <View style={styles.emptyBox}>
                      <CalendarX size={40} color="#d1d5db" />
                      <Text style={styles.emptyText}>Bu gün için menü bulunamadı.</Text>
                    </View>
                  ) : (
                    <View style={{ gap: 12 }}>
                      {Object.keys(MEAL_LABELS).map((mealType) => (
                        <View key={mealType} style={{ gap: 12 }}>
                          <MealCard mealType={mealType} meal={selectedMonthDay?.meals?.[mealType]} />
                          <MealPreviewCard mealType={mealType} meal={selectedMonthDay?.meals?.[mealType]} />
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  content: { padding: 16, paddingBottom: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { fontSize: 22, fontWeight: '800', color: '#111827' },
  subtitle: { fontSize: 12.5, color: '#6b7280', marginTop: 6, marginBottom: 14, lineHeight: 17 },
  subtitleLink: { color: '#2F5755', textDecorationLine: 'underline' },
  viewModeRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  viewModeBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 9 },
  viewModeBtnActive: { backgroundColor: '#2F5755' },
  viewModeBtnText: { fontSize: 12.5, fontWeight: '600', color: '#4b5563' },
  viewModeBtnTextActive: { color: '#fff' },
  dayChip: { alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10, minWidth: 60, borderWidth: 1, borderColor: '#e5e7eb' },
  dayChipActive: { backgroundColor: '#2F5755', borderColor: '#2F5755' },
  dayChipMuted: { backgroundColor: '#f3f4f6', borderColor: '#f3f4f6' },
  dayChipLabel: { fontSize: 11, color: '#6b7280', textTransform: 'capitalize' },
  dayChipNum: { fontSize: 16, fontWeight: '700', color: '#111827', marginTop: 2 },
  dayChipLabelActive: { color: '#fff' },
  selectedDayText: { fontSize: 12.5, color: '#6b7280', marginBottom: 12, textTransform: 'capitalize' },
  emptyBox: { alignItems: 'center', paddingVertical: 40, gap: 8, backgroundColor: '#fff', borderRadius: 14 },
  emptyText: { fontSize: 14, color: '#6b7280' },
  emptyHint: { fontSize: 11.5, color: '#9ca3af', textAlign: 'center', paddingHorizontal: 20 },
  mealCard: { backgroundColor: '#fff', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#f3f4f6' },
  previewCard: { backgroundColor: '#fff', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#e5e7eb', borderStyle: 'dashed', marginTop: 10 },
  mealCardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  mealCardTitle: { fontSize: 14, fontWeight: '700', color: '#111827' },
  mealCardCal: { fontSize: 11, color: '#ea580c', fontWeight: '600' },
  mealItemRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  mealItemCategory: { fontSize: 9.5, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.3 },
  mealItemName: { fontSize: 13, color: '#1f2937', fontWeight: '500' },
  mealItemCal: { fontSize: 11, color: '#9ca3af' },
  previewLabel: { fontSize: 11, color: '#9ca3af' },
  previewItemName: { fontSize: 12.5, color: '#6b7280', marginBottom: 4 },
  previewHint: { fontSize: 10.5, color: '#9ca3af', marginTop: 4 },
  monthNavRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  monthNavText: { fontSize: 13.5, fontWeight: '700', color: '#374151', textTransform: 'capitalize' },
  calendarCard: { backgroundColor: '#fff', borderRadius: 14, padding: 12, marginBottom: 14 },
  weekdayRow: { flexDirection: 'row', marginBottom: 6 },
  weekdayLabel: { flex: 1, textAlign: 'center', fontSize: 10.5, fontWeight: '700', color: '#9ca3af' },
  gridRow: { flexDirection: 'row', flexWrap: 'wrap' },
  gridCell: { width: `${100 / 7}%`, aspectRatio: 1, padding: 2 },
  gridDay: { alignItems: 'center', justifyContent: 'center', borderRadius: 8, gap: 2 },
  gridDaySelected: { backgroundColor: '#2F5755' },
  gridDayToday: { borderWidth: 1, borderColor: '#2F5755' },
  gridDayNum: { fontSize: 12.5, color: '#374151' },
  gridDayNumActive: { color: '#fff', fontWeight: '700' },
  gridDot: { width: 5, height: 5, borderRadius: 2.5 },
  legendRow: { flexDirection: 'row', gap: 16, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#f3f4f6' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 6, height: 6, borderRadius: 3 },
  legendText: { fontSize: 11, color: '#6b7280' },
});
