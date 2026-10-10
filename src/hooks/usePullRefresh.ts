import { useCallback, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { UNREAD_NOTIFICATIONS_KEY } from './useUnreadNotifications';
import { UNREAD_ANNOUNCEMENTS_KEY } from './useUnreadAnnouncements';

// Aşağı çekerek yenileme. Spinner YALNIZCA elle çekince dönüyor — react-query'nin
// `isRefetching`'ine bağlanırsa odak/aralık tazelemelerinde de beliriyor
// (bkz. HomeScreen: "her dönüşte üstte loading dönüyor" şikâyeti).
export function usePullRefresh(refresh: () => unknown) {
  const [refreshing, setRefreshing] = useState(false);
  const fn = useRef(refresh);
  fn.current = refresh;
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await fn.current();
    } catch {
      // Hata ekranın kendi durumunda (StateView vb.) görünüyor.
    } finally {
      setRefreshing(false);
    }
  }, []);
  return { refreshing, onRefresh };
}

// Kendi sunucu verisi olmayan ekranlar (Fakülteler, Araçlar, Ayarlar…) için:
// çekince kabuğun ortak verisi — üst bardaki zil rozetleri — tazeleniyor.
// Her ekranda aynı jest çalışsın (kullanıcı isteği: "her sayfada refresh").
export function useShellRefresh() {
  const queryClient = useQueryClient();
  return usePullRefresh(() =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: UNREAD_NOTIFICATIONS_KEY }),
      queryClient.invalidateQueries({ queryKey: UNREAD_ANNOUNCEMENTS_KEY }),
    ])
  );
}
