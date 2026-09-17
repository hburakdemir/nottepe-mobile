import { useCallback } from 'react';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
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

// Soldan kaç px'lik şeritten çekilirse menü açılır
// (react-native-drawer-layout `swipeEdgeWidth`).
//
// BİR ARA 28'E DÜŞÜRÜLMÜŞTÜ, GERİ ALINDI. Gerekçe şuydu: kütüphane bu şeridi
// jestine `hitSlop` olarak veriyor (`{ left: 0, width: swipeEdgeWidth }`,
// Drawer.native.tsx ~151), şerit ekranın TÜM YÜKSEKLİĞİ boyunca uzanıyor ve
// üst bardaki menü avatarı bu şeridin içinde kalıyor — avatarın basılamamasının
// sebebi bu sanılmıştı. YANLIŞTI: jest `activeOffsetX([-20,20])` ile kurulu
// (Drawer.native.tsx ~295), yani PARMAK HAREKET ETMEDEN AKTİFLEŞMİYOR;
// hareketsiz bir dokunuşu hiçbir zaman yutamaz. Avatarın gerçek sebebi
// Reanimated sargısıydı (bkz. AppHeader.tsx). Daraltmanın tek etkisi, menüyü
// açan kenar şeridini kullanılamaz hâle getirmek oldu ("ana sayfada kaydırarak
// menü açılmıyor") — o yüzden eski değere dönüldü.
export const EDGE_SWIPE_WIDTH = 56;

// Çekmecenin kaydırma jestini AÇAN/KAPATAN kanca — ekran odağa girdiğinde
// çalışıyor.
//
// ESKİDEN bunu RootNavigator içindeki `DrawerSwipeSync` yapıyordu: o an odaklı
// route'un ADINI iç içe navigator state'inden (drawer → stack → tab) türetip
// bir `TAB_ROUTES` listesiyle karşılaştırıyordu. Kırılgandı — AppHeader'daki
// mevcut not (bkz. `derivedTitle` yorumu) bu türetmenin sekmelerde güvenilmez
// olduğunu, odaklı route'un hep `MainTabs` çıkabildiğini zaten belgeliyor;
// öyle bir durumda hiçbir sekmede menü kaydırmayla açılamaz.
//
// ⚠️ BU NOTUN BİR CÜMLESİ YANLIŞTI, 1.0.15'te DÜZELTİLDİ. Eskiden şöyle
// diyordu: "`useNavigationState` her navigasyon değişiminde yeniden render olup
// `setOptions` çağırıyor, bu da Drawer + PushableStack + tüm Stack ağacını
// gereksiz yere yeniden çizdiriyordu." Kütüphane kaynağında doğrulandı, son
// kısmı DOĞRU DEĞİL.
//
// Doğrusu: `setOptions` gerçekten her çağrıda yeni bir nesne yazıyor
// (useNavigationCache.tsx ~213, eşitlik kontrolü YOK) ve `DrawerNavigator`
// yeniden render oluyor. AMA kaskad Drawer'ın kendi `SceneView`'indeki
// `StaticContainer`'da KESİLİYOR: o bir `React.memo` ve comparator'ı
// `children`'ı atlayıp `name`/`render`/`navigation`/`route`'u referansla
// karşılaştırıyor (StaticContainer.tsx ~18-25). Dördü de `setOptions`
// kaynaklı bir render'da aynı referans kalıyor — `RootNavigator` render
// olmadığı için oradaki satır içi render callback'inin kimliği de değişmiyor
// (state sahibi `DrawerNavigator`, onun TORUNU; React ataları render etmez).
// Yani `PushableStack` bir kez render oluyor, Stack ağacı ve `MainTabsScreen`
// HİÇ render olmuyor.
//
// Neden önemli: 1.0.14'te aranan 300-680 ms'lik gezinme maliyeti bu yoldan
// GELMİYOR. Bu not olduğu gibi kalsaydı bir sonraki tur yanlış yeri kazacaktı.
//
// Ayrım aslında rota adına hiç bakmadan, MİMARİDEN kesin biliniyor:
// `MainTabsScreen` = stack'in kökü, geri gidilecek ekran yok → jest AÇIK.
// `AppShell` = tanım gereği yalnızca push edilmiş ekranları sarmalıyor → jest
// KAPALI (sol kenar oradaki native geri jestine ait).
export function useDrawerSwipeEnabled(enabled: boolean): void {
  const navigation = useNavigation();

  useFocusEffect(
    useCallback(() => {
      navigation.getParent(ROOT_DRAWER_ID as never)?.setOptions({ swipeEnabled: enabled });
    }, [navigation, enabled])
  );
}
