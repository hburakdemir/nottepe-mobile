import { applyGlobalFont } from './src/theme/applyGlobalFont';
applyGlobalFont();

import 'react-native-gesture-handler';
import './global.css';
import React from 'react';
import { Image, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { enableFreeze } from 'react-native-screens';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { DarkTheme, DefaultTheme, NavigationContainer, type Theme } from '@react-navigation/native';
import { QueryClientProvider } from '@tanstack/react-query';
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
import { queryClient } from './src/lib/queryClient';
import { LIGHT_VARS, DARK_VARS } from './src/theme/palette';

// react-native-screens: odakta olmayan (arka plandaki) ekranlari dondurup
// gereksiz re-render/layout'u engeller — native-stack gecislerinde performans
// icin modul yuklenirken bir kere aktiflestirilmesi yeterli.
enableFreeze(true);

// Fontlar hazır olana kadar (kullanıcı isteği: açılışta logo + altında
// "Nottepe" yazmalı) — native splash bu JS bileşeni ekrana gelmeden önce
// kendiliğinden kayboluyor (preventAutoHideAsync yönetimi yok), bu yüzden
// boş bir "flash" yaşanmaması için ilk çizilen kare zaten markalı.
function BootScreen() {
  return (
    <View style={{ flex: 1, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }}>
      <Image source={require('./assets/splash-icon.png')} style={{ width: 96, height: 96, resizeMode: 'contain' }} />
      <Text style={{ marginTop: 12, fontSize: 20, fontWeight: '800', color: '#2F5755', letterSpacing: 0.5 }}>Nottepe</Text>
    </View>
  );
}

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
    return { ...base, colors: { ...base.colors, background: isDark ? DARK_VARS['--surface'] : LIGHT_VARS['--surface'] } };
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
    return <BootScreen />;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      {/* KeyboardProvider ağacın TEPESİNDE olmak zorunda: klavye yüksekliğini
          native taraftan tek bir yerden okuyup aşağıdaki bütün
          KeyboardAvoidingView / KeyboardAwareScrollView tüketicilerine
          dağıtıyor. Expo SDK 54'te Android edge-to-edge zorunlu ve o modda
          pencere `adjustResize` ile KÜÇÜLMÜYOR — RN'in kendi
          KeyboardAvoidingView'ı bu yüzden Android'de hiçbir şey yapmıyordu
          (bkz. KeyboardAvoider.tsx). Bu paket klavye çerçevesini WindowInsets
          üzerinden okuduğu için iki platformda da doğru çalışıyor. */}
      <KeyboardProvider>
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
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}
