import { useQuery, useQueryClient } from '@tanstack/react-query';
import { avatarAPI } from '../lib/api';
import type { AvatarData } from '../components/avatar/AvatarDisplay';

// Aynı `avatarAPI.get()` daha önce AppHeader, MenuDrawerContent ve ProfileScreen'de
// ayrı ayrı çekiliyordu; tab bar'daki avatar dördüncüsü olacaktı. Tek bir
// react-query anahtarına (`MY_AVATAR_KEY`) bağlanınca hepsi aynı yanıtı
// paylaşıyor ve avatar kaydedilince `invalidateMyAvatar` ile hepsi birden
// tazeleniyor.
export const MY_AVATAR_KEY = ['avatar', 'me'] as const;

export function useMyAvatar(): AvatarData | null {
  const { data } = useQuery({
    queryKey: MY_AVATAR_KEY,
    queryFn: async () => {
      const res = await avatarAPI.get();
      return (res.data?.avatar as AvatarData | null) ?? null;
    },
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  return data ?? null;
}

// Avatar kaydetme/silme akışlarından sonra çağrılıyor — üst bar ve tab bar
// anında güncellensin diye.
export function useInvalidateMyAvatar() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: MY_AVATAR_KEY });
}
