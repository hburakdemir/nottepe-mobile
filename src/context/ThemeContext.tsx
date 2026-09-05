import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { View, useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { vars } from 'nativewind';
import { DARK_VARS, LIGHT_VARS, THEME_COLORS, type ThemeColors } from '../theme/palette';

const STORAGE_KEY = 'nottepe_theme';

// Tema değişimi ucuz bir React render'ı olsa da, art arda hızlı tıklamalar
// (özellikle sistem/açık/koyu arasında ping-pong) gereksiz yeniden çizimlere
// yol açıyordu — her değişiklik arasında en az bu kadar bekleniyor.
const THEME_CHANGE_COOLDOWN_MS = 30_000;

export type ThemePreference = 'system' | 'light' | 'dark';
type Theme = 'light' | 'dark';

interface ThemeContextValue {
  theme: Theme;
  themePreference: ThemePreference;
  setThemePreference: (pref: ThemePreference) => void;
  colors: ThemeColors;
  /** Epoch ms — bu ana kadar yeni bir tema değişikliği kabul edilmiyor. Geçmişte/0 ise kilit yok.
   *  Değer sabit kaldığı için canlı geri sayım GÖSTERMEZ; tüketen taraf (bkz. ThemePickerModal)
   *  kendi `setInterval`'ıyla `Date.now()`'a karşı okuyup saniyede bir yeniden render etmeli. */
  themeChangeLockedUntil: number;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

// StyleSheet/inline stil isteyen yerler (SVG dolgusu, ikon rengi, gölge…) için
// aynı paletin düz JS karşılığı. className kullanabildiğin her yerde token
// sınıflarını (bg-surface, text-ink…) tercih et.
export const useThemeColors = (): ThemeColors => useTheme().colors;

// TEMA ARTIK NATIVE TARAFA HİÇ DOKUNMUYOR.
//
// Eskiden NativeWind'in `setColorScheme`'i çağrılıyordu; o da RN'in
// `Appearance.setColorScheme`'ini, o da Android'de
// `AppCompatDelegate.setDefaultNightMode`'u tetikliyordu. Sonuçları:
//   1. Her tema değişimi bir native konfigürasyon değişimiydi — görünür flash,
//      tüm ağacın yeniden yerleşmesi, sayfanın zıplaması.
//   2. `Appearance` kalıcı olarak override edildiği için, ilk açılışta tercih
//      'light' yazıldığı an cihazın GERÇEK teması bir daha hiç okunamıyordu;
//      "Sistem" seçeneği bu yüzden hiç çalışmadı.
//   3. Gizlemek için ekran fotoğrafı alıp çapraz geçiş yapılıyordu
//      (captureRef + 250ms yakalama + 140ms bekleme + 280ms solma) — yani tema
//      değiştirmek yarım saniyeden fazla donmuş bir ekran demekti.
//
// Şimdi: renkler CSS değişkeni (bkz. theme/palette.ts), değişkenler burada tek
// bir kök View'a basılıyor. Tema değişimi tek bir React render'ı — anlık ve
// pürüzsüz. `Appearance` hiç override edilmediği için `useColorScheme()` her
// zaman cihazın gerçek temasını döndürüyor.
export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const systemScheme = useColorScheme();
  // Varsayılan artık 'light' değil 'system': kurulumdan hemen sonra uygulama
  // cihazın temasına uyuyor (kullanıcı isteği).
  const [themePreference, setPreferenceState] = useState<ThemePreference>('system');
  // Eşzamanlı okuma için ref (setPreferenceState'in fonksiyonel updater'ı içinde
  // state'e güvenilmez); `themeChangeLockedUntil` ise aynı anı UI'a taşıyan
  // state kopyası — ThemePickerModal kilit süresi boyunca görünür bir geri
  // sayım göstersin diye (bkz. o dosyadaki not: eskiden her tıklamada aynı
  // Alert'i tekrar tekrar açıyorduk, sayaç GÖRÜNMÜYORDU).
  const lastChangeAt = useRef(0);
  const [themeChangeLockedUntil, setThemeChangeLockedUntil] = useState(0);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (stored === 'system' || stored === 'light' || stored === 'dark') setPreferenceState(stored);
      })
      .catch(() => {});
  }, []);

  const setThemePreference = useCallback((pref: ThemePreference) => {
    setPreferenceState((current) => {
      if (pref === current) return current;
      const now = Date.now();
      if (now - lastChangeAt.current < THEME_CHANGE_COOLDOWN_MS) return current;
      lastChangeAt.current = now;
      setThemeChangeLockedUntil(now + THEME_CHANGE_COOLDOWN_MS);
      AsyncStorage.setItem(STORAGE_KEY, pref).catch(() => {});
      return pref;
    });
  }, []);

  const theme: Theme = themePreference === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : themePreference;

  const value = useMemo<ThemeContextValue>(
    () => ({ theme, themePreference, setThemePreference, colors: THEME_COLORS[theme], themeChangeLockedUntil }),
    [theme, themePreference, setThemePreference, themeChangeLockedUntil]
  );

  // `vars()` CSS değişkenlerini bu View'ın ALTINDAKİ her şeye miras bırakıyor —
  // Modal içerikleri dahil, çünkü miras React ağacını takip ediyor.
  const themeVars = useMemo(() => vars(theme === 'dark' ? DARK_VARS : LIGHT_VARS), [theme]);

  return (
    <ThemeContext.Provider value={value}>
      <View style={[{ flex: 1, backgroundColor: THEME_COLORS[theme].ground }, themeVars]}>{children}</View>
    </ThemeContext.Provider>
  );
};
