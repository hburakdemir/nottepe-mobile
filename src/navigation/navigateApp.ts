import type { MainTabParamList, RootStackParamList } from './types';

// Sekmeler artık düz stack route'u değil, `MainTabs` altındaki bir
// Tab.Navigator'ın ekranları (bkz. types.ts'teki not). Bu yüzden onlara
// gitmek `navigate('MainTabs', { screen })` şeklinde iç içe bir çağrı
// gerektiriyor. Çağrı yerlerinin hepsi bunu bilmek zorunda kalmasın diye tek
// yardımcıdan geçiyoruz: ad sekmeyse iç içe, değilse düz navigate.
export const TAB_ROUTE_NAMES = ['Home', 'Departments', 'Tools', 'CafeteriaMenu', 'Profile'] as const;

export type TabRouteName = (typeof TAB_ROUTE_NAMES)[number];

export function isTabRoute(name: string): name is TabRouteName {
  return (TAB_ROUTE_NAMES as readonly string[]).includes(name);
}

type AnyNavigation = { navigate: (...args: any[]) => void };

export type AppRouteName = keyof RootStackParamList | TabRouteName;

export function navigateApp(navigation: AnyNavigation, name: AppRouteName | string, params?: object): void {
  if (isTabRoute(name)) {
    navigation.navigate('MainTabs', { screen: name, params });
    return;
  }
  navigation.navigate(name as string, params);
}

export function goToTab<K extends TabRouteName>(navigation: AnyNavigation, screen: K, params?: MainTabParamList[K]): void {
  navigation.navigate('MainTabs', { screen, params });
}
