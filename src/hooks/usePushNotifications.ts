import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import * as Notifications from 'expo-notifications';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { useUnreadNotifications, UNREAD_NOTIFICATIONS_KEY } from './useUnreadNotifications';
import { useUnreadAnnouncements } from './useUnreadAnnouncements';
import { ensurePushPermission, registerToken } from '../lib/push/registration';
import { parsePushTarget, openPushTarget, savePendingPushTarget, takePendingPushTarget } from '../lib/push/targets';
import { isNotificationsScreenFocused } from '../lib/push/pushState';

// Plan 3.5'teki altı akışın tek yeri: soğuk açılış, arka plan/kapalı dokunma,
// çıkışken dokunma, ön planda gelme, ön plana dönüş, izin isteme. Hepsi tek
// hook'ta çünkü sıraları birbirine bağlı (örn. izin isteme girişten SONRA,
// hedef boşaltma ise `isAuthenticated` true olduktan sonra).
export function usePushNotifications(): void {
  const { user, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  // Uygulama İÇİNDEKİ rozetler (bkz. AppHeader zili + MenuDrawerContent zil/
  // megafon) ayrı ayrı Aktivite/Duyuru sayıyor; uygulama DIŞINDAKİ (OS) rozet
  // ise TEK bir sayı ("okunmayan bildirim sayısı" — kullanıcı ayrım
  // istemiyor). Eskiden bu rozet yalnız push bildirimi geldiğinde ve yalnız
  // Aktivite sayısıyla güncelleniyordu; "hepsini okundu yap" sonrası ya da
  // Duyuru tarafında hiç sıfırlanmıyordu.
  const activityUnread = useUnreadNotifications();
  const announcementsUnread = useUnreadAnnouncements();
  useEffect(() => {
    if (!isAuthenticated) return;
    const total = activityUnread + announcementsUnread;
    Notifications.setBadgeCountAsync(total).catch(() => {});
    // Rozet 0'a düştüğünde bildirim çubuğunda (shade/notification center) eski
    // push'lar hâlâ asılı kalabiliyordu — kullanıcı içeride hepsini okudu ama
    // dışarıda "0 okunmamış" rozetiyle birlikte hâlâ görünür bildirimler
    // duruyordu. Üçünü (ana ekran rozeti, bildirim çubuğu, uygulama içi)
    // aynı anda sıfırlıyoruz. Tek tek dokunulan/okunan bildirimleri buradan
    // tekil temizleyemiyoruz (elimizde push -> yerel bildirim id eşlemesi yok),
    // ama "hepsi okundu" anı zaten en yaygın senaryo.
    if (total === 0) {
      Notifications.dismissAllNotificationsAsync().catch(() => {});
    }
  }, [isAuthenticated, activityUnread, announcementsUnread]);
  // Soğuk açılış yanıtı `useLastNotificationResponse` yerine elle okunuyor:
  // o hook her remount'ta AYNI yanıtı yeniden tetikleyip kullanıcıyı oturum
  // ortasında zıplatıyor. `identifier` ile tek seferlik tüketim burada.
  const coldStartHandled = useRef(false);

  // --- Soğuk açılış: bildirime dokunularak mı açıldı? ---
  useEffect(() => {
    if (coldStartHandled.current) return;
    coldStartHandled.current = true;
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (!response) return;
      const target = parsePushTarget(response.notification.request.content.data);
      if (!target) return;
      if (isAuthenticated) {
        openPushTarget(target);
      } else {
        // Route ağaçta yok (AuthNavigator çiziliyor) — girişten sonra boşaltılacak.
        savePendingPushTarget(target);
      }
    });
    // Bilerek yalnızca mount'ta: `identifier` bazlı tüketim `coldStartHandled`
    // ile zaten sağlanıyor, `isAuthenticated`'ı bağımlılığa eklemek bu efekti
    // her giriş/çıkışta tekrar çalıştırır.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Arka plan/kapalı iken dokunma ---
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const target = parsePushTarget(response.notification.request.content.data);
      if (!target) return;
      if (isAuthenticated) {
        openPushTarget(target);
      } else {
        savePendingPushTarget(target);
      }
    });
    return () => sub.remove();
  }, [isAuthenticated]);

  // --- Çıkışken biriken hedefi girişten sonra boşalt ---
  useEffect(() => {
    if (!isAuthenticated) return;
    takePendingPushTarget().then((target) => {
      if (target) openPushTarget(target);
    });
  }, [isAuthenticated]);

  // --- Ön planda bildirim gelmesi: rozeti güncelle ---
  useEffect(() => {
    const sub = Notifications.addNotificationReceivedListener((notification) => {
      const data = notification.request.content.data as { unread_count?: number } | undefined;
      // Bildirimler ekranı odaktaysa artırma: o ekran zaten hepsini okundu
      // yapıyor ve kullanıcı listeye bakıyor — rozet artışı yanlış sinyal olur.
      if (isNotificationsScreenFocused()) {
        queryClient.invalidateQueries({ queryKey: UNREAD_NOTIFICATIONS_KEY });
        return;
      }
      if (typeof data?.unread_count === 'number') {
        // Gönderim sonrası kesin değer — poll'u beklemeden tek `setQueryData`
        // hem üst bar hem menü zilini günceller. OS rozeti burada AYRICA
        // set edilmiyor: yukarıdaki birleşik efekt (Aktivite + Duyuru toplamı)
        // bu `setQueryData` sonrası zaten yeniden çalışıp doğru toplamı yazıyor.
        queryClient.setQueryData(UNREAD_NOTIFICATIONS_KEY, data.unread_count);
      } else {
        // Sunucu kesin sayı göndermediyse iyimser +1; bir sonraki poll düzeltir.
        queryClient.setQueryData(UNREAD_NOTIFICATIONS_KEY, (prev: number = 0) => prev + 1);
      }
    });
    return () => sub.remove();
  }, [queryClient]);

  // --- Token rotasyonu ---
  useEffect(() => {
    const sub = Notifications.addPushTokenListener(() => {
      registerToken(user?.id);
    });
    return () => sub.remove();
  }, [user?.id]);

  // --- İlk başarılı girişten sonra izin iste, sonra kaydet ---
  useEffect(() => {
    if (!isAuthenticated || !user?.id) return;
    (async () => {
      const granted = await ensurePushPermission();
      if (granted) await registerToken(user.id);
    })();
  }, [isAuthenticated, user?.id]);

  // --- Ön plana dönüş: unread invalidate + kendini eleyen kayıt denemesi ---
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      queryClient.invalidateQueries({ queryKey: UNREAD_NOTIFICATIONS_KEY });
      if (isAuthenticated && user?.id) registerToken(user.id);
    });
    return () => sub.remove();
  }, [isAuthenticated, user?.id, queryClient]);
}
