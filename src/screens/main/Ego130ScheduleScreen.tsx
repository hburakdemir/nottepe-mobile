import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withSpring, withTiming } from 'react-native-reanimated';
import { ArrowUpDown, Bus, Info } from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';
import { useCardSurface, useFeedTokens, type FeedTokens } from '../../theme/feedTokens';
import { EGO_130_SCHEDULES, EGO_130_METRO_SCHEDULES, type Ego130DayKey } from '../../data/ego130Schedule';

// Ekran tamamen çevrimdışı çalışıyor: saatler `ego130Schedule.ts` içine gömülü,
// burada hiçbir istek yok. Tek dış bağlantı en alttaki kaynak linki.
//
// Eski hâlinde her kutucuğun altında notun kendisi ("ÜCRETSİZ-KONSERV.",
// "DURAKTAN BAŞLAR"…) yazıyordu; 100+ sefer × uzun etiket ekranı okunmaz
// hâle getiriyordu. Notlar artık iki eksene ayrılıp kutucuğun altında küçük
// birer işarete indi (kalkış yeri = nötr, ücretsizlik = marka rengi), anlamları
// ızgaranın altındaki efsanede bir kez yazıyor.
type MarkerKind = 'kopru' | 'durak' | 'free' | 'konserv';

const MARKER_SIZE = 7;

function markersFor(note?: string): MarkerKind[] {
  if (!note) return [];
  const n = note.toLocaleUpperCase('tr');
  const out: MarkerKind[] = [];
  if (n.includes('KÖPRÜ')) out.push('kopru');
  if (n.includes('DURAK')) out.push('durak');
  // "ÜCRETSİZ-KONSERV." zaten ücretsiz bir sefer — iki işaret yerine tek
  // konservatuvar işareti, efsanede "ücretsiz" olduğu yazıyor.
  if (n.includes('KONSERV')) out.push('konserv');
  else if (n.includes('ÜCRETSİZ')) out.push('free');
  return out;
}

function Marker({ kind, t }: { kind: MarkerKind; t: FeedTokens }) {
  const base = { width: MARKER_SIZE, height: MARKER_SIZE, borderRadius: MARKER_SIZE / 2 };
  switch (kind) {
    case 'free':
      return <View style={[base, { backgroundColor: t.accent }]} />;
    case 'konserv':
      return <View style={[base, { borderWidth: 1.5, borderColor: t.accent }]} />;
    case 'durak':
      return <View style={[base, { backgroundColor: t.ink3 }]} />;
    default:
      return <View style={[base, { borderWidth: 1.5, borderColor: t.ink3 }]} />;
  }
}

const LEGEND: { kind: MarkerKind; label: string }[] = [
  { kind: 'free', label: 'Ücretsiz sefer' },
  { kind: 'konserv', label: 'Konservatuvar üzerinden, ücretsiz' },
  { kind: 'durak', label: 'Duraktan başlar' },
  { kind: 'kopru', label: 'Köprüden geçer' },
];

// Elimizdeki tarife HUKUK FAKÜLTESİ kalkışları (otobussaatleri.net).
// Metro tarifesi: Beytepe Metro İstasyonu'ndaki tahmini varış saatleri (Moovit).

type Origin = 'campus' | 'metro';

const ORIGIN_LABEL: Record<Origin, string> = {
  campus: 'Hukuk Fakültesi kalkış',
  metro: 'Beytepe Metro Durağı (varış)',
};

const SCREEN_PADDING = 12;
const TABS_PADDING = 4;
const CARD_PADDING = 12;
const GRID_GAP = 8;
const COLUMNS = 4;


