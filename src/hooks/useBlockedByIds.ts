import { useQuery } from '@tanstack/react-query';
import { moderationAPI } from '../lib/api';
import { useAuth } from '../context/AuthContext';

// Yönetici/moderatörü engelleyenlerin id kümesi. Sunucu personeli engel
// filtresinden muaf tutuyor (server/utils/blockFilter.js); personel bu kişilerin
// içeriğini görüyor, yanında BlockedMeTag çıkıyor. Normal kullanıcıda uç 403
// döner, o yüzden sorgu hiç açılmıyor.
export function useBlockedByIds(): ReadonlySet<number> {
  const { user } = useAuth();
  const isStaff = user?.role === 'admin' || user?.role === 'moderator';
  const { data } = useQuery({
    queryKey: ['moderation', 'blocked-by-ids', user?.id],
    queryFn: async () => ((await moderationAPI.blockedByIds()).data?.ids ?? []).map(Number) as number[],
    enabled: isStaff,
    staleTime: 5 * 60 * 1000,
  });
  return new Set(isStaff ? data ?? [] : []);
}
