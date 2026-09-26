import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { ArrowUpDown, Bus, Clock } from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';
import { useCardSurface, useFeedTokens, type FeedTokens } from '../../theme/feedTokens';
import { EGO_130_SCHEDULES, EGO_130_METRO_SCHEDULES, type Ego130DayKey } from '../../data/ego130Schedule';
import { TAB_BAR_SAFE_PADDING } from '../../components/layout/tabBarMetrics';
import { toMinutes } from '../../utils/schedule';
import { MAX_FONT_SCALE } from '../../theme/applyGlobalFont';

// Cihazın o anki gününe göre tarife anahtarı (0=Pazar, 6=Cumartesi). Ekran
// açılışta bu güne düşüyor — eskiden hep `'weekday'` sabitti, Pazar günü
// giren biri "Hafta İçi" tarifesiyle karşılaşıyordu.
function dayKeyForOffset(offsetDays: number): Ego130DayKey {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const dow = d.getDay();
  if (dow === 0) return 'sunday';
  if (dow === 6) return 'saturday';
  return 'weekday';
}

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

// Not metinleri tarife boyunca tekrar ediyor (~100 sefer, bir avuç farklı not),
// bu yüzden sonuç modül seviyesinde önbelleğe alınıyor. ESKİDEN her kutucuk HER
// render'da `toLocaleUpperCase('tr')` + dört `includes` çalıştırıyordu; gün
// değiştirmede 95+ kutucuk × bu iş, ekranın takılmasının payıydı. Dönen dizi de
// paylaşılıyor — `Tile` memoize olduğu için referansın sabit kalması şart
// (yeni dizi = yeni prop = boşuna yeniden çizim).
const EMPTY_MARKERS: MarkerKind[] = [];
const markerCache = new Map<string, MarkerKind[]>();

function markersFor(note?: string): MarkerKind[] {
  if (!note) return EMPTY_MARKERS;
  const cached = markerCache.get(note);
  if (cached) return cached;

  const n = note.toLocaleUpperCase('tr');
  const out: MarkerKind[] = [];
  if (n.includes('KÖPRÜ')) out.push('kopru');
  if (n.includes('DURAK')) out.push('durak');
  // "ÜCRETSİZ-KONSERV." zaten ücretsiz bir sefer — iki işaret yerine tek
  // konservatuvar işareti, efsanede "ücretsiz" olduğu yazıyor.
  if (n.includes('KONSERV')) out.push('konserv');
  else if (n.includes('ÜCRETSİZ')) out.push('free');

  markerCache.set(note, out);
  return out;
}

// `t` (useFeedTokens) modül seviyesindeki sabit LIGHT/DARK nesnelerinden biri —
// referansı tema değişene kadar sabit, bu yüzden memo gerçekten tutuyor.
const Marker = React.memo(function Marker({ kind, t }: { kind: MarkerKind; t: FeedTokens }) {
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
});

const LEGEND: { kind: MarkerKind; label: string }[] = [
  { kind: 'free', label: 'Ücretsiz sefer' },
  { kind: 'konserv', label: 'Konservatuvar üzerinden, ücretsiz' },
  { kind: 'durak', label: 'Duraktan başlar' },
  { kind: 'kopru', label: 'Köprüden geçer' },
];

// Elimizdeki tarife EGO'nun "Servis Başlangıç Saati" (kampüs kalkışı) listesi.
// Metro tarifesi: Beytepe Metro İstasyonu'ndaki tahmini geçiş saatleri — kalkış
// + 7 dk; EGO'nun kendi durak geçiş tablosuyla üç günde de birebir tutuyor.

type Origin = 'campus' | 'metro';

// Eskiden bu sabit hiç kullanılmıyordu — kalkış noktası butonu ve varış
// kartı iki farklı yerde birbirinden ayrı, birbiriyle çelişen metinler
// yazıyordu ("Beytepe Metro Durağı (varış)" / "Beytepe Metro (varış)").
// Artık origin metni HER yerde buradan geliyor.
const ORIGIN_LABEL: Record<Origin, string> = {
  campus: 'Hukuk Fakültesi kalkış',
  metro: 'Beytepe Metro (varış)',
};

