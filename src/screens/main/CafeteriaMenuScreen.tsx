import React, { useMemo, useState } from 'react';
import { Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
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
} from 'lucide-react-native';
import { menuAPI } from '../../lib/api';
import { useTheme } from '../../context/ThemeContext';
import { Skeleton, SkeletonGroup } from '../../components/Skeleton';

// Yemek listesi gün içinde değişmiyor: bir kez çekildikten sonra 30 dakika
// taze sayılıyor. Sekmeden çıkıp geri gelmek, uygulamayı arka plandan
// döndürmek, aylık↔haftalık geçişi — hiçbiri yeni istek atmıyor, dolayısıyla
// "her seferinde yükleme animasyonu" şikayeti bu ekranda tamamen bitiyor.
const MENU_STALE_MS = 30 * 60 * 1000;

// Modül seviyesinde sabit: `data = []` yazılsaydı her render'da YENİ bir dizi
// üretilir ve aşağıdaki `useMemo` bağımlılıkları boşuna tetiklenirdi.
const EMPTY_DAYS: Day[] = [];

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
    <View className="bg-surface rounded-[14px] p-3.5 border border-line-soft">
      <View className="flex-row items-center justify-between mb-2.5">
        <View className="flex-row items-center gap-2">
          <Icon size={17} color={isDark ? '#5A9690' : '#2F5755'} />
          <Text className="text-sm font-bold text-ink">{config.label}</Text>
        </View>
        {totalCal > 0 && (
          <View className="flex-row items-center gap-1">
            <Flame size={12} color="#ea580c" />
            <Text className="text-[11px] text-warn font-semibold">{totalCal} kcal</Text>
          </View>
        )}
      </View>
      <View className="gap-2">
        {sortItems(meal.items).map((item, idx) => (
          <View key={idx} className="flex-row items-center justify-between gap-2">
            <View className="flex-1">
              {!!item.category && <Text className="text-[9.5px] text-muted2 uppercase tracking-[0.3px]">{item.category}</Text>}
              <Text className="text-[13px] text-ink2 font-medium">{item.name}</Text>
            </View>
            {!!item.calories && <Text className="text-[11px] text-muted2">{item.calories} kcal</Text>}
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
    <View className="bg-surface rounded-[14px] p-3.5 border border-line border-dashed mt-2.5">
      <View className="flex-row items-center justify-between mb-2.5">
        <View className="flex-row items-center gap-2">
          <Icon size={17} color={isDark ? '#5A9690' : '#2F5755'} />
          <Text className="text-sm font-bold text-ink">{config.label}</Text>
        </View>
        <View className="flex-row items-center gap-1">
          <Sparkles size={12} color={isDark ? '#6b7280' : '#9ca3af'} />
          <Text className="text-[11px] text-muted2">Önizleme</Text>
        </View>
      </View>
      {meal.items.map((item, idx) => (
        <Text key={idx} className="text-[12.5px] text-muted mb-1">
          {item.name}
        </Text>
      ))}
      <Text className="text-[10.5px] text-muted2 mt-1">beslenme.hacettepe.edu.tr'nin aylık görünümünden alınan kısaltılmış önizleme.</Text>
    </View>
  );
}

export default function CafeteriaMenuScreen() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [viewMode, setViewMode] = useState<'week' | 'month'>('week');

  const now = new Date();
  const [monthCursor, setMonthCursor] = useState({ year: now.getFullYear(), month: now.getMonth() + 1 });
  const [selectedMonthDate, setSelectedMonthDate] = useState<string | null>(null);

  // Bugünün menüsü ve haftalık liste tek sorguda birleşiyor: ikisi ayrı
  // anahtarda olsaydı ekran iki ayrı yükleme durumu yönetmek zorunda kalırdı,
  // oysa kullanıcı için tek bir şey var — "bu haftanın listesi".
  const { data: days = EMPTY_DAYS, isLoading: isLoadingRaw } = useQuery({
    queryKey: ['menu', 'week'],
    queryFn: async () => {
      const [todayRes, weekRes] = await Promise.all([menuAPI.getToday(), menuAPI.getWeek()]);
      let weekDays: Day[] = weekRes.data.days || [];
      if (todayRes.data?.available) {
        weekDays = weekDays.map((d) => (d.date === todayRes.data.date ? { ...d, meals: todayRes.data.meals } : d));
      }
      return weekDays;
    },
    staleTime: MENU_STALE_MS,
  });

  // İskelet
  // yükleme başlar başlamaz devreye giriyor, veri gelince anında iniyor.
  const isLoading = isLoadingRaw;

  // Seçili gün artık state'te TUTULMUYOR, TÜRETİLİYOR: kullanıcı bir güne
  // dokunduysa o, dokunmadıysa haftanın ilk günü. Eskiden veri gelince çalışan
  // `setSelectedDate` ile yazılıyordu — yani veri her tazelendiğinde
  // kullanıcının seçtiği gün sıfırlanma riski taşıyordu.
  const [pickedDate, setPickedDate] = useState<string | null>(null);
  const selectedDate = pickedDate ?? days[0]?.date ?? null;

  // Elle yazılmış `monthCache` sözlüğü kaldırıldı: react-query'nin kendi cache'i
  // aynı işi anahtar başına yapıyor, üstelik ekran söküldüğünde de kalıyor.
  // `isLoading` (≠ `isFetching`) kilit nokta — daha önce bakılmış bir aya geri
  // dönüldüğünde veri cache'ten geldiği için iskelet HİÇ görünmüyor.
  const { data: monthDaysList = EMPTY_DAYS, isLoading: monthLoadingRaw } = useQuery({
    queryKey: ['menu', 'month', monthCursor.year, monthCursor.month],
    queryFn: async () => {
      const res = await menuAPI.getMonth(monthCursor.year, monthCursor.month);
      return (res.data.days || []) as Day[];
    },
    enabled: viewMode === 'month',
    staleTime: MENU_STALE_MS,
  });
  const monthLoading = monthLoadingRaw;

  const selectedDay = days.find((d) => d.date === selectedDate);
  const hasMenu = selectedDay && Object.values(selectedDay.meals || {}).some((m) => m.status === 'ok');

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

  // İskelet, GERÇEK yerleşimin ölçülerini taklit ediyor: aynı iki mod düğmesi,
  // aynı 5 gün şeridi, aynı yemek kartı yükseklikleri. Amaç ekranı doldurmak
  // değil, veri geldiğinde hiçbir şeyin yerinden ZIPLAMAMASI.
  if (isLoading) {
    return (
      <SkeletonGroup>
        <ScrollView showsVerticalScrollIndicator={false} className="flex-1 bg-ground" contentContainerClassName="p-4 pb-[150px]">
          <View className="flex-row gap-2 mb-3.5">
            <Skeleton width={96} height={34} radius={10} />
            <Skeleton width={88} height={34} radius={10} />
          </View>

          <View className="flex-row gap-2 mb-3.5">
            {[0, 1, 2, 3, 4].map((i) => (
              <Skeleton key={i} width={60} height={58} radius={12} />
            ))}
          </View>

          <Skeleton width={150} height={13} style={{ marginBottom: 12 }} />

          <View className="gap-3">
            {[0, 1].map((card) => (
              <View key={card} className="bg-surface rounded-[14px] p-3.5 border border-line-soft gap-2.5">
                <View className="flex-row items-center justify-between">
                  <Skeleton width={110} height={15} />
                  <Skeleton width={58} height={12} />
                </View>
                {[0, 1, 2].map((row) => (
                  <View key={row} className="gap-1">
                    <Skeleton width="30%" height={9} radius={4} />
                    <Skeleton width="70%" height={13} />
                  </View>
                ))}
              </View>
            ))}
          </View>
        </ScrollView>
      </SkeletonGroup>
    );
  }

  return (
    <ScrollView showsVerticalScrollIndicator={false} className="flex-1 bg-ground" contentContainerClassName="p-4 pb-[150px]">
      {/* Ekran içi "Yemek Listesi" başlığı ve kaynak alt yazısı kaldırıldı —
          üst bar zaten sayfa adını yazıyor. */}
      <View className="flex-row gap-2 mb-3.5">
        <Pressable
          className={`flex-row items-center gap-1.5 rounded-[10px] px-3.5 py-[9px] ${viewMode === 'week' ? 'bg-brand' : 'bg-surface'}`}
          onPress={() => setViewMode('week')}
        >
          <ListTree size={14} color={viewMode === 'week' ? '#fff' : isDark ? '#9ca3af' : '#4b5563'} />
          <Text className={`text-[12.5px] font-semibold ${viewMode === 'week' ? 'text-white' : 'text-muted'}`}>Haftalık</Text>
        </Pressable>
        <Pressable
          className={`flex-row items-center gap-1.5 rounded-[10px] px-3.5 py-[9px] ${viewMode === 'month' ? 'bg-brand' : 'bg-surface'}`}
          onPress={() => setViewMode('month')}
        >
          <CalendarDays size={14} color={viewMode === 'month' ? '#fff' : isDark ? '#9ca3af' : '#4b5563'} />
          <Text className={`text-[12.5px] font-semibold ${viewMode === 'month' ? 'text-white' : 'text-muted'}`}>Aylık</Text>
        </Pressable>
      </View>

      {viewMode === 'week' && (
        <>
          {days.length > 0 && (
            <ScrollView showsVerticalScrollIndicator={false} horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
              <View className="flex-row gap-2">
                {days.map((d, idx) => {
                  const { day, num } = formatDayLabel(d.date);
                  const isSelected = d.date === selectedDate;
                  const dayHasMenu = Object.values(d.meals || {}).some((m) => m.status === 'ok');
                  return (
                    <Pressable
                      key={d.date}
                      className={`items-center rounded-xl px-4 py-2.5 min-w-[60px] border ${
                        isSelected ? 'bg-brand border-brand' : !dayHasMenu ? 'bg-inset border-line-soft' : 'bg-surface border-line'
                      }`}
                      onPress={() => setPickedDate(d.date)}
                    >
                      <Text className={`text-[11px] capitalize ${isSelected ? 'text-white' : 'text-muted'}`}>
                        {idx === 0 ? 'Bugün' : day}
                      </Text>
                      <Text className={`text-base font-bold mt-0.5 ${isSelected ? 'text-white' : 'text-ink'}`}>{num}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>
          )}

          {!!selectedDay && <Text className="text-[12.5px] text-muted mb-3 capitalize">{formatDayLabel(selectedDay.date).full}</Text>}

          {!hasMenu ? (
            <View className="items-center py-10 gap-2 bg-surface rounded-[14px]">
              <CalendarX size={40} color={isDark ? '#4b5563' : '#d1d5db'} />
              <Text className="text-sm text-muted">Bu gün için menü bulunamadı.</Text>
              <Text className="text-[11.5px] text-muted2 text-center px-5">
                Hafta sonu / resmi tatil olabilir ya da menü henüz yayınlanmamış olabilir.
              </Text>
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
            <Text className="text-[13.5px] font-bold text-ink2 capitalize">
              {new Date(monthCursor.year, monthCursor.month - 1, 1).toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' })}
            </Text>
            <Pressable onPress={() => goMonth(1)} hitSlop={8}>
              <ChevronRight size={20} color={isDark ? '#9ca3af' : '#6b7280'} />
            </Pressable>
          </View>

          {monthLoading ? (
            // Takvim ızgarasının kendi ölçüsünde iskelet — 6 satır × 7 sütun.
            <SkeletonGroup>
              <View className="bg-surface rounded-[14px] p-3 mb-3.5 gap-1.5">
                {[0, 1, 2, 3, 4, 5].map((row) => (
                  <View key={row} className="flex-row">
                    {[0, 1, 2, 3, 4, 5, 6].map((col) => (
                      <View key={col} style={{ width: `${100 / 7}%`, aspectRatio: 1, padding: 2 }}>
                        <Skeleton height={undefined} radius={8} style={{ flex: 1, width: '100%' }} />
                      </View>
                    ))}
                  </View>
                ))}
              </View>
            </SkeletonGroup>
          ) : (
            <>
              <View className="bg-surface rounded-[14px] p-3 mb-3.5">
                <View className="flex-row mb-1.5">
                  {WEEKDAY_LABELS.map((w) => (
                    <Text key={w} className="flex-1 text-center text-[10.5px] font-bold text-muted2">
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
                    // Seçili günün rengi ESKİDEN doğrudan Pressable'ın kendisine
                    // veriliyordu: dolgu hücrenin 2px'lik iç boşluğunu da
                    // kapsıyor, gün rakamı ise altındaki menü noktası yüzünden
                    // dikeyde merkezden yukarı kayıyordu — vurgu "tam ortalı
                    // durmuyor" diye görünen şey buydu. Artık dolgu, hücrenin
                    // iç boşluğundan sonra kalan KARE alanı kaplayan ayrı bir
                    // katman; rakam onun tam merkezinde, nokta ise akıştan
                    // çıkarılıp alta sabitlendi, yani rakamı hiç itmiyor.
                    return (
                      <Pressable
                        key={date}
                        style={{ width: `${100 / 7}%`, aspectRatio: 1, padding: 2 }}
                        onPress={() => setSelectedMonthDate(date)}
                      >
                        <View
                          style={{ flex: 1 }}
                          className={`items-center justify-center rounded-lg ${isSelected ? 'bg-brand' : ''} ${isToday && !isSelected ? 'border border-brand' : ''}`}
                        >
                          <Text className={`text-[12.5px] ${isSelected ? 'text-white font-bold' : 'text-ink2'}`}>
                            {parseInt(date.slice(8, 10), 10)}
                          </Text>
                          {status !== 'none' && (
                            <View
                              className="w-[5px] h-[5px] rounded-[2.5px]"
                              style={{
                                position: 'absolute',
                                bottom: 4,
                                backgroundColor:
                                  status === 'ok' ? (isSelected ? '#fff' : '#10b981') : isSelected ? 'rgba(255,255,255,0.7)' : '#fbbf24',
                              }}
                            />
                          )}
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
                <View className="flex-row gap-4 mt-2.5 pt-2.5 border-t border-line-soft">
                  <View className="flex-row items-center gap-1.5">
                    <View className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#10b981' }} />
                    <Text className="text-[11px] text-muted">Kesin menü</Text>
                  </View>
                  <View className="flex-row items-center gap-1.5">
                    <View className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#fbbf24' }} />
                    <Text className="text-[11px] text-muted">Önizleme</Text>
                  </View>
                </View>
              </View>

              {!!selectedMonthDate && (
                <>
                  <Text className="text-[12.5px] text-muted mb-3 capitalize">{formatDayLabel(selectedMonthDate).full}</Text>
                  {dayStatus(selectedMonthDay) === 'none' ? (
                    <View className="items-center py-10 gap-2 bg-surface rounded-[14px]">
                      <CalendarX size={40} color={isDark ? '#4b5563' : '#d1d5db'} />
                      <Text className="text-sm text-muted">Bu gün için menü bulunamadı.</Text>
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

      {/* Kaynak atfı. Eskiden ekran başlığının alt yazısındaydı; başlık üst barla
          çakıştığı için kaldırıldı ama atıf açıklama değil, veri kaynağı — bu
          yüzden listenin altına taşındı. */}
      <Text className="text-[11px] text-muted2 mt-5 text-center">
        Menü{' '}
        <Text className="text-accent underline" onPress={() => Linking.openURL('https://beslenme.hacettepe.edu.tr/')}>
          beslenme.hacettepe.edu.tr
        </Text>{' '}
        kaynağından alınır.
      </Text>
    </ScrollView>
  );
}
