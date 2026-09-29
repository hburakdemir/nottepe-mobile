import type { InfiniteData, QueryClient } from '@tanstack/react-query';

// Forum (Öneriler / SSS) liste ekranlarının yorum sayacı.
//
// Detay ekranı yorum ekleyip silince yalnızca KENDİ anahtarını yazıyor; liste
// ekranı yığında altta takılı kalıyor ve verisi 5 dk "taze" sayıldığı için geri
// dönünce eski `comment_count` görünüyordu. Detay, sunucunun döndürdüğü yeni
// toplamı buradan listedeki öğeye yazıyor — ek istek yok, geri dönüşte anında doğru.
type Page<K extends string> = { [P in K]: { id: string | number; comment_count: number }[] } & { total: number };

export function setListCommentCount<K extends string>(
  queryClient: QueryClient,
  listKey: readonly unknown[],
  itemsField: K,
  id: string | number,
  count: number
) {
  queryClient.setQueryData<InfiniteData<Page<K>>>(listKey, (prev) => {
    if (!prev) return prev;
    let changed = false;
    const pages = prev.pages.map((page) => {
      const items = page[itemsField];
      if (!items?.some((it) => String(it.id) === String(id) && it.comment_count !== count)) return page;
      changed = true;
      return { ...page, [itemsField]: items.map((it) => (String(it.id) === String(id) ? { ...it, comment_count: count } : it)) };
    });
    return changed ? { ...prev, pages } : prev;
  });
}
