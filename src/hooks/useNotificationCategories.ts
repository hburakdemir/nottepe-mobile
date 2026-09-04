import { useQuery } from '@tanstack/react-query';
import { notificationAPI } from '../lib/api';

// Duyuru kategorileri neredeyse hiç değişmeyen referans verisi; buna rağmen
// Bildirimler ekranı her açıldığında `GET /notifications/categories` yeniden
// çekiliyordu. Tek bir react-query anahtarına (`NOTIFICATION_CATEGORIES_KEY`)
// ve uzun bir `staleTime`'a bağlanınca ekran ikinci kez açıldığında istek
// gitmiyor, filtre şeridi anında çiziliyor.
export const NOTIFICATION_CATEGORIES_KEY = ['notifications', 'categories'] as const;

export interface NotificationCategory {
  id: number;
  name: string;
  slug: string;
  is_active: boolean;
}

export function useNotificationCategories(): NotificationCategory[] {
  const { data } = useQuery({
    queryKey: NOTIFICATION_CATEGORIES_KEY,
    queryFn: async () => {
      const res = await notificationAPI.getCategories();
      // Pasif kategoriler filtre şeridinde gösterilmiyor — süzme burada, tek
      // yerde yapılıyor ki ekran tarafı ham yanıtla uğraşmasın.
      return ((res.data || []) as NotificationCategory[]).filter((c) => c.is_active);
    },
    staleTime: 30 * 60 * 1000,
    retry: false,
  });

  // Yükleme/hata durumunda boş dizi: ekrandaki `categories.length > 0` koşulu
  // eskisi gibi çalışsın, `undefined` kontrolü gerekmesin.
  return data ?? [];
}
