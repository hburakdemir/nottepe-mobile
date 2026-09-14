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
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
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
import { persistOptions } from './src/lib/queryPersist';
import { LIGHT_VARS, DARK_VARS } from './src/theme/palette';
import { DIAGNOSTICS_ENABLED, startDiagnostics } from './src/lib/diagnostics';
import DiagnosticsBadge from './src/components/DiagnosticsBadge';

// 2026-09-13, İKİNCİ tur: KAPATILDI. Sebebi:
//
// Bir önceki turda bunu yalnızca SEKMELER için kapatmıştım (`freezeOnBlur:
// false`, bkz. MainTabsScreen.tsx), çünkü "push edilen stack ekranlarında
// kazancı gerçek ve orada bu hata bildirilmemiş" diye düşünmüştüm. YANLIŞTI.
// Testçi raporu netleşince görüldü: push edilen ekranlarda (`RootNavigator.tsx`
// içindeki `Stack.Navigator`) `freezeOnBlur` için hiçbir override YOKTU —
// yani hâlâ varsayılan `true`. Uygulama zamanının büyük kısmı push edilen
// ekranlarda geçiyor (detaylar, listeler, formlar); testçinin "en büyük sorun,
// arka plandan dönünce 2-3 saniye TÜM UYGULAMA donuyor" dediği tam bu —
// sekmede değil, push edilen ekrandayken yaşanan aynı hata ailesi
// (react-native-screens#1478, #2384, #2150 — MainTabsScreen.tsx'te ayrıntı).
//
// İki navigator'a ayrı ayrı `freezeOnBlur: false` eklemek yerine (kolayca bir
// üçüncü yeri unutma riski var — bir modal stack'i, ileride eklenecek bir
// navigator) kaynağı kapatmak daha güvenli: `enableFreeze(false)` her
// Screen'in `freezeOnBlur` varsayılanını false yapıyor, nerede olursa olsun.
//
// Kaybedilen şey: odakta olmayan ekranların JS re-render'dan muaf tutulması
// (bellek/CPU tasarrufu). Bunun karşılığı artık teorik değil, ölçülmüş: iki
// ayrı testçi raporu (önce "alt bar donuyor", şimdi "tüm uygulama donuyor")
// aynı bayrağa çıkıyor. MainTabsScreen.tsx'teki `freezeOnBlur: false` artık
// gereksiz ama zararsız — orada durmaya devam ediyor, niyeti belgeliyor.
//
// ---
//
// 2026-09-14, ÜÇÜNCÜ tur: GERİ AÇILDI. Yukarıdaki gerekçe ÖLÇÜMLE ÇÜRÜDÜ.
//
// İki dayanağı vardı, ikisi de düştü:
//
//  1. "Donmayı çözecek" — ÇÖZMEDİ. Kapatıldıktan sonraki turda testçi cevabı
//     "altmenüde değişiklik yok" oldu. Yani bu bayrak, eklenme sebebini hiç
//     karşılamadı.
//  2. "Kaybı yalnızca bellek/CPU tasarrufu" — YANLIŞ, kaybı çok daha büyük.
//     1.0.5'teki teşhis rozeti (bkz. diagnostics.ts) gerçek cihazda şunu
//     ölçtü: NORMAL kullanımda 38 saniyelik bir pencerede 19 ayrı blokaj,
//     toplam 12,8 saniye — yani zamanın ~%34'ünde JS thread'i bloke. Eşik
//     300ms olduğu için altındakiler sayılmıyor bile.
//
// Mekanizma: `enableFreeze` kapalıyken paylaşılan bir context değiştiğinde
// (tema, auth, safe-area, react-query cache) mount'lu BÜTÜN ekranlar yeniden
// render oluyor — ekranda görünmeyen dördü dahil. Öne dönüşte birkaç context
// birden değiştiği için üst üste render dalgaları geliyor; ölçümdeki imza da
// tam olarak bu: "3-5 saniyelik donma" TEK bir blok değil, arka arkaya 4-5
// ayrı blok (2027 + 446 + 1413 + 1137 ms). Tek ağır işlem olsaydı tek blok
// görürdük.
//
// Yani madde 3'ü çözmek için yapılan bu değişiklik, çözmediği hâlde kronik
// yavaşlığı getirmiş olabilir. Geri açıp aynı rozetle ölçüp karşılaştırıyoruz;
// taban değerler yukarıda yazılı.
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

  // Erken `return`'ün ÖNÜNDE: font yüklenene kadar çalışmasaydı açılıştaki —
  // yani en pahalı andaki — takılmaları kaçırırdık. Geçici, bkz. diagnostics.ts.
  React.useEffect(() => {
    if (!DIAGNOSTICS_ENABLED) return;
    return startDiagnostics();
  }, []);

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
            {/* Cache diske de yazılıyor (madde 10 katman 2): yemek listesi, SSS
                ve takip edilen bölümler uygulama kapanıp açılsa bile anında
                geliyor, ağ isteği arkada sessizce tazeliyor. HANGİ verinin
                yazıldığı bilerek çok dar tutuldu — gerekçeler queryPersist.ts'te.
                Çocuklar beklemeden çiziliyor; geri yükleme tamamlanana kadar
                sorgular kısa süre "restoring" durumunda kalıyor. */}
            <PersistQueryClientProvider client={queryClient} persistOptions={persistOptions}>
              <AuthProvider>
                <SavedPostsProvider>
                  <ThemedNavigationContainer>
                    <RootNavigator />
                    <ThemedStatusBar />
                    {/* NavigationContainer'ın kardeşi: `useNavigation` ağacın
                        içinde çalışıyor, PushBridge ise dışarıdan (soğuk açılış,
                        AppState) yönlendirme yapmak zorunda (bkz. navigationRef.ts). */}
                    <PushBridge />
                    {/* Geçici teşhis rozeti — bkz. diagnostics.ts. Ağacın en
                        sonunda ki her şeyin üstünde kalsın. */}
                    {DIAGNOSTICS_ENABLED && <DiagnosticsBadge />}
                  </ThemedNavigationContainer>
                </SavedPostsProvider>
              </AuthProvider>
            </PersistQueryClientProvider>
          </ThemeProvider>
        </SafeAreaProvider>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}
