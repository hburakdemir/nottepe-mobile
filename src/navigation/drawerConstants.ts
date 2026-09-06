import { getMetricsSnapshot, useMetrics } from '../theme/metrics';

// Menü panelinin genişliği — RootNavigator'daki Drawer.Navigator'ın
// `drawerStyle.width`'i VE PushableStack'in itme mesafesi (translateX hedefi)
// bu tek sabitten türetiliyor, ikisi asla birbirinden sapmasın diye.
// Oran Claude mobil uygulamasindan olculdu: referans ekran goruntusunde itilen
// sayfanin sol kenari x=776/946 → ekran genisliginin %82'si. Tavan, tablette
// menunun asiri genislemesini engellemek icin duruyor.
//
// ESKİDEN bu modül yüklenirken BİR KEZ `Dimensions.get('window').width` ile
// hesaplanan sabit bir SAYIYDI — döndürmede (özellikle telefon yatay moduna
// geçince) yeniden hesaplanmıyordu, RootNavigator'daki tüketiciler (drawer
// genişliği, durum çubuğu yaması) donuk kalıyordu. Artık reaktif bir hook:
// `useWindowDimensions` üzerinden döndürmede otomatik güncelleniyor. Tablette
// 400dp tavanı her yönelimde geçerli kaldığı için pratikte oradaki davranış
// değişmedi — asıl düzeltme telefonun yatay moduna geçişinde.
export function useDrawerWidth(): number {
  const { width } = useMetrics();
  return Math.min(width * 0.82, 400);
}

/** Hook dışı, bir kerelik okuma (ör. modül seviyesinde import edilen yerler
 *  için) — reaktif değildir, döndürmeyi izlemez. Tercihen `useDrawerWidth()`
 *  kullanılmalı; bu yalnızca hook çağıramayan yerler için. */
export function getDrawerWidthSnapshot(): number {
  return Math.min(getMetricsSnapshot().width * 0.82, 400);
}

// Drawer.Navigator'ın id'si — AppShell, odaklanan stack ekranına göre çekmecenin
// jest seçeneklerini `navigation.getParent(ROOT_DRAWER_ID)` ile güncelliyor.
export const ROOT_DRAWER_ID = 'RootDrawer';

// Bu ekranlarda sağa kaydırmak GERİ gidiyor (çekmece jesti kapalı) — jestin
// kendisi AppShell'de elle yazıldı, çünkü native-stack'in `gestureEnabled`'ı
// yalnızca iOS'ta çalışıyor.
// (Profil artık bir SEKME — bkz. MainTabsScreen.tsx — geri gidilecek ekranı
// olmadığı için listeden çıktı.)
export const BACK_SWIPE_ROUTES: string[] = ['PostDetail', 'UserProfile'];

// Bu ekranlarda menü ekranın HERHANGİ bir yerinden sağa çekilerek açılıyor
// (kenar şartı yok). Listede yatay ScrollView barındıran ekranlar bilinçli
// olarak yok (CafeteriaMenu gün şeridi, AktsCalculator, NoteRequests…) —
// oralarda tam genişlik jest, şeritlerin kaydırmasını çalardı.
export const FULL_WIDTH_SWIPE_ROUTES: string[] = ['Home', 'Departments', 'Tools'];

// Bu ekranlarda çekmece jesti TAMAMEN kapalı: satırların kendi yatay kaydırma
// aksiyonları var (bildirim satırında "okunmadı" + "sil"), kenardan açılan
// çekmece onlarla çakışıyordu (kullanıcı isteği).
export const NO_DRAWER_SWIPE_ROUTES: string[] = ['Notifications'];

// Tam genişlik jestin geçerli olmadığı ekranlarda soldan kaç px'lik şeritten
// çekilirse menü açılır (react-native-drawer-layout `swipeEdgeWidth`).
export const EDGE_SWIPE_WIDTH = 56;

// Geri jestinin tamamlanmış sayılma eşikleri (bkz. AppShell.tsx).
export const BACK_SWIPE_DISTANCE = 80;
export const BACK_SWIPE_VELOCITY = 500;