const SCREEN_PADDING = 12;
const TABS_PADDING = 4;
const CARD_PADDING = 12;
const GRID_GAP = 8;
const MAX_COLUMNS = 4;
const MIN_COLUMNS = 3;

// Sütun sayısı SAATİN GERÇEK GENİŞLİĞİNDEN türetiliyor. Eskiden sabit 4'tü:
// dar ekranda ya da Android'de "Ekran boyutu" büyütülmüşken kutucuk ~62 px'e
// iniyor, saat ise sistem yazı ölçeği %120'de ~59 px + Android'in sahte kalını
// tutuyor — "12:30" ikinci satıra kayıyor ya da kesiliyordu.
//
// 3,5 em: Sora SemiBold'da en geniş "HH:MM" 3,29 em (fonttan ölçüldü, 1440
// saatin hepsi denendi); üstü sahte kalın ve kenar payı. Küçültme
// (`adjustsFontSizeToFit`) bilerek KULLANILMIYOR — Android'de 95 kutucukta
// iteratif ölçüm demek, bkz. theme/applyGlobalFont.ts.
const TIME_FONT_SIZE = 15;
const TIME_WIDTH_EM = 3.5;
const TILE_SIDE_PADDING = 6;

function columnsFor(gridWidth: number, fontScale: number): number {
  const scale = Math.min(fontScale, MAX_FONT_SCALE);
  const minTile = TIME_FONT_SIZE * TIME_WIDTH_EM * scale + TILE_SIDE_PADDING * 2;
  const fits = Math.floor((gridWidth + GRID_GAP) / (minTile + GRID_GAP));
  return Math.max(MIN_COLUMNS, Math.min(MAX_COLUMNS, fits));
}


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
              {/* `numberOfLines` + `adjustsFontSizeToFit`: etiket sekmeye HER
                  koşulda sığsın. `fontSize` sabit (12.5) ama `allowFontScaling`
                  varsayılan açık olduğu için cihazın sistem yazı boyutu
                  büyütülmüşse etiket de büyüyor — üç sekme `flex: 1` ile ekranı
                  eşit bölüştüğünden uzun etiket ("Cumartesi") o genişliğe
                  sığmayıp ikinci satıra taşıyor ve hapın dışında kalıyordu.
                  Testçi tablosu buydu: bazı Android cihazlarda sekme yazısı
                  okunmuyor. Şimdi tek satırda kalıp gerekirse %85'e kadar
                  küçülüyor; küçülme yalnızca sığmayan cihazlarda devreye
                  giriyor, normal ayarda görünüm birebir aynı. */}
              <Text
                style={[styles.tabText, { color: active ? t.onAccent : t.ink2 }]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.85}
              >
                {s.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

// TEK KUTUCUK — memoize.
//
// ESKİDEN gün/kalkış değişiminde ızgara 450 ms'lik yapay bir iskelete dönüyordu
// (`setTimeout(() => setLoading(false), 450)`). O iskelet gerçek sorunu —
// 95+ kutucuğun tek karede çizilmesini — çözmüyor, üstünü örtüyordu: kullanıcı
// beklemeyi "donma" olarak görüyordu (bkz. docs/plans/2026-09-13-performans-*).
//
// Maliyet artık gerçekten düşük olduğu için gecikme kaldırıldı. Üç şart var ve
// üçü de bu dosyada korunmalı, yoksa memo boşa düşer:
//   1. `surface` ve `marks` referansları sabit olmalı (biri `useMemo`, diğeri
//      modül seviyesindeki `markerCache`'ten geliyor).
//   2. `t` zaten sabit (LIGHT/DARK modül sabitleri).
//   3. Kutucuğa satır içi nesne prop'u GEÇME — `isNext` gibi primitifler kalsın.
//
// Bunun asıl kazancı gün değişiminde değil: "sıradaki sefer" için saat 30
// saniyede bir güncelleniyor (aşağıdaki `nowMinutes`), yani ekran açıkken her
// yarım dakikada bir tüm ızgara yeniden çiziliyordu. Artık yalnızca `isNext`'i
// değişen tek kutucuk çiziliyor.
const Tile = React.memo(function Tile({
  time,
  marks,
  width,
  isNext,
  surface,
  t,
}: {
  time: string;
  marks: MarkerKind[];
  width: number;
  isNext: boolean;
  surface: object;
  t: FeedTokens;
}) {
  return (
    <View style={[styles.tile, surface, { width }, isNext && { borderColor: t.accent, borderWidth: 1.5 }]}>
      {/* `numberOfLines={1}`: hesap bir cihazda yine de tutmazsa saat ikiye
          bölünmesin; en kötü ihtimalle kenardan kırpılır. */}
      <Text style={[styles.time, { color: isNext ? t.accent : t.ink }]} numberOfLines={1}>
        {time}
      </Text>
      {/* İşaret satırı not olmasa da duruyor: kutucukların yüksekliği satırdan
          satıra oynamasın diye. */}
      <View style={styles.markers}>
        {marks.map((kind) => (
          <Marker key={kind} kind={kind} t={t} />
        ))}
      </View>
    </View>
  );
});

export default function Ego130ScheduleScreen() {
  const { theme } = useTheme();
  const t = useFeedTokens();
  const cardSurface = useCardSurface();
  // Kutucuklar kartın kendi yüzeyinde duruyor (açık temada beyaz üstüne beyaz),
  // bu yüzden ayrımı açıkta yumuşak gölge + ince çizgi, koyuda bir kademe açık
  // zemin + biraz daha belirgin çizgi yapıyor — koyu temada gölge görünmüyor.
  // `useMemo` ŞART: bu nesne her `Tile`'a prop olarak gidiyor. Her render'da
  // yeniden kurulsaydı 95 kutucuğun memo'su da her render'da düşerdi.
  const tileSurface = React.useMemo(
    () =>
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
          },
    [theme, t.card, t.line]
  );
  const [gridWidth, setGridWidth] = useState(0);
  // Ekran cihazın O ANKİ gününe düşüyor — eskiden sabit `'weekday'` idi,
  // Pazar günü giren biri "Hafta İçi" tarifesiyle karşılaşıyordu.
  const [activeDay, setActiveDay] = useState<Ego130DayKey>(() => dayKeyForOffset(0));
  const [origin, setOrigin] = useState<Origin>('campus');

  // Cihaz saati dakikada bir tazeleniyor — "sıradaki sefer" kartının canlı
  // kalması için (kullanıcı isteği: "cihaz saati okunup sırada ring saati
  // yazmalı").
  const [nowMinutes, setNowMinutes] = useState(() => {
    const d = new Date();
    return d.getHours() * 60 + d.getMinutes();
  });
  useEffect(() => {
    const id = setInterval(() => {
      const d = new Date();
      setNowMinutes(d.getHours() * 60 + d.getMinutes());
    }, 30_000);
    return () => clearInterval(id);
  }, []);

  const handleSelectDay = (key: Ego130DayKey) => {
    if (key !== activeDay) setActiveDay(key);
  };

  const scheduleSource = origin === 'metro' ? EGO_130_METRO_SCHEDULES : EGO_130_SCHEDULES;

  const activeSchedule = useMemo(() => {
    return scheduleSource.find((s) => s.key === activeDay)!;
  }, [activeDay, scheduleSource]);

  // Her render'da `new Date()` kurmak yerine güne bağlı tek hesap.
  const isToday = useMemo(() => activeDay === dayKeyForOffset(0), [activeDay]);

  // "Sıradaki sefer": aktif tarife bugünse cihaz saatinden büyük/eşit ilk
  // kalkışı bul. Ham veri gece yarısını geçen seferleri (00:10, 00:40, 01:25)
  // listenin BAŞINDA tutuyor — bu yüzden günün seferleri bittiğinde (23:30'dan
  // sonra) `find` hiçbir şey bulamıyor, o zaman yarının aynı gün-tipi
  // tarifesinin İLK seferine düşülüyor (ki bu zaten 00:xx'tir).
  const nextInfo = useMemo(() => {
    if (!isToday) return null;
    const upcoming = activeSchedule.departures.find((d) => toMinutes(d.time) >= nowMinutes);
    if (upcoming) return { time: upcoming.time, minutesUntil: toMinutes(upcoming.time) - nowMinutes, tomorrow: false };
    const tomorrowSchedule = scheduleSource.find((s) => s.key === dayKeyForOffset(1));
    const first = tomorrowSchedule?.departures[0];
    return first ? { time: first.time, minutesUntil: null, tomorrow: true } : null;
  }, [isToday, activeSchedule, nowMinutes, scheduleSource]);

  // Eski düzende kutucuklar `flex-wrap` ile kendi genişliklerince diziliyordu,
  // satırlar tırtıklı çıkıyordu. Genişlik ızgaranın KENDİ ölçüsünden (onLayout)
  // türetiliyor — pencere genişliğinden hesaplamak AppShell'in kendi yatay
  // payını hesaba katmadığı için satıra 4 yerine 3 kutucuk sığdırıyordu.
  const { fontScale } = useWindowDimensions();
  const columns = columnsFor(gridWidth, fontScale);
  const tileWidth = gridWidth > 0 ? Math.floor((gridWidth - GRID_GAP * (columns - 1)) / columns) : 0;

  // Kutucuk verisi tarife başına bir kere: `markersFor` artık önbellekli ama
  // 95 çağrıyı da her render'da yapmanın anlamı yok. `nowMinutes` 30 saniyede
  // bir değiştiği için bu liste O render'larda da aynı kalmalı — bağımlılık
  // sadece aktif tarife.
  const tiles = useMemo(
    () => activeSchedule.departures.map((d) => ({ time: d.time, marks: markersFor(d.note) })),
    [activeSchedule]
  );

  // Vurgulanacak sefer: yalnızca bugünkü, henüz gelmemiş sefer (yarına düşen
  // fallback'te ızgara farklı bir gün-tipi olabileceğinden vurgulanmıyor).
  const nextTileTime = isToday && nextInfo && !nextInfo.tomorrow ? nextInfo.time : null;

  return (
    <ScrollView
      // `flex: 1` şart: yoksa ScrollView'in kendi yüksekliği İÇERİĞİNE göre
      // belirleniyor (sınırsız), yani kaydıracak bir "pencere" hiç oluşmuyor —
      // içerik ekran altından taşıp gövde tarafından kesiliyor ama parmakla
      // aşağı kaydırmak hiçbir şey yapmıyordu. `paddingBottom` (tab bar payı)
      // tek başına bunu çözmüyordu, kaydırma zaten mümkün değildi.
      //
      // ESKİDEN burada `pointerEvents="box-none"` vardı — bu ScrollView'in
      // KENDİSİNİN dokunuşa yanıt vermemesini, yalnızca dokunulabilir alt
      // öğelerin (butonlar vs.) tepki vermesini sağlıyor. Kayan içerik ama
      // dokunulabilir olmayan boş alanlar (kutucuklar arası boşluk, üstteki
      // yazılar) böylece kaydırma jestini hiç yakalayamıyordu — parmağın hiçbir
      // şeye "dokunmadığı" boşluklarda sürükleme sonuçsuz kalıyordu. WaveTabBar
      // zaten AppShell'de bu ekranın DIŞINDA, ayrı bir katmanda duruyor —
      // buradaki box-none onun için de gerekli değildi.
      style={{ flex: 1, backgroundColor: t.ground }}
      contentContainerStyle={{ padding: SCREEN_PADDING, paddingTop: 16, paddingBottom: TAB_BAR_SAFE_PADDING }}
    >
      <View style={styles.titleRow}>
        <Bus size={26} color={t.accent} />
        <Text style={[styles.title, { color: t.ink }]}>130 Ring Saatleri</Text>
      </View>
      <Text style={[styles.subtitle, { color: t.ink2 }]}>
        Beytepe Metro İstasyonu ↔ Hacettepe Beytepe Kampüsü ring hattı
      </Text>

      {/* Eskiden burada "Resmi EGO verisi değil, derlenmiş saatlerdir" uyarısı
          vardı — kullanıcı isteğiyle kaldırıldı, yerine cihaz saatine göre
          hesaplanan "sıradaki sefer" kartı geldi. */}
      {isToday && nextInfo && (
        <View style={[styles.nextCard, { backgroundColor: `${t.accent}14`, borderColor: `${t.accent}40` }]}>
          <Clock size={18} color={t.accent} style={{ marginTop: 1 }} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.nextLabel, { color: t.ink2 }]}>
              {nextInfo.tomorrow ? 'Bugünkü seferler bitti — ilk sefer' : 'Sıradaki sefer'}
            </Text>
            <Text style={[styles.nextTime, { color: t.ink }]}>{nextInfo.time}</Text>
            <Text style={[styles.nextMeta, { color: t.ink3 }]}>
              {ORIGIN_LABEL[origin]}
              {nextInfo.tomorrow ? ' · yarın' : ` · ${nextInfo.minutesUntil} dk sonra`}
            </Text>
          </View>
        </View>
      )}
      {!isToday && (
        <View style={[styles.nextCard, { backgroundColor: t.inset, borderColor: t.line }]}>
          <Clock size={18} color={t.ink3} style={{ marginTop: 1 }} />
          <Text style={[styles.nextMeta, { color: t.ink2, flex: 1 }]}>
            Bugün değil — {activeSchedule.label} tarifesine bakıyorsun.
          </Text>
        </View>
      )}

      <DayTabs activeDay={activeDay} onSelect={handleSelectDay} />

      {/* Kalkış noktası anahtarı: aynı sefer listesi, kampüs kalkışı ya da
          metro durağındaki tahmini saat. */}
      <View style={styles.metaRow}>
        <Pressable
          onPress={() => setOrigin((prev) => (prev === 'campus' ? 'metro' : 'campus'))}
          style={[styles.originButton, { backgroundColor: t.inset, borderColor: t.line }]}
        >
          <ArrowUpDown size={14} color={t.accent} />
          <Text style={[styles.originText, { color: t.ink }]} numberOfLines={1}>
            {ORIGIN_LABEL[origin]}
          </Text>
        </Pressable>
        <Text style={[styles.count, { color: t.ink3 }]}>{activeSchedule.departures.length} sefer</Text>
      </View>

      <View style={[styles.card, cardSurface]}>
        <View onLayout={(e) => setGridWidth(e.nativeEvent.layout.width)}>
          {tileWidth > 0 && (
            <View style={styles.grid}>
              {tiles.map((tile, i) => (
                <Tile
                  key={`${tile.time}-${i}`}
                  time={tile.time}
                  marks={tile.marks}
                  width={tileWidth}
                  isNext={tile.time === nextTileTime}
                  surface={tileSurface}
                  t={t}
                />
              ))}
            </View>
          )}
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
  nextCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 14,
  },
  nextLabel: { fontSize: 11.5, fontWeight: '600' },
  nextTime: { fontSize: 22, fontWeight: '800', fontVariant: ['tabular-nums'], marginTop: 1 },
  nextMeta: { fontSize: 12, marginTop: 2 },
  tabs: { borderRadius: 999, borderWidth: StyleSheet.hairlineWidth, marginTop: 14 },
  tabsRow: { flexDirection: 'row', padding: TABS_PADDING },
  // `paddingHorizontal`: etiket sekme kenarına yapışmasın — küçülme devreye
  // girdiğinde bile iki yanda nefes payı kalsın.
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 8, paddingHorizontal: 6, borderRadius: 999 },
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
    paddingHorizontal: TILE_SIDE_PADDING,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  time: { fontSize: TIME_FONT_SIZE, fontWeight: '600', fontVariant: ['tabular-nums'] },
  markers: { flexDirection: 'row', gap: 4, height: MARKER_SIZE },
  legend: { marginTop: 14, gap: 8, paddingHorizontal: 2 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  // `flex: 1`: işaretten sonra kalan genişlik hesaplanmadığı için uzun
  // açıklamalar yatayda uzayıp kırpılıyordu.
  legendText: { fontSize: 12, flex: 1 },
});
