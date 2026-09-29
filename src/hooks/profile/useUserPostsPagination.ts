import { useCallback, useMemo, useRef } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { userAPI } from '../../lib/api';
import type { Post } from '../../types/post';
import { postKey } from './usePostsPagination';

// Başkasının profilindeki "Postlar" sekmesinin sayfalaması — kendi profilindeki
// `usePostsPagination` ile AYNI çıktı şekli, böylece aynı `PostsTab` (sonsuz
// kaydırmalı FlatList) iki profilde de birebir çalışıyor. Eskiden burada
// 12'şerlik "Sayfa 1 / 3" düğmeleri vardı.
//
// Kendi profilinin durum makinesi gibi odak tazelemesi / silme / kayıtlı sayacı
// yamaları burada yok: başkasının listesi salt okunur, yığın ekranı her
// açılışta yeniden kuruluyor.

const PAGE_LIMIT = 20;
const EMPTY: Post[] = [];

export function useUserPostsPagination(username: string, enabled: boolean) {
  const query = useInfiniteQuery({
    queryKey: ['user-profile', username, 'posts'],
    enabled,
    initialPageParam: 1,
    queryFn: async ({ pageParam }) => {
      const res = await userAPI.getPosts(username, { page: pageParam, limit: PAGE_LIMIT });
      return { posts: (res.data.posts || []) as Post[], total: Number(res.data.total) || 0, page: pageParam };
    },
    getNextPageParam: (last, pages) => {
      const loaded = pages.reduce((n, p) => n + p.posts.length, 0);
      return last.posts.length > 0 && loaded < last.total ? last.page + 1 : undefined;
    },
    staleTime: 60 * 1000,
  });

  // Sayfalar arasında araya yeni gönderi girerse aynı satır iki sayfada
  // dönebiliyor — kopyalar elenerek React anahtarları eşsiz kalıyor.
  const rows = useMemo<Post[] | null>(() => {
    if (!query.data) return query.isError ? [] : null;
    const seen = new Set<string>();
    const out: Post[] = [];
    for (const page of query.data.pages) {
      for (const p of page.posts) {
        const k = postKey(p);
        if (!seen.has(k)) {
          seen.add(k);
          out.push(p);
        }
      }
    }
    return out;
  }, [query.data, query.isError]);

  // STABİL referans: PostsTab'ın scroll worklet'i bu fonksiyonu closure'ında
  // tutuyor, kimliği değişirse worklet UI thread'inde yeniden kurulur.
  //
  // `inFlight` ref'i ŞART: kaydırma eşiği tek kaydırmada arka arkaya defalarca
  // tetikleniyor ve `query.isFetchingNextPage` bir sonraki render'a kadar
  // güncellenmiyor — kilit olmadan aynı sayfa 3-7 kez isteniyordu (ölçüldü).
  // `cancelRefetch: false`: uçuştaki isteği iptal edip yeniden başlatmasın.
  const queryRef = useRef(query);
  queryRef.current = query;
  const inFlight = useRef(false);
  const loadMore = useCallback(() => {
    const q = queryRef.current;
    if (inFlight.current || !q.hasNextPage || q.isFetching) return;
    inFlight.current = true;
    q.fetchNextPage({ cancelRefetch: false }).finally(() => {
      inFlight.current = false;
    });
  }, []);

  return {
    posts: rows ?? EMPTY,
    rows,
    total: query.data?.pages[0]?.total ?? null,
    loadingMore: query.isFetchingNextPage,
    firstLoading: query.isPending && enabled,
    loadMore,
  };
}
