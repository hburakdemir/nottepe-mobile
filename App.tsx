import { applyGlobalFont } from './src/theme/applyGlobalFont';
applyGlobalFont();

import 'react-native-gesture-handler';
import './global.css';
import React from 'react';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useFonts as useInterFonts, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, Inter_800ExtraBold } from '@expo-google-fonts/inter';
import { useFonts as useRobotoFonts, Roboto_400Regular, Roboto_500Medium, Roboto_700Bold } from '@expo-google-fonts/roboto';
import { useFonts as useNotoSansFonts, NotoSans_400Regular, NotoSans_500Medium, NotoSans_600SemiBold, NotoSans_700Bold, NotoSans_800ExtraBold } from '@expo-google-fonts/noto-sans';
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

export default function App() {
  // Font A/B testi için: APP_FONT_FAMILY'nin (src/theme/typography.ts) hangi
  // değeri kullanılırsa kullanılsın gerçek bileşenin hazır olması için üç aday
  // ailenin de ana ağırlıkları önceden yükleniyor. Test bitince bu fontlar ve
  // paketler kaldırılabilir; kalıcı font seçimi netleşince sadece o paket kalır.
  const [interLoaded] = useInterFonts({ Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, Inter_800ExtraBold });
  const [robotoLoaded] = useRobotoFonts({ Roboto_400Regular, Roboto_500Medium, Roboto_700Bold });
  const [notoSansLoaded] = useNotoSansFonts({ NotoSans_400Regular, NotoSans_500Medium, NotoSans_600SemiBold, NotoSans_700Bold, NotoSans_800ExtraBold });
  const fontsReady = interLoaded && robotoLoaded && notoSansLoaded;

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
                <NavigationContainer>
                  <RootNavigator />
                  <ThemedStatusBar />
                </NavigationContainer>
              </SavedPostsProvider>
            </AuthProvider>
          </QueryClientProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
