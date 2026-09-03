import { applyGlobalFont } from './src/theme/applyGlobalFont';
applyGlobalFont();

import 'react-native-gesture-handler';
import './global.css';
import React from 'react';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { DarkTheme, DefaultTheme, NavigationContainer, type Theme } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useFonts as useSoraFonts, Sora_400Regular, Sora_500Medium, Sora_600SemiBold, Sora_700Bold, Sora_800ExtraBold } from '@expo-google-fonts/sora';
import { AuthProvider } from './src/context/AuthContext';
import { SavedPostsProvider } from './src/context/SavedPostContext';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import RootNavigator from './src/navigation/RootNavigator';

const queryClient = new QueryClient();

// Expo SDK 57'de Android edge-to-edge zorunlu ve expo-status-bar artik ayri bir
// backgroundColor kabul etmiyor (durum cubugu her zaman saydam, altindaki icerik
// gorunur) — bu yuzden rengi AppShell'deki SafeAreaView'in kendi arka plani
// belirliyor (bkz. o dosyadaki not); burada sadece ikon/saat rengini (acik/koyu)
// temaya gore ayarliyoruz. Not: Expo Go'da native edge-to-edge yapilandirmasi
// projeye gomulu olmadigindan bu orada hala eski siyah cubuk gibi gorunebilir —
// gercek (dev-client/production) derlemede duzelir.
function ThemedStatusBar() {
  const { theme } = useTheme();
  return <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />;
}

// react-navigation'in VARSAYILAN temasi acik ve arka plani rgb(242,242,242).
// Konteynere hic tema verilmedigi icin, itilen sayfanin yuvarlatilmis
// kose"lerinin ARKASINDA kalan bosluklarda (ust-sol ve alt-sol) tam da bu renk
// goruluyordu — koyu temada beyaz bir centik gibi. Arka plani menu panelininkiyle
// ayni yapiyoruz ki o bosluk menunun devami gibi dursun, centik kaybolsun.
function ThemedNavigationContainer({ children }: { children: React.ReactNode }) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const base = isDark ? DarkTheme : DefaultTheme;
  const navTheme: Theme = {
    ...base,
    colors: { ...base.colors, background: isDark ? '#222831' : '#FFFFFF' },
  };
  return <NavigationContainer theme={navTheme}>{children}</NavigationContainer>;
}

export default function App() {
  const [fontsReady] = useSoraFonts({ Sora_400Regular, Sora_500Medium, Sora_600SemiBold, Sora_700Bold, Sora_800ExtraBold });

  if (!fontsReady) {
    return <View style={{ flex: 1, backgroundColor: '#fff' }} />;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <QueryClientProvider client={queryClient}>
            <AuthProvider>
              <SavedPostsProvider>
                <ThemedNavigationContainer>
                  <RootNavigator />
                  <ThemedStatusBar />
                </ThemedNavigationContainer>
              </SavedPostsProvider>
            </AuthProvider>
          </QueryClientProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
