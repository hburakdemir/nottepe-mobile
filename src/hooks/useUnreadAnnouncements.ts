import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { notificationAPI } from '../lib/api';
import { readNotificationPrefsSnapshot } from '../lib/notificationPrefs';

// Duyurular için ayrı bir "okunmamış sayısı" ucu yok (bkz. notificationAPI) —
// `getActive` zaten aktif duyuruların TAMAMINI dönüyor, sayaç bunun içinden
// `is_viewed=false` olanları sayarak türetiliyor. MenuDrawerContent eskiden
// bu listenin UZUNLUĞUNU rozet sayısı sanıyordu (görüntülenmiş duyurular da
// dahil) — "duyurularda okundu/okunmadı çalışmıyor" şikayetinin bir parçası.
//
// Sayaç ayrıca kullanıcının CİHAZDA elle "okunmadı" yaptığı (`unread`) ya da
// sildiği (`hidden`) duyuruları da hesaba katıyor — yoksa NotificationsScreen'de
// bir duyuruyu "okunmadı" yapmak listede satırı okunmamış gösterse de rozet
// sayısı hiç değişmiyordu (sunucudaki `is_viewed` zaten `true` kalıyor, bu
// yalnızca yerel bir tercih).
export const UNREAD_ANNOUNCEMENTS_KEY = ['notifications', 'announcements-unread-count'] as const;

export function useUnreadAnnouncements() {
  const { data } = useQuery({
    queryKey: UNREAD_ANNOUNCEMENTS_KEY,
    queryFn: async () => {
      const [res, { hidden, unread }] = await Promise.all([notificationAPI.getActive(), readNotificationPrefsSnapshot()]);
      const rows = (res.data || []) as Array<{ id: string | number; is_viewed?: boolean }>;
      return rows.filter((r) => {
        const id = String(r.id);
        if (hidden.has(id)) return false;
        return unread.has(id) || !r.is_viewed;
      }).length;
    },
    staleTime: 30_000,
    refetchInterval: 300_000,
    refetchOnWindowFocus: true,
  });
  return data ?? 0;
}

export function useInvalidateUnreadAnnouncements() {
  const queryClient = useQueryClient();
  return useCallback(() => queryClient.invalidateQueries({ queryKey: UNREAD_ANNOUNCEMENTS_KEY }), [queryClient]);
}
