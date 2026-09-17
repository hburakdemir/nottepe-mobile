import { Dimensions, useWindowDimensions } from 'react-native';

// Tablet/iPad desteği için tek kaynak. Eskiden `useWindowDimensions` yalnızca
// ProfileScreen.tsx'te (sekme pager'ı için) kullanılıyordu — geri kalan her
// yerde ölçüler telefon ekranına göre sabitti (202 ham `fontSize:`, 170
// `text-[Npx]`, 44 `w-[Npx]/h-[Npx]` literali), bu yüzden tablette hiçbir şey
// büyümüyordu ve genişlik sabitleri (ör. `DRAWER_WIDTH`) döndürmede/geniş
// ekranda bozuluyordu (kullanıcı isteği: "tablet ve ipad appleri için TÜM
// (HER YER) RESPONSİVE OLMALI").
//
// Eşik: kısa kenarı >= 600dp olan cihazlar "tablet" sayılıyor — bu, Android'in
// kendi `sw600dp` kaynak eşiğiyle aynı, iPad'lerin (en küçük 7.9" mini dahil)
// her yönelimde bu eşiğin üzerinde kalmasını sağlıyor.
const TABLET_SHORT_EDGE_THRESHOLD = 600;

// Tablette yazı/boşluk telefonun aynısı kalırsa küçük görünür ama EKRAN
// GENİŞLİĞİ kadar büyümesi de saçma olur (satırlar okunamayacak kadar uzar) —
// bu yüzden ölçek sabit ve mütevazı (~%15), asıl genişlik kazancı
// `contentMaxWidth` ile bir konteynerde sınırlanıyor (bkz. ContentContainer.tsx).
const TABLET_SCALE = 1.15;

export type SizeClass = 'phone' | 'tablet';

export interface Metrics {
  sizeClass: SizeClass;
  isTablet: boolean;
  width: number;
  height: number;
  isLandscape: boolean;
  /** Fontlar, ikon boyutları vb. tekil ölçüler için — tablette ~%15 büyütür. */
  scale: (n: number) => number;
  /** Boşluk/dolgu için — şimdilik `scale` ile aynı, ayrı tutulması ileride
   *  farklı bir eğri istenirse (ör. boşluk hiç büyümesin) tek yerden değişsin diye. */
  space: (n: number) => number;
  /** İçerik konteyneri için üst sınır — telefon da sınırsız, tablette geniş
   *  ekranda satırların kenardan kenara uzamasını (okunabilirlik için kötü)
   *  önlüyor. Bkz. ContentContainer.tsx. */
  contentMaxWidth: number;
}

function computeMetrics(width: number, height: number): Metrics {
  const shortEdge = Math.min(width, height);
  const isTablet = shortEdge >= TABLET_SHORT_EDGE_THRESHOLD;
  const sizeClass: SizeClass = isTablet ? 'tablet' : 'phone';
  const scale = (n: number) => (isTablet ? Math.round(n * TABLET_SCALE * 100) / 100 : n);

  return {
    sizeClass,
    isTablet,
    width,
    height,
    isLandscape: width > height,
    scale,
    space: scale,
    contentMaxWidth: isTablet ? 720 : Number.POSITIVE_INFINITY,
  };
}

// ÖLÇÜ BAŞINA TEK NESNE — modül seviyesinde önbellek.
//
// `computeMetrics` her çağrıldığında yeni bir `Metrics` nesnesi VE iki yeni
// closure (`scale`, `space`) üretiyor. `useMetrics()` bunu doğrudan çağırdığı
// için her render'da yeni kimlik dönüyordu; bu kimlik aşağıya prop olarak ya da
// stil dizisi içinde geçtiği her yerde `React.memo`/`useMemo` karşılaştırmasını
// sessizce bozuyor.
//
// Önbellek HOOK İÇİNDE (`useMemo`) değil modül seviyesinde: `useMemo` her
// bileşene KENDİ nesnesini verirdi, yani iki bileşen aynı ölçülerde farklı
// kimlikler taşırdı. Modül seviyesinde tek nesne olunca `scale`/`space`
// referansları uygulamanın her yerinde aynı ve karşılaştırmalar tutuyor.
//
// Kapak: bir cihazda pratikte iki anahtar var (dikey/yatay), ama Android'de
// bölünmüş ekran yeniden boyutlandırma sürekli yeni anahtar üretebiliyor —
// sınırsız büyümesin diye 8'i geçince temizleniyor.
const metricsCache = new Map<string, Metrics>();

function cachedMetrics(width: number, height: number): Metrics {
  const key = `${width}x${height}`;
  const hit = metricsCache.get(key);
  if (hit) return hit;
  if (metricsCache.size >= 8) metricsCache.clear();
  const next = computeMetrics(width, height);
  metricsCache.set(key, next);
  return next;
}

/** Reaktif — döndürmede/katlanır cihazlarda yeniden hesaplanır (`useWindowDimensions`). */
export function useMetrics(): Metrics {
  const { width, height } = useWindowDimensions();
  return cachedMetrics(width, height);
}

/** Hook dışı, bir kerelik okumalar için (ör. modül seviyesinde sabit hesaplanan
 *  `DRAWER_WIDTH`'in başlangıç değeri) — reaktif değildir, döndürmeyi izlemez. */
export function getMetricsSnapshot(): Metrics {
  const { width, height } = Dimensions.get('window');
  return cachedMetrics(width, height);
}
