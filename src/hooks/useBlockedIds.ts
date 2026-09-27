import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { moderationAPI } from '../lib/api';
import { onBlockChanged } from '../lib/moderationEvents';

export const BLOCKED_IDS_KEY = ['moderation', 'my-blocked-ids'] as const;

// Benim engellediğim kullanıcıların id kümesi. Sunucu bu kişilerin içeriğini
// listelerden ÇIKARMIYOR (yalnızca beni engelleyenlerinkini çıkarıyor);
// içeriği BlockedContentGate bu kümeye bakıp kapalı kutuyla gösteriyor.
export function useBlockedIds(): ReadonlySet<number> {
  const queryClient = useQueryClient();
  const { data } = useQuery({
    queryKey: BLOCKED_IDS_KEY,
    queryFn: async () => {
      const res = await moderationAPI.myBlocks();
      return ((res.data?.users ?? []) as { id: number }[]).map((u) => Number(u.id));
    },
    staleTime: 5 * 60 * 1000,
  });

  // Engel/engel kaldırma anında küme yeniden çekimi beklemeden güncellensin.
  useEffect(
    () =>
      onBlockChanged((userId, blocked) => {
        queryClient.setQueryData<number[]>(BLOCKED_IDS_KEY, (prev = []) =>
          blocked ? Array.from(new Set([...prev, userId])) : prev.filter((id) => id !== userId)
        );
      }),
    [queryClient]
  );

  return new Set(data ?? []);
}
