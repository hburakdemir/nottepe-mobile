import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { View, useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { vars } from 'nativewind';
import { DARK_VARS, LIGHT_VARS, THEME_COLORS, type ThemeColors } from '../theme/palette';

const STORAGE_KEY = 'nottepe_theme';

export type ThemePreference = 'system' | 'light' | 'dark';
type Theme = 'light' | 'dark';

interface ThemeContextValue {
  theme: Theme;
  themePreference: ThemePreference;
  setThemePreference: (pref: ThemePreference) => void;
  colors: ThemeColors;
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

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (stored === 'system' || stored === 'light' || stored === 'dark') setPreferenceState(stored);
      })
      .catch(() => {});
  }, []);

  const setThemePreference = useCallback((pref: ThemePreference) => {
    setPreferenceState(pref);
    AsyncStorage.setItem(STORAGE_KEY, pref).catch(() => {});
  }, []);

  const theme: Theme = themePreference === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : themePreference;

  const value = useMemo<ThemeContextValue>(
    () => ({ theme, themePreference, setThemePreference, colors: THEME_COLORS[theme] }),
    [theme, themePreference, setThemePreference]
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
