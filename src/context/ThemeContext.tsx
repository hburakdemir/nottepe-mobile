import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Image, StyleSheet, View, useColorScheme as useNativeColorScheme } from 'react-native';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { captureRef } from 'react-native-view-shot';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColorScheme as useNativeWindColorScheme } from 'nativewind';

const STORAGE_KEY = 'nottepe_theme';

// Tema değişimi eskiden tek karede sertçe zıplıyordu. Artık değişimden HEMEN
// ÖNCE ekranın fotoğrafı alınıp üstte tutuluyor, tema uygulandıktan sonra bu
// fotoğraf soluyor — eski görünüm yeni görünüme çapraz geçiyor.
const CROSSFADE_DURATION = 280;
// Yakalama Android'de yavaş olabiliyor; bu süreyi aşarsa geçiş animasyonundan
// vazgeçip temayı eskisi gibi anında uyguluyoruz (donmuş ekran hissi olmasın).
const CAPTURE_TIMEOUT = 250;

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
  const { setColorScheme } = useNativeWindColorScheme();
  // NativeWind v4'ün kendi 'system' takibi Expo 54 + RN 0.81'de canlı
  // güncellemiyor (bilinen üst-kütüphane hatası: OS teması değişince
  // `colorScheme`/`dark:` varyantları senkronize kalmıyor —
  // github.com/nativewind/nativewind/issues/1626). RN'in kendi
  // `useColorScheme`'i güvenilir çalıştığı için köprü olarak kullanılıyor:
  // tercih 'system' iken OS teması her değiştiğinde NativeWind'e elle
  // `setColorScheme` ile bildiriliyor.
  const systemScheme = useNativeColorScheme();
  const [themePreference, setPreferenceState] = useState<ThemePreference>('light');

  const rootRef = useRef<View>(null);
  const [snapshotUri, setSnapshotUri] = useState<string | null>(null);
  const snapshotOpacity = useSharedValue(0);
  const snapshotStyle = useAnimatedStyle(() => ({ opacity: snapshotOpacity.value }));

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      const next: ThemePreference = stored === 'system' || stored === 'light' || stored === 'dark' ? stored : 'light';
      setPreferenceState(next);
      setColorScheme(next === 'system' ? (systemScheme ?? 'light') : next);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setColorScheme]);

  useEffect(() => {
    if (themePreference === 'system') {
      setColorScheme(systemScheme ?? 'light');
    }
  }, [themePreference, systemScheme, setColorScheme]);

  const applyPreference = useCallback(
    (pref: ThemePreference) => {
      setPreferenceState(pref);
      setColorScheme(pref === 'system' ? (systemScheme ?? 'light') : pref);
      AsyncStorage.setItem(STORAGE_KEY, pref).catch(() => {});
    },
    [setColorScheme, systemScheme]
  );

  const setThemePreference = useCallback(
    (pref: ThemePreference) => {
      if (pref === themePreference) return;

      const capture = captureRef(rootRef, { result: 'tmpfile' });
      const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), CAPTURE_TIMEOUT));

      Promise.race([capture, timeout])
        .then((uri) => {
          if (!uri) {
            applyPreference(pref);
            return;
          }
          // Fotoğraf tam görünürken temayı değiştiriyoruz: kullanıcı sert
          // geçişi hiç görmüyor, sadece fotoğrafın solmasını görüyor.
          snapshotOpacity.value = 1;
          setSnapshotUri(uri);
          requestAnimationFrame(() => {
            applyPreference(pref);
            snapshotOpacity.value = withTiming(0, { duration: CROSSFADE_DURATION }, (finished) => {
              if (finished) runOnJS(setSnapshotUri)(null);
            });
          });
        })
        .catch(() => applyPreference(pref));
    },
    [applyPreference, snapshotOpacity, themePreference]
  );

  const theme: Theme = themePreference === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : themePreference;

  return (
    <ThemeContext.Provider value={{ theme, themePreference, setThemePreference }}>
      {/* `collapsable={false}`: yakalanabilmesi için bu View'ın native tarafta
          gerçek bir görünüm olarak kalması şart (RN aksi halde tek çocuklu
          View'ları eliyor). */}
      <View ref={rootRef} collapsable={false} style={{ flex: 1 }}>
        {children}
      </View>
      {snapshotUri && (
        <Animated.View style={[StyleSheet.absoluteFill, snapshotStyle]} pointerEvents="none">
          <Image source={{ uri: snapshotUri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        </Animated.View>
      )}
    </ThemeContext.Provider>
  );
};
