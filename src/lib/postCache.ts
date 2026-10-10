import type { QueryClient } from '@tanstack/react-query';
import type { Post } from '../types/post';

// Bir notun alanlarını react-query önbelleğindeki HER kopyasında günceller:
// akış (`['posts', …]`, sonsuz sayfa), bölüm, başkasının profili, kayıtlılar,
// not detayı. Anahtarlar dağınık ve şekiller farklı (çıplak dizi, `{ posts }`
// zarfı, `{ pages }`) — tek tek elle güncellemek yerine veri ağacı dolaşılıyor.
//
// Profilin "Postlar" sekmesi react-query'de DEĞİL (usePostsPagination kendi
// state'inde tutuyor); oradaki kart kendi yerel state'iyle anında güncelleniyor,
// liste de odak tazelemesinde sunucudan düzeliyor.

const MAX_DEPTH = 6;

// Not satırını tanımak için dört alan birden şart: öneriler ve not istekleri
// de `id`/`title` taşıyor, aynı id'li başka bir kaydın üstüne yazılmasın.
function isPostLike(value: object): value is Post {
  return 'title' in value && 'content' in value && 'faculty' in value && 'department' in value && ('id' in value || 'post_id' in value);
}

function patchDeep(value: unknown, key: string, patch: Partial<Post>, depth: number): unknown {
  if (depth > MAX_DEPTH || value == null || typeof value !== 'object') return value;
  if (Array.isArray(value)) {
    let changed = false;
    const next = value.map((item) => {
      const patched = patchDeep(item, key, patch, depth + 1);
      if (patched !== item) changed = true;
      return patched;
    });
    return changed ? next : value;
  }
  if (isPostLike(value) && String(value.id ?? value.post_id) === key) return { ...value, ...patch };
  let changed = false;
  const next: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value)) {
    const patched = patchDeep(v, key, patch, depth + 1);
    if (patched !== v) changed = true;
    next[k] = patched;
  }
  return changed ? next : value;
}

export function patchPostInCache(queryClient: QueryClient, postId: string | number, patch: Partial<Post>) {
  const key = String(postId);
  for (const query of queryClient.getQueryCache().getAll()) {
    const data = query.state.data;
    if (data == null) continue;
    const next = patchDeep(data, key, patch, 0);
    if (next !== data) queryClient.setQueryData(query.queryKey, next);
  }
}
