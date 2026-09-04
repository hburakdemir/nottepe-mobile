import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { userNotificationAPI } from '../lib/api';
import { usePushActive } from '../lib/push/pushState';

// Okunmamış aktivite bildirimi sayısı. Üst bardaki zilin rozeti (AppHeader) ve
// menüdeki zil aynı react-query anahtarından besleniyor; Bildirimler ekranı
// "hepsini okundu yap"tıktan sonra bu anahtarı geçersiz kılıyor, iki rozet de
// tek seferde güncelleniyor.
export const UNREAD_NOTIFICATIONS_KEY = ['notifications', 'unread-count'] as const;

export function useUnreadNotifications() {
  // Push aktifken (izin verildi VE token kayıtlı) sunucu zaten anlık
  // `unread_count` gönderiyor — 60 sn'lik poll'u tamamen kapatmıyoruz, 5 dk'ya
  // düşürüyoruz. Sessiz düşme vakalarını (pil optimizasyonu FCM'i öldürdü,
  // sayı bayatladı) bu taban telafi ediyor (bkz. plan 3.5).
  const pushActive = usePushActive();
  const { data } = useQuery({
    queryKey: UNREAD_NOTIFICATIONS_KEY,
    queryFn: async () => {
      const res = await userNotificationAPI.getUnreadCount();
      return Number(res.data?.count) || 0;
    },
    staleTime: 30_000,
    refetchInterval: pushActive ? 300_000 : 60_000,
    refetchOnWindowFocus: true,
  });
  return data ?? 0;
}

// `useCallback` şart: bu fonksiyon Bildirimler ekranında bir `useEffect`'in
// bağımlılığı. Her render'da yeni referans üretilseydi efekt sürekli yeniden
// çalışır, "hepsini okundu yap" isteği tekrar tekrar atılırdı (emülatör
// testinde iki kez atıldığı görüldü).
export function useMarkNotificationsRead() {
  const queryClient = useQueryClient();
  return useCallback(() => {
    // Sunucu cevabını beklemeden sayacı sıfırla: rozet anında sönüyor.
    queryClient.setQueryData(UNREAD_NOTIFICATIONS_KEY, 0);
    queryClient.invalidateQueries({ queryKey: UNREAD_NOTIFICATIONS_KEY });
  }, [queryClient]);
}
