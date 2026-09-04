import { createNavigationContainerRef } from '@react-navigation/native';
import { navigateApp, type AppRouteName } from './navigateApp';
import type { RootStackParamList } from './types';

// Navigator ağacının DIŞINDAN (push bildirimi dokunuşu, AppState dinleyicisi)
// yönlendirme yapabilmek için tek bir konteyner referansı. `useNavigation`
// yalnızca ağacın içinde çalışıyor; PushBridge ise NavigationContainer'ın
// kardeşi olarak duruyor (bkz. App.tsx).
export const navigationRef = createNavigationContainerRef<RootStackParamList>();

export interface QueuedTarget {
  screen: AppRouteName | string;
  params?: object;
}

// Soğuk açılışta bildirime dokunulduğunda hedef, konteyner daha `isReady()`
// olmadan elimize geçiyor — o an `navigate` çağırmak sessizce düşer ve kullanıcı
// bildirime bastığı hâlde ana sayfada kalır. Hedefi tutup `onReady`'de
// boşaltıyoruz. Kuyruk tek elemanlı: iki bildirim arka arkaya işlenirse
// kullanıcıyı ilkine değil, en sonuncusuna götürmek doğru olan.
let pendingTarget: QueuedTarget | null = null;

/**
 * Konteyner hazırsa hemen gider, değilse hedefi kuyruğa alır.
 * Sekme/stack ayrımını `navigateApp` yapıyor — iç içe `MainTabs` mantığı burada
 * tekrarlanmıyor (bkz. navigateApp.ts).
 */
export function navigateWhenReady(screen: AppRouteName | string, params?: object): void {
  if (!navigationRef.isReady()) {
    pendingTarget = { screen, params };
    return;
  }
  navigateApp(navigationRef, screen, params);
}

/** `NavigationContainer`'ın `onReady`'sine bağlanıyor. */
export function drainPendingTarget(): void {
  const target = pendingTarget;
  pendingTarget = null;
  if (!target) return;
  navigateApp(navigationRef, target.screen, target.params);
}
