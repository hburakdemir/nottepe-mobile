// Uygulamanın TEK renk kaynağı.
//
// Neden CSS değişkeni? Eskiden tema `dark:` varyantlarıyla çiziliyordu ve
// varyantı çevirmenin tek yolu NativeWind'in `setColorScheme`'iydi. O da
// RN'in `Appearance.setColorScheme`'ini çağırıyor; Android'de bu doğrudan
// `AppCompatDelegate.setDefaultNightMode` demek — yani her tema değişiminde
// native bir konfigürasyon değişimi (görünür flash + yeniden yerleşim), üstelik
// `Appearance` kalıcı olarak override edildiği için ondan sonra CİHAZIN gerçek
// teması hiç okunamıyordu ("sistem" seçeneği çalışmıyordu).
//
// Artık hiçbir yerde `dark:` yok: her renk `var(--…)` üzerinden geliyor ve
// değişkenleri ThemeProvider kökteki tek bir View'a `vars()` ile basıyor.
// Tema değişimi saf JS: native tarafa hiç dokunulmuyor, flash yok, `Appearance`
// hiç override edilmediği için sistem teması her zaman doğru okunuyor.
//
// Değerler göçten ÖNCEKİ sınıf çiftlerinin çözülmüş halleridir; yani görünüm
// bilerek birebir korundu (Tailwind gray tonları + projenin kendi renkleri).

export type ThemeVars = Record<string, string>;

export const LIGHT_VARS: ThemeVars = {
  // — Zeminler ————————————————————————————————
  // Zemin BİLEREK saf beyaz değil: kartlar (`--surface`) beyaz ve ikisi aynı
  // olunca açık temada kart sınırları tamamen kayboluyordu (emülatör testinde
  // Bildirimler/Öneriler/SSS listelerinde satırlar havada duruyordu).
  '--ground': '#F4F5F7', // sayfa zemini (ana sayfa dahil her ekran)
  '--surface': '#FFFFFF', // kart / panel / üst bar
  '--inset': '#F3F4F6', // kartın İÇİNE gömülü yüzey: girdi, chip, avatar zemini

  // — Metin ——————————————————————————————————
  '--ink': '#111827', // başlık
  '--ink2': '#374151', // gövde
  '--muted': '#6B7280', // ikincil / künye
  '--muted2': '#9CA3AF', // en soluk kademe

  // — Çizgiler ————————————————————————————————
  '--line': '#E5E7EB', // görünür çerçeve
  '--line-soft': '#F3F4F6', // ayırıcı, saç teli

  // — Marka ——————————————————————————————————
  '--accent': '#2F5755',
  '--accent-soft': 'rgba(47,87,85,0.10)',
  '--accent-line': 'rgba(47,87,85,0.30)',

  // — Durumlar ————————————————————————————————
  '--danger': '#DC2626',
  '--danger-soft': '#FEF2F2',
  '--danger-line': '#FECACA',
  '--success': '#16A34A',
  '--success-soft': '#F0FDF4',
  '--success-line': '#BBF7D0',
  '--info': '#1D4ED8',
  '--warn': '#EA580C',
  '--warn-soft': '#FEF9C3',
  '--warn-ink': '#854D0E',

  // — Tek kullanımlıklar ————————————————————————
  '--on-badge': '#1E3A8A', // rozet üstündeki koyu mavi yazı
  '--avatar-ring': '#222831',
  '--fail': '#8C1007', // AKTS: kalınan harf notu
  '--fail-soft': 'rgba(140,16,7,0.10)',
};

export const DARK_VARS: ThemeVars = {
  '--ground': '#11161C',
  '--surface': '#222831',
  '--inset': '#333A44',

  '--ink': '#DFD0B8',
  '--ink2': '#DFD0B8',
  '--muted': '#9CA3AF',
  '--muted2': '#6B7280',

  '--line': '#4B5563',
  '--line-soft': 'rgba(55,65,81,0.40)',

  '--accent': '#5A9690',
  '--accent-soft': 'rgba(90,150,144,0.20)',
  '--accent-line': 'rgba(90,150,144,0.40)',

  '--danger': '#F87171',
  '--danger-soft': 'rgba(69,10,10,0.40)',
  '--danger-line': 'rgba(153,27,27,0.60)',
  '--success': '#4ADE80',
  '--success-soft': 'rgba(5,46,22,0.40)',
  '--success-line': 'rgba(22,101,52,0.60)',
  '--info': '#60A5FA',
  '--warn': '#FB923C',
  '--warn-soft': 'rgba(113,63,18,0.40)',
  '--warn-ink': '#FDE047',

  '--on-badge': '#C5D3E8',
  '--avatar-ring': 'rgba(223,208,184,0.30)',
  '--fail': '#DC2626',
  '--fail-soft': 'rgba(220,38,38,0.20)',
};

// StyleSheet/inline stil isteyen yerler için (SVG, gölge, ikon rengi…) aynı
// değerlerin düz JS karşılığı — bkz. useThemeColors() in ThemeContext.tsx.
export const THEME_COLORS = {
  light: {
    ground: LIGHT_VARS['--ground'],
    surface: LIGHT_VARS['--surface'],
    inset: LIGHT_VARS['--inset'],
    ink: LIGHT_VARS['--ink'],
    ink2: LIGHT_VARS['--ink2'],
    muted: LIGHT_VARS['--muted'],
    muted2: LIGHT_VARS['--muted2'],
    line: LIGHT_VARS['--line'],
    lineSoft: LIGHT_VARS['--line-soft'],
    accent: LIGHT_VARS['--accent'],
    accentSoft: LIGHT_VARS['--accent-soft'],
    danger: LIGHT_VARS['--danger'],
    // AKTS: kalınan harf notu / kalınan AKTS çubuğu (bkz. --fail).
    fail: LIGHT_VARS['--fail'],
    dangerSoft: LIGHT_VARS['--danger-soft'],
    dangerLine: LIGHT_VARS['--danger-line'],
    success: LIGHT_VARS['--success'],
    successSoft: LIGHT_VARS['--success-soft'],
    successLine: LIGHT_VARS['--success-line'],
    info: LIGHT_VARS['--info'],
    warn: LIGHT_VARS['--warn'],
  },
  dark: {
    ground: DARK_VARS['--ground'],
    surface: DARK_VARS['--surface'],
    inset: DARK_VARS['--inset'],
    ink: DARK_VARS['--ink'],
    ink2: DARK_VARS['--ink2'],
    muted: DARK_VARS['--muted'],
    muted2: DARK_VARS['--muted2'],
    line: DARK_VARS['--line'],
    lineSoft: DARK_VARS['--line-soft'],
    accent: DARK_VARS['--accent'],
    accentSoft: DARK_VARS['--accent-soft'],
    danger: DARK_VARS['--danger'],
    // AKTS: kalınan harf notu / kalınan AKTS çubuğu (bkz. --fail).
    fail: DARK_VARS['--fail'],
    dangerSoft: DARK_VARS['--danger-soft'],
    dangerLine: DARK_VARS['--danger-line'],
    success: DARK_VARS['--success'],
    successSoft: DARK_VARS['--success-soft'],
    successLine: DARK_VARS['--success-line'],
    info: DARK_VARS['--info'],
    warn: DARK_VARS['--warn'],
  },
} as const;

export type ThemeColors = (typeof THEME_COLORS)['light'];
