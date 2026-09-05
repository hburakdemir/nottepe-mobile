import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { userNotificationAPI, type PushPreferences } from '../lib/api';

// Push tercihleri: `push_enabled` ana anahtarı + tip başına anahtarlar +
// sunucunun yetkili `available_types` listesi (bkz. plan 3.4). Tek anahtar,
// çünkü üçü de aynı uçtan tek gövdede geliyor.
export const PUSH_PREFERENCES_KEY = ['notifications', 'push-preferences'] as const;

export function usePushPreferences() {
  return useQuery({
    queryKey: PUSH_PREFERENCES_KEY,
    queryFn: async () => {
      const res = await userNotificationAPI.getPushPreferences();
      return res.data as PushPreferences;
    },
    // Tercihler yalnız kullanıcının kendi dokunuşuyla değişiyor; panel her
    // açıldığında yeniden çekmenin faydası yok (desen: useNotificationCategories).
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}

export function useUpdatePushPreferences() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: { push_enabled?: boolean; types?: Record<string, boolean>; cafeteria_notify_hour?: number }) => {
      const res = await userNotificationAPI.updatePushPreferences(payload);
      return res.data as PushPreferences;
    },
    onSuccess: (data) => {
      // PATCH cevabı GET ile AYNI tam gövde — `available_types` dahil. Bu yüzden
      // invalidate edip ikinci bir GET atmak saf israf; cache'i doğrudan eziyoruz.
      queryClient.setQueryData(PUSH_PREFERENCES_KEY, data);
    },
  });
}
