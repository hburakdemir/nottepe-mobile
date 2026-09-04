import { usePushNotifications } from '../hooks/usePushNotifications';

// HER ZAMAN mount edilir (`App.tsx`'te `NavigationContainer`'ın kardeşi olarak,
// sadece giriş yapılmış dalda değil) — soğuk açılışta kullanıcı çıkışken
// bildirime dokunabilir, o durumda hedefin düşürülmeyip saklanması gerekiyor
// (bkz. usePushNotifications). Görsel bir şey çizmiyor, yalnızca yan etki hook'u.
export default function PushBridge(): null {
  usePushNotifications();
  return null;
}
