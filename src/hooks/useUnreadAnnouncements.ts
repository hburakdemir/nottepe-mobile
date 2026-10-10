import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { notificationAPI } from '../lib/api';
import { hasLocalOverride, readNotificationPrefsSnapshot } from '../lib/notificationPrefs';

// `notificationAPI.getActiveUnreadCount` sunucuda `getActive` ile AYNI WHERE
// koşuluyla (aktif + onaylı + görülmemiş) tek bir COUNT(*) döner — başlık,
// içerik, medya ve oluşturan kişi bilgisi hiç indirilmez (bkz. server
// notificationModel.js getActiveUnreadCountForUserModel). Eskiden `getActive`
// TAMAMINI indirip yalnızca `.length`e bakıyordu.
//
// `hidden` — kullanıcının bu CİHAZDA elle sildiği duyuru id'leri — sunucuya
// gönderilip sayaçtan düşülüyor (bkz. lib/notificationPrefs.ts).
//
// `unread` — elle "okunmadı" yapılan duyurular — sunucu sayısının üstüne
// ekleniyor (useUnreadNotifications'taki Aktivite hesabıyla aynı). Güvenli,
// çünkü "Okunmadı" yalnızca sunucuda zaten görülmüş satırlarda çıkıyor; yani
// bu id'ler sunucu sayısında yok. Eskiden hiç eklenmiyordu: duyuruyu
// "okunmadı" yapınca rozet artmıyordu.
export const UNREAD_ANNOUNCEMENTS_KEY = ['notifications', 'announcements-unread-count'] as const;

export function useUnreadAnnouncements() {
  const { data } = useQuery({
    queryKey: UNREAD_ANNOUNCEMENTS_KEY,
    queryFn: async () => {
      const { hidden, unread } = await readNotificationPrefsSnapshot();
      const hiddenIds = [...hidden]
        .filter((key) => key.startsWith('announcement:'))
        .map((key) => key.slice('announcement:'.length));
      try {
        const res = await notificationAPI.getActiveUnreadCount('', hiddenIds);
        let localExtra = 0;
        unread.forEach((key) => {
          if (key.startsWith('announcement:') && !hidden.has(key)) localExtra += 1;
        });
        return ((res.data?.count as number | undefined) ?? 0) + localExtra;
      } catch (error) {
        // YEDEK YOL — uç sunucuda henüz yoksa (404) eski hesaba dön.
        //
        // Mobil sürüm ile sunucu deploy'u AYNI ANDA çıkmıyor: Play Store'dan
        // güncellenen uygulama, uç canlıya alınmadan önce açılabiliyor. Yedek
        // olmasaydı o arada rozet her 5 dakikada bir hata alıp 0 gösterirdi.
        // Uç deploy edildikten sonra bu dal hiç çalışmıyor; tüm kullanıcılar
        // yeni sürüme geçince silinebilir.
        if ((error as { response?: { status?: number } })?.response?.status !== 404) throw error;
        const res = await notificationAPI.getActive();
        const rows = (res.data || []) as Array<{ id: string | number; is_viewed?: boolean }>;
        return rows.filter((r) => {
          if (hasLocalOverride(hidden, 'announcement', r.id)) return false;
          return hasLocalOverride(unread, 'announcement', r.id) || !r.is_viewed;
        }).length;
      }
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
