import { StyleSheet } from 'react-native';
import { useTheme } from '../context/ThemeContext';

// "Sakin akış" (R1) tasarımının renk seti — gönderi akışı ve gönderi detayı
// bu tek kaynaktan besleniyor:
//  1. Her gönderi KENDİ kartında. Koyu temada ayrımı zemin/kart kontrastı,
//     açık temada (web'deki gibi, ikisi de beyaz) yumuşak gölge yapıyor —
//     bkz. useCardSurface().
//  2. Vurgu rengi TEK işe ayrıldı: dosya. Bölüm adı nötr metin — daha önce
//     ikisi birbiriyle yarışıyordu.
export interface FeedTokens {
  ground: string; // kartların arkasındaki zemin
  card: string; // kartın kendi yüzeyi
  inset: string; // kartın İÇİNDE gömülü yüzey (+N kutucuğu, avatar zemini)
  line: string; // ince çerçeve / ayırıcı
  ink: string; // başlık
  ink2: string; // içerik, bölüm, sayaçlar
  ink3: string; // fakülte/künye, en soluk kademe
  accent: string; // yalnızca dosya
  onAccent: string; // dosya ikonunun üstündeki renk
  amber: string; // yıldız
  danger: string; // silme
}

const DARK: FeedTokens = {
  ground: '#11161C',
  card: '#1B222A',
  inset: '#262F39',
  line: '#2A333D',
  ink: '#E9E3D8',
  ink2: '#8D99A5',
  ink3: '#69737E',
  accent: '#6FB3AB',
  onAccent: '#11161C',
  amber: '#D9A62E',
  danger: '#E1786B',
};

const LIGHT: FeedTokens = {
  // Zemin, uygulamanın ortak `--ground` değeriyle aynı (bkz. theme/palette.ts):
  // kart beyaz, zemin bir tık gri — kartlar hem gölgeyle hem kontrastla ayrışıyor.
  ground: '#F4F5F7',
  card: '#FFFFFF',
  inset: '#F2F4F2',
  line: '#E7E9E6',
  ink: '#1B2227',
  ink2: '#6C7780',
  ink3: '#97A0A8',
  accent: '#2F5755',
  onAccent: '#FFFFFF',
  amber: '#B5851C',
  danger: '#C2453A',
};

export function useFeedTokens(): FeedTokens {
  const { theme } = useTheme();
  return theme === 'dark' ? DARK : LIGHT;
}

// Kartın yüzeyi iki temada farklı yolla ayrışıyor:
//  - Koyu: zemin koyu, kart bir kademe açık + saç teli çerçeve (gölge koyu
//    zeminde zaten görünmüyor).
//  - Açık: ikisi de beyaz, ayrımı yumuşak gölge yapıyor — web'deki görünüm.
//
// İkisi de MODÜL SEVİYESİNDE sabit. Eskiden `useCardSurface` her çağrıda yeni
// bir nesne literali döndürüyordu: değer yalnızca temaya bağlı olduğu hâlde
// kimliği her render'da değişiyor, dolayısıyla bu nesneyi prop olarak ya da
// stil dizisi içinde alan her yerde memo karşılaştırması sessizce bozuluyordu.
// Akış kartı bunu her satırda okuyor (bkz. PostCardModern.tsx).
const DARK_CARD_SURFACE = {
  backgroundColor: DARK.card,
  borderColor: DARK.line,
  borderWidth: StyleSheet.hairlineWidth,
} as const;

const LIGHT_CARD_SURFACE = {
  backgroundColor: LIGHT.card,
  shadowColor: '#000',
  shadowOpacity: 0.08,
  shadowRadius: 10,
  shadowOffset: { width: 0, height: 3 },
  elevation: 2,
} as const;

export function useCardSurface() {
  const { theme } = useTheme();
  return theme === 'dark' ? DARK_CARD_SURFACE : LIGHT_CARD_SURFACE;
}

// Backend dosyanın orijinal adını saklamıyor
// (files-1786979593014-827053470.pdf) — elimizdeki tek bilgi uzantı, dosya
// kutucuğunun altındaki tür etiketi de ondan türetiliyor.
export type FileKind = 'pdf' | 'word' | 'image' | 'sheet' | 'slide' | 'other';

const KIND_BY_EXTENSION: Record<string, FileKind> = {
  pdf: 'pdf',
  doc: 'word',
  docx: 'word',
  odt: 'word',
  rtf: 'word',
  txt: 'word',
  jpg: 'image',
  jpeg: 'image',
  png: 'image',
  webp: 'image',
  gif: 'image',
  heic: 'image',
  xls: 'sheet',
  xlsx: 'sheet',
  csv: 'sheet',
  ppt: 'slide',
  pptx: 'slide',
};

const LABEL_BY_KIND: Record<FileKind, string> = {
  pdf: 'PDF',
  word: 'Word',
  image: 'Resim',
  sheet: 'Excel',
  slide: 'Sunum',
  other: 'Dosya',
};

export function fileExtension(fileName?: string): string {
  if (!fileName) return '';
  const dot = fileName.lastIndexOf('.');
  return dot > -1 ? fileName.slice(dot + 1).toLowerCase() : '';
}

export function fileKind(fileName?: string): FileKind {
  return KIND_BY_EXTENSION[fileExtension(fileName)] ?? 'other';
}

// Kutucuğun altında yazan tür: PDF / Word / Resim … Tanımadığımız bir uzantı
// gelirse uzantının kendisi yazılıyor (ör. ZIP), "Dosya" demekten daha bilgili.
export function fileKindLabel(fileName?: string): string {
  const kind = fileKind(fileName);
  if (kind !== 'other') return LABEL_BY_KIND[kind];
  const ext = fileExtension(fileName);
  return ext && ext.length <= 5 ? ext.toUpperCase() : LABEL_BY_KIND.other;
}
