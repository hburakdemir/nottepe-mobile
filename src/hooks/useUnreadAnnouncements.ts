import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { notificationAPI } from '../lib/api';

// Duyurular için ayrı bir "okunmamış sayısı" ucu yok (bkz. notificationAPI) —
// `getActive` zaten aktif duyuruların TAMAMINI dönüyor, sayaç bunun içinden
// `is_viewed=false` olanları sayarak türetiliyor. MenuDrawerContent eskiden
// bu listenin UZUNLUĞUNU rozet sayısı sanıyordu (görüntülenmiş duyurular da
// dahil) — "duyurularda okundu/okunmadı çalışmıyor" şikayetinin bir parçası.
export const UNREAD_ANNOUNCEMENTS_KEY = ['notifications', 'announcements-unread-count'] as const;

export function useUnreadAnnouncements() {
  const { data } = useQuery({
    queryKey: UNREAD_ANNOUNCEMENTS_KEY,
    queryFn: async () => {
      const res = await notificationAPI.getActive();
      const rows = (res.data || []) as Array<{ is_viewed?: boolean }>;
      return rows.filter((r) => !r.is_viewed).length;
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
