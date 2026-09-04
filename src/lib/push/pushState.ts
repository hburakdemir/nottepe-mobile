import { useSyncExternalStore } from 'react';

// React ağacının DIŞINDAN (kayıt akışı, ekran odak efekti) yazılan iki küçük
// bayrak. Context kullanılmadı: ikisini de yazan taraf bir provider'ın altında
// değil ve `pushActive` değiştiğinde bütün ağacın yeniden çizilmesi gereksiz —
// `useSyncExternalStore` yalnızca gerçekten dinleyen bileşeni uyandırıyor.

type Listener = () => void;

const listeners = new Set<Listener>();

function emit(): void {
  listeners.forEach((cb) => cb());
}

export function subscribePushState(cb: Listener): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

// İzin `granted` VE token sunucuya kaydedilmişse true. Poll aralığını buna göre
// düşürüyoruz (bkz. useUnreadNotifications.ts).
let pushActive = false;

export function getPushActive(): boolean {
  return pushActive;
}

export function setPushActive(v: boolean): void {
  if (pushActive === v) return;
  pushActive = v;
  emit();
}

export function usePushActive(): boolean {
  return useSyncExternalStore(subscribePushState, getPushActive, getPushActive);
}

// Bildirimler ekranı odaktayken push gelirse rozeti ARTIRMAK yanlış: o ekran
// Aktivite sekmesine girildiğinde zaten hepsini okundu yapıyor, kullanıcı da
// listeye bakıyor. Bayrak açıkken sayaca dokunulmuyor (bkz. usePushNotifications).
// Bu bir render'ı etkilemediği için `emit` çağrılmıyor — yalnızca okunan bir
// bayrak.
let notificationsScreenFocused = false;

export function setNotificationsScreenFocused(focused: boolean): void {
  notificationsScreenFocused = focused;
}

export function isNotificationsScreenFocused(): boolean {
  return notificationsScreenFocused;
}
