import { Dimensions } from 'react-native';

// Menü panelinin genişliği — RootNavigator'daki Drawer.Navigator'ın
// `drawerStyle.width`'i VE PushableStack'in itme mesafesi (translateX hedefi)
// bu tek sabitten türetiliyor, ikisi asla birbirinden sapmasın diye.
// Oran Claude mobil uygulamasindan olculdu: referans ekran goruntusunde itilen
// sayfanin sol kenari x=776/946 → ekran genisliginin %82'si. Tavan, tablette
// menunun asiri genislemesini engellemek icin duruyor.
export const DRAWER_WIDTH = Math.min(Dimensions.get('window').width * 0.82, 400);

// Drawer.Navigator'ın id'si — AppShell, odaklanan stack ekranına göre çekmecenin
// jest seçeneklerini `navigation.getParent(ROOT_DRAWER_ID)` ile güncelliyor.
export const ROOT_DRAWER_ID = 'RootDrawer';

// Bu ekranlarda sağa kaydırmak GERİ gidiyor (çekmece jesti kapalı) — jestin
// kendisi AppShell'de elle yazıldı, çünkü native-stack'in `gestureEnabled`'ı
// yalnızca iOS'ta çalışıyor.
export const BACK_SWIPE_ROUTES: string[] = ['PostDetail', 'Profile', 'UserProfile'];

// Bu ekranlarda menü ekranın HERHANGİ bir yerinden sağa çekilerek açılıyor
// (kenar şartı yok). Listede yatay ScrollView barındıran ekranlar bilinçli
// olarak yok (CafeteriaMenu gün şeridi, AktsCalculator, NoteRequests…) —
// oralarda tam genişlik jest, şeritlerin kaydırmasını çalardı.
export const FULL_WIDTH_SWIPE_ROUTES: string[] = ['Home', 'Departments', 'Tools'];

// Tam genişlik jestin geçerli olmadığı ekranlarda soldan kaç px'lik şeritten
// çekilirse menü açılır (react-native-drawer-layout `swipeEdgeWidth`).
export const EDGE_SWIPE_WIDTH = 56;

// Geri jestinin tamamlanmış sayılma eşikleri (bkz. AppShell.tsx).
export const BACK_SWIPE_DISTANCE = 80;
export const BACK_SWIPE_VELOCITY = 500;
