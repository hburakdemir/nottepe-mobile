import { useQuery } from '@tanstack/react-query';
import { avatarAPI, badgeAPI, userAPI } from '../../lib/api';
import type { Badge } from '../../components/BadgeChip';
import type { AvatarData } from '../../components/avatar/AvatarDisplay';

// Başka bir kullanıcının profil BAŞLIĞININ veri katmanı (profil + avatar +
// rozetler). Sekmelerin listeleri useProfileLists.ts'te.
//
// Eskiden bu üçü `UserProfileScreen`'in içinde tek bir `useEffect` ile
// zincirleme çekiliyordu: `setProfile` → `Promise.all([avatar, badges])` →
// `setAvatar`/`setBadges`, artı `loading`/`notFound`/`banned`/`loadError` için
// dört ayrı state ve elle yazılmış bir `cancelled` bayrağı. Aynı profile ikinci
// kez girmek her şeyi sıfırdan çekiyordu.
//
// ⚠️ HATA YUTULMUYOR (useProfileLists.ts'teki listelerin aksine): ekran
// "yasaklı" (403), "bulunamadı" (404) ve "ağ hatası" (yanıt yok) dallarını
// AYIRMAK zorunda. Bu ayrım daha önce bir kullanıcı şikâyetiydi — zaman aşımı
// da "Kullanıcı bulunamadı" gösteriyordu ve yanıltıcıydı.
const PROFILE_STALE_MS = 5 * 60 * 1000;

export interface PublicProfile {
  id: number;
  username: string;
  full_name?: string;
  department?: string;
  faculty?: string;
  bio?: string;
  post_count?: number;
  is_public: boolean;
  profile_section_visibility?: Record<string, boolean>;
}

export const userProfileKey = (username: string) => ['profile', username, 'head'] as const;

export function useUserProfile(username: string) {
  return useQuery({
    queryKey: userProfileKey(username),
    queryFn: async () => {
      const res = await userAPI.getProfile(username);
      return res.data.profile as PublicProfile;
    },
    staleTime: PROFILE_STALE_MS,
    // Tekrar denemeyi kapatıyoruz: 403/404 kalıcı cevaplar, üç kez denemek
    // yalnızca hata ekranını geciktirirdi. Ağ hatasında ekran zaten kendi
    // "Tekrar dene" düğmesini gösteriyor.
    retry: false,
  });
}

export function useUserAvatar(userId: number | undefined) {
  return useQuery({
    queryKey: ['profile', 'avatar', userId],
    enabled: !!userId,
    queryFn: async () => {
      try {
        const res = await avatarAPI.getByUserId(userId!);
        return (res.data?.avatar as AvatarData | null) ?? null;
      } catch {
        return null;
      }
    },
    staleTime: PROFILE_STALE_MS,
  });
}

/** `enabled: false` → profil sahibi rozet bölümünü gizlemiş; istek atılmıyor. */
export function useUserBadges(userId: number | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ['profile', 'badges', userId],
    enabled: enabled && !!userId,
    queryFn: async () => {
      try {
        const res = await badgeAPI.getByUser(userId!);
        return (res.data?.badges || []) as Badge[];
      } catch {
        return [] as Badge[];
      }
    },
    staleTime: PROFILE_STALE_MS,
  });
}
