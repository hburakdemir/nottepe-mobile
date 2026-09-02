import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColorScheme } from 'nativewind';

const STORAGE_KEY = 'nottepe_theme';

// Kullanıcının tercihi 3 değerli (Sistem/Açık/Koyu) — NativeWind'in kendi
// `setColorScheme` API'si zaten 'system' değerini destekliyor ve OS temasını
// canlı takip ediyor, elle bir Appearance listener yazmamıza gerek yok.
export type ThemePreference = 'system' | 'light' | 'dark';
type Theme = 'light' | 'dark';

interface ThemeContextValue {
  theme: Theme;
  themePreference: ThemePreference;
  setThemePreference: (pref: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const { colorScheme, setColorScheme } = useColorScheme();
  const [themePreference, setPreferenceState] = useState<ThemePreference>('light');

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      const next: ThemePreference = stored === 'system' || stored === 'light' || stored === 'dark' ? stored : 'light';
      setPreferenceState(next);
      setColorScheme(next);
    });
  }, [setColorScheme]);

  const setThemePreference = useCallback(
    (pref: ThemePreference) => {
      setPreferenceState(pref);
      setColorScheme(pref);
      AsyncStorage.setItem(STORAGE_KEY, pref).catch(() => {});
    },
    [setColorScheme]
  );

  // `colorScheme`, tercih 'system' iken NativeWind tarafından işletim
  // sistemi temasına göre canlı çözümleniyor — bileşenlerin `theme === 'dark'`
  // gibi koşullu render'ları için her zaman kesin 'light'/'dark' lazım.
  const theme: Theme = colorScheme === 'dark' ? 'dark' : 'light';

  return (
    <ThemeContext.Provider value={{ theme, themePreference, setThemePreference }}>{children}</ThemeContext.Provider>
  );
};
