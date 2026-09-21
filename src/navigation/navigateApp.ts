import { StackActions } from '@react-navigation/native';
import type { MainTabParamList, RootStackParamList } from './types';

// Sekmeler artık düz stack route'u değil, `MainTabs` altındaki bir
// Tab.Navigator'ın ekranları (bkz. types.ts'teki not). Bu yüzden onlara
// gitmek iç içe bir çağrı gerektiriyor. Çağrı yerlerinin hepsi bunu bilmek
// zorunda kalmasın diye tek yardımcıdan geçiyoruz.
export const TAB_ROUTE_NAMES = ['Home', 'Departments', 'Tools', 'CafeteriaMenu', 'Profile'] as const;

export type TabRouteName = (typeof TAB_ROUTE_NAMES)[number];

export function isTabRoute(name: string): name is TabRouteName {
  return (TAB_ROUTE_NAMES as readonly string[]).includes(name);
}

type AnyNavigation = {
  navigate: (...args: any[]) => void;
  dispatch?: (action: any) => void;
};

export type AppRouteName = keyof RootStackParamList | TabRouteName;

// ⚠️ BURADA `navigate` KULLANILMIYOR — SEBEBİ ÖLÇÜLDÜ.
//
// `navigation.navigate('MainTabs', { screen })` çağrısı, push edilmiş bir
// ekranın üstünden çağrıldığında yığındaki mevcut `MainTabs`'a DÖNMÜYOR:
// yığının üstüne YENİ bir `MainTabs` itiyor. Altta kalan ekran mount'lu
// kalıyor ve hiç sökülmüyor. Kullanıcı derine girip alttaki sekmeye bastıkça
// yığın şöyle büyüyor:
//
//   [MainTabs] → [MainTabs, Ego130] → [MainTabs, Ego130, MainTabs] → ...
//
// Her katman tam bir `AppShell` taşıyor (AppHeader + WaveTabBar + BlurView),
// yani ziyaret başına ~32 MB ve her render tick'inde hâlâ çalışan bir ekran.
//
// 2026-09-21'de emülatörde ölçüldü (aynı ekran 20 kez açılıp kapandı):
//   sekmeyle çıkış : 103 MB → 749 MB   (GC sonrası 708 MB)
//   geri tuşuyla   : 103 MB → 183 MB   (GC sonrası 160 MB)
// Boşta CPU aynı turda %4 → %23'e çıkıyor; ~40 gezinmede uygulama OOM'dan
// ölüyor. Testçinin "zamanla kasıyor, kapatıp açınca düzeliyor" şikâyeti buydu.
//
// `StackActions.popTo` yığında zaten duran ekrana döner ve üstündekileri
// çıkarır; ekran yığında yoksa ekler. İstediğimiz davranış tam olarak bu.
function goToMainTabs(navigation: AnyNavigation, screen: TabRouteName, params?: object): void {
  const nested = { screen, params };
  // `dispatch` her zaman var (React Navigation'ın navigation prop'unda), ama
  // tip `AnyNavigation` gevşek olduğu için ve testlerdeki sahte nesneler
  // yalnızca `navigate` taşıdığı için güvenli tarafa düşüyoruz.
  if (typeof navigation.dispatch === 'function') {
    navigation.dispatch(StackActions.popTo('MainTabs', nested));
    return;
  }
  navigation.navigate('MainTabs', nested);
}

export function navigateApp(navigation: AnyNavigation, name: AppRouteName | string, params?: object): void {
  if (isTabRoute(name)) {
    goToMainTabs(navigation, name, params);
    return;
  }
  navigation.navigate(name as string, params);
}

export function goToTab<K extends TabRouteName>(navigation: AnyNavigation, screen: K, params?: MainTabParamList[K]): void {
  goToMainTabs(navigation, screen, params);
}