// Gün şeridi: seçili hap sekmeler arasında yumuşakça kayıyor (tek animasyon,
// efekt yok). Genişlik satırın kendi ölçüsünden geliyor, 3 sekme eşit bölünür.
function DayTabs({
  activeDay,
  onSelect,
}: {
  activeDay: Ego130DayKey;
  onSelect: (key: Ego130DayKey) => void;
}) {
  const t = useFeedTokens();
  const [rowWidth, setRowWidth] = useState(0);

  const count = EGO_130_SCHEDULES.length;
  const inner = Math.max(0, rowWidth - TABS_PADDING * 2);
  const slot = inner / count;
  const activeIndex = Math.max(0, EGO_130_SCHEDULES.findIndex((s) => s.key === activeDay));

  const x = useSharedValue(0);
  const placed = useRef(false);

  useEffect(() => {
    if (inner <= 0) return;
    const target = activeIndex * slot;
    // İlk yerleşimde animasyon yok — hap doğrudan seçili sekmenin altında başlar.
    if (!placed.current) {
      x.value = target;
      placed.current = true;
      return;
    }
    x.value = withSpring(target, { damping: 18, stiffness: 160, mass: 0.8 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex, inner]);

  const pillStyle = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));

  return (
    <View style={[styles.tabs, { borderColor: t.line }]}>
      <View style={styles.tabsRow} onLayout={(e) => setRowWidth(e.nativeEvent.layout.width)}>
        {inner > 0 && (
          <Animated.View
            pointerEvents="none"
            style={[styles.pill, { width: slot, backgroundColor: t.accent }, pillStyle]}
          />
        )}
        {EGO_130_SCHEDULES.map((s) => {
          const active = s.key === activeDay;
          return (
            <Pressable key={s.key} onPress={() => onSelect(s.key)} style={styles.tab}>
              <Text style={[styles.tabText, { color: active ? t.onAccent : t.ink2 }]}>{s.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

// Gün/kalkış değişince ızgara bir an için iskelet kutucuklara dönüyor: 95+
// kutucuğun yeniden çizimi tek karede bitmediği için ekran "takıldı" gibi
// görünüyordu, iskelet bunu bilinçli bir bekleme hâline çeviriyor.
const SKELETON_COUNT = 16;

function SkeletonGrid({ tileWidth }: { tileWidth: number }) {
  const t = useFeedTokens();
  const pulse = useSharedValue(0.5);

  useEffect(() => {
    pulse.value = withRepeat(withTiming(1, { duration: 850 }), -1, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pulseStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));

  return (
    <View style={styles.grid}>
      {Array.from({ length: SKELETON_COUNT }).map((_, i) => (
        <Animated.View
          key={i}
          style={[styles.tile, { width: tileWidth, backgroundColor: t.inset }, pulseStyle]}
        />
      ))}
    </View>
  );
}

export default function Ego130ScheduleScreen() {
  const { theme } = useTheme();
  const t = useFeedTokens();
  const cardSurface = useCardSurface();
  // Kutucuklar kartın kendi yüzeyinde duruyor (açık temada beyaz üstüne beyaz),
  // bu yüzden ayrımı açıkta yumuşak gölge + ince çizgi, koyuda bir kademe açık
  // zemin + biraz daha belirgin çizgi yapıyor — koyu temada gölge görünmüyor.
  const tileSurface =
    theme === 'dark'
      ? { backgroundColor: '#212934', borderColor: '#39434F', borderWidth: StyleSheet.hairlineWidth }
      : {
          backgroundColor: t.card,
          borderColor: t.line,
          borderWidth: StyleSheet.hairlineWidth,
          shadowColor: '#000',
          shadowOpacity: 0.07,
          shadowRadius: 5,
          shadowOffset: { width: 0, height: 2 },
          elevation: 2,
        };
  const [gridWidth, setGridWidth] = useState(0);
  const [activeDay, setActiveDay] = useState<Ego130DayKey>('weekday');
  const [origin, setOrigin] = useState<Origin>('campus');
  const [loading, setLoading] = useState(true);

  // Açılışta ve her değişimde kısa bir iskelet: liste yerel olduğu için veri
  // beklemiyoruz, beklenen şey 95+ kutucuğun çizimi.
  useEffect(() => {
    setLoading(true);
    const id = setTimeout(() => setLoading(false), 450);
    return () => clearTimeout(id);
  }, [activeDay, origin]);

  const handleSelectDay = (key: Ego130DayKey) => {
    if (key !== activeDay) setActiveDay(key);
  };

  const activeSchedule = useMemo(() => {
    const schedules = origin === 'metro' ? EGO_130_METRO_SCHEDULES : EGO_130_SCHEDULES;
    return schedules.find((s) => s.key === activeDay)!;
  }, [activeDay, origin]);

  // Eski düzende kutucuklar `flex-wrap` ile kendi genişliklerince diziliyordu,
  // satırlar tırtıklı çıkıyordu. Genişlik ızgaranın KENDİ ölçüsünden (onLayout)
  // türetiliyor — pencere genişliğinden hesaplamak AppShell'in kendi yatay
  // payını hesaba katmadığı için satıra 4 yerine 3 kutucuk sığdırıyordu.
  const tileWidth = gridWidth > 0 ? (gridWidth - GRID_GAP * (COLUMNS - 1)) / COLUMNS : 0;

  return (
    <ScrollView
      style={{ backgroundColor: t.ground }}
      contentContainerStyle={{ padding: SCREEN_PADDING, paddingTop: 16, paddingBottom: 92 }}
    >
      <View style={styles.titleRow}>
        <Bus size={26} color={t.accent} />
        <Text style={[styles.title, { color: t.ink }]}>130 Ring Saatleri</Text>
      </View>
      <Text style={[styles.subtitle, { color: t.ink2 }]}>
        Beytepe Metro İstasyonu ↔ Hacettepe Beytepe Kampüsü ring hattı
      </Text>

      <View style={[styles.notice, { backgroundColor: `${t.amber}14`, borderColor: `${t.amber}40` }]}>
        <Info size={15} color={t.amber} style={{ marginTop: 1 }} />
        <Text style={[styles.noticeText, { color: t.amber }]}>
          Resmi EGO verisi değil, derlenmiş saatlerdir; değişmiş olabilir.
        </Text>
      </View>

      <DayTabs activeDay={activeDay} onSelect={handleSelectDay} />

      {/* Kalkış noktası anahtarı: aynı sefer listesi, kampüs kalkışı ya da
          metro durağındaki tahmini saat. */}
      <View style={styles.metaRow}>
        <Pressable
          onPress={() => setOrigin((prev) => (prev === 'campus' ? 'metro' : 'campus'))}
          style={[styles.originButton, { borderColor: t.line }]}
        >
          <ArrowUpDown size={13} color={t.accent} />
          <Text style={[styles.originText, { color: t.ink2 }]} numberOfLines={1}>
            {ORIGIN_LABEL[origin]}
          </Text>
        </Pressable>
        <Text style={[styles.count, { color: t.ink3 }]}>{activeSchedule.departures.length} sefer</Text>
      </View>

      <View style={[styles.card, cardSurface]}>
        <View onLayout={(e) => setGridWidth(e.nativeEvent.layout.width)}>
          {tileWidth > 0 &&
            (loading ? (
              <SkeletonGrid tileWidth={tileWidth} />
            ) : (
              <View style={styles.grid}>
                {activeSchedule.departures.map((d, i) => {
                  const marks = markersFor(d.note);
                  return (
                    <View key={`${d.time}-${i}`} style={[styles.tile, tileSurface, { width: tileWidth }]}>
                      <Text style={[styles.time, { color: t.ink }]}>
                        {d.time}
                      </Text>
                      {/* İşaret satırı not olmasa da duruyor: kutucukların yüksekliği
                          satırdan satıra oynamasın diye. */}
                      <View style={styles.markers}>
                        {marks.map((kind) => (
                          <Marker key={kind} kind={kind} t={t} />
                        ))}
                      </View>
                    </View>
                  );
                })}
              </View>
            ))}
        </View>
      </View>

      <View style={styles.legend}>
        {LEGEND.map((item) => (
          <View key={item.kind} style={styles.legendRow}>
            <Marker kind={item.kind} t={t} />
            <Text style={[styles.legendText, { color: t.ink2 }]}>{item.label}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { fontSize: 24, fontWeight: '700' },
  subtitle: { fontSize: 13, lineHeight: 19, marginTop: 6 },
  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 9,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 14,
  },
  noticeText: { flex: 1, fontSize: 12, lineHeight: 17 },
  tabs: { borderRadius: 999, borderWidth: StyleSheet.hairlineWidth, marginTop: 14 },
  tabsRow: { flexDirection: 'row', padding: TABS_PADDING },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 999 },
  tabText: { fontSize: 12.5, fontWeight: '600' },
  pill: {
    position: 'absolute',
    left: TABS_PADDING,
    top: TABS_PADDING,
    bottom: TABS_PADDING,
    borderRadius: 999,
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12, marginBottom: 8 },
  originButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  originText: { flex: 1, fontSize: 12, fontWeight: '500' },
  count: { fontSize: 11.5 },
  card: { borderRadius: 16, padding: CARD_PADDING },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GRID_GAP },
  tile: {
    height: 56,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  time: { fontSize: 15, fontWeight: '600', fontVariant: ['tabular-nums'] },
  markers: { flexDirection: 'row', gap: 4, height: MARKER_SIZE },
  legend: { marginTop: 14, gap: 8, paddingHorizontal: 2 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  legendText: { fontSize: 12 },
});
