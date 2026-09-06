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
import {
  useFonts as useSoraFonts,
  Sora_400Regular,
  Sora_500Medium,
  Sora_600SemiBold,
  Sora_700Bold,
  Sora_800ExtraBold,
} from '@expo-google-fonts/sora';
import { AuthProvider } from './src/context/AuthContext';
import { SavedPostsProvider } from './src/context/SavedPostContext';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import RootNavigator from './src/navigation/RootNavigator';
import { navigationRef, drainPendingTarget } from './src/navigation/navigationRef';
import PushBridge from './src/components/PushBridge';

// Varsayılanlar eskiden boştu: react-query'nin kendi varsayılanı 3 tekrar +
// üstel bekleme demek — çevrimdışıyken bir ekran dakikalarca "yükleniyor"
// kalabiliyordu. `staleTime` de her odaklanmada/mount'ta gereksiz ağ isteğini
// önlüyor (bkz. HomeScreen.tsx odak efekti). Bir hook kendi `retry`/`staleTime`
// değerini verirse (ör. useUnreadNotifications) o değer burayı ezer.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

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
  // Nesne her render'da yeniden kurulursa NavigationContainer temayı degismis
  // sayip tum navigator agacini yeniden ciziyor — tema gecisinde gereksiz bir
  // yeniden yerlesim demek. Tek bagimlilik temanin kendisi.
  const navTheme: Theme = React.useMemo(() => {
    const base = isDark ? DarkTheme : DefaultTheme;
    return { ...base, colors: { ...base.colors, background: isDark ? '#222831' : '#FFFFFF' } };
  }, [isDark]);
  // `ref` + `onReady`: push bildirimine soğuk açılışta dokunulduğunda hedef
  // konteyner hazır olmadan elimize geçiyor, `onReady` o kuyruğu boşaltıyor
  // (bkz. navigationRef.ts).
  return (
    <NavigationContainer ref={navigationRef} theme={navTheme} onReady={drainPendingTarget}>
      {children}
    </NavigationContainer>
  );
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
                  {/* NavigationContainer'ın kardeşi: `useNavigation` ağacın
                      içinde çalışıyor, PushBridge ise dışarıdan (soğuk açılış,
                      AppState) yönlendirme yapmak zorunda (bkz. navigationRef.ts). */}
                  <PushBridge />
                </ThemedNavigationContainer>
              </SavedPostsProvider>
            </AuthProvider>
          </QueryClientProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
