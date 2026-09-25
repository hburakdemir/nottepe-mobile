import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { notificationAPI } from '../lib/api';
import { readNotificationPrefsSnapshot } from '../lib/notificationPrefs';

// `notificationAPI.getActiveUnreadCount` sunucuda `getActive` ile AYNI WHERE
// koşuluyla (aktif + onaylı + görülmemiş) tek bir COUNT(*) döner — başlık,
// içerik, medya ve oluşturan kişi bilgisi hiç indirilmez (bkz. server
// notificationModel.js getActiveUnreadCountForUserModel). Eskiden `getActive`
// TAMAMINI indirip yalnızca `.length`e bakıyordu.
//
// `hidden` — kullanıcının bu CİHAZDA elle sildiği duyuru id'leri — sunucuya
// gönderilip sayaçtan düşülüyor (bkz. lib/notificationPrefs.ts).
//
// Not: `unread` (elle "okunmadı" yapma) burada hesaba katılmıyor çünkü zaten
// katılmıyordu — `getActive` yanıtında `is_viewed` alanı hiç yoktu, yani eski
// koddaki `!r.is_viewed` her zaman `true`'ydu ve `unread` override'ı bu
// sayaç için hiçbir zaman etkili olmamıştı (yalnızca NotificationsScreen'in
// kendi listesinde, `getAll`'ın döndürdüğü gerçek `is_viewed` üzerinden işe
// yarıyor).
export const UNREAD_ANNOUNCEMENTS_KEY = ['notifications', 'announcements-unread-count'] as const;

export function useUnreadAnnouncements() {
  const { data } = useQuery({
    queryKey: UNREAD_ANNOUNCEMENTS_KEY,
    queryFn: async () => {
      const { hidden } = await readNotificationPrefsSnapshot();
      const hiddenIds = [...hidden]
        .filter((key) => key.startsWith('announcement:'))
        .map((key) => key.slice('announcement:'.length));
      const res = await notificationAPI.getActiveUnreadCount('', hiddenIds);
      return (res.data?.count as number | undefined) ?? 0;
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
