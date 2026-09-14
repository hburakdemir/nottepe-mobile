import { useCallback, useEffect, useRef, useState } from 'react';
import { postsAPI, savedPostsAPI } from '../../lib/api';
import { useSavedPosts } from '../../context/SavedPostContext';
import type { Post } from '../../types/post';

// Profil'in "Postlar" ve "Kayıtlı" sekmelerinin sayfalama durum makinesi.
//
// Bu dosya ProfileScreen'den BİREBİR taşındı; davranış bilerek değiştirilmedi.
// Sebebi: aşağıdaki her dalın arkasında belgelenmiş bir hata var (yorumlara
// bakın). Aynı sebeple bu ikisi react-query'ye de taşınmadı — kazanç, taşıma
// sırasında bu davranışların birini kaybetme riskine değmezdi.
//
// TEK GERÇEK DAVRANIŞ DEĞİŞİKLİĞİ: dışarı verilen callback'ler artık KALICI
// olarak stabil (ref üzerinden). Eskiden `loadMoreMyPosts`'un bağımlılığı
// `[myPosts, ...]` idi; o da `handleScroll`'un, o da Reanimated scroll
// worklet'inin closure'ının kimliğini değiştiriyordu — yani HER sayfalama, her
// silme ve her odak tazelemesi UI thread'inde iki worklet'i yeniden inşa
// ediyordu. Sabit kimlikle worklet mount'ta bir kez kuruluyor.

export type PostsKind = 'posts' | 'saved';

// Sekme boşken FlatList'e verilen SABİT dizi — her render'da `[]` yazmak yeni
// bir referans gösterip gereksiz iş çıkarırdı.
const EMPTY: Post[] = [];

const PAGE_LIMIT = 20;

export const postKey = (post: Post) => String(post.id ?? post.post_id);

// `/saved-posts/getPost` bazı sürümlerde comment_count döndürmüyor — eksik
// olanlar tekil gönderi ucundan (postsAPI.getById) tamamlanıyor. Bkz. aynı
// deseni kullanan SavedPostsScreen.tsx.
async function enrichMissingCommentCounts(posts: Post[]): Promise<Post[]> {
  const missing = posts.filter((p) => typeof p.comment_count === 'undefined');
  if (missing.length === 0) return posts;
  const enrichedById = new Map<string, Post>();
  await Promise.all(
    missing.map(async (post) => {
      const postId = post.id ?? post.post_id;
      if (postId == null) return;
      try {
        const fullPost = await postsAPI.getById(postId);
        enrichedById.set(String(postId), fullPost.data?.post ?? fullPost.data);
      } catch {
        /* eksik kalsın, sessizce geç */
      }
    })
  );
  return posts.map((post) => {
    const enriched = enrichedById.get(postKey(post));
    return enriched ? { ...post, ...enriched } : post;
  });
}

// Taze çekilen (genelde yalnızca 1. sayfa) satırların GÜNCEL alanlarını (yorum
// sayısı, puan vb.) eldeki listeye id eşleşmesiyle işler — sayfalama durumunu
// (page/total) ya da "load more" ile eklenen sonraki satırları bozmadan.
function mergeFreshFields(prev: Post[], fresh: Post[]): Post[] {
  if (fresh.length === 0) return prev;
  const freshByKey = new Map(fresh.map((p) => [postKey(p), p]));
  return prev.map((p) => {
    const f = freshByKey.get(postKey(p));
    return f ? { ...p, ...f } : p;
  });
}

// `mergeFreshFields` YALNIZCA `prev` içinde zaten var olan satırların üzerine
// yazıyor — listede henüz olmayan bir gönderiyi eklemiyor. Bu, kullanıcı not
// paylaşıp profile yönlendirildiğinde (AddPostScreen sonunda
// `goToTab(navigation, 'Profile')` var) yeni notun listede HİÇ görünmemesine
// yol açıyordu: profil kalıcı mount'lu bir sekme olduğu için yeniden
// yüklenmiyor, odak tazelemesi de yeni satırı atıyordu.
//
// Burada eksik olanları başa ekliyoruz — sunucu zaten en yeniyi önce döndürüyor.
function mergeFreshPage(prev: Post[], fresh: Post[]): Post[] {
  const merged = mergeFreshFields(prev, fresh);
  const known = new Set(merged.map(postKey));
  const added = fresh.filter((p) => !known.has(postKey(p)));
  return added.length > 0 ? [...added, ...merged] : merged;
}

// `/posts/my-posts` ve `/saved-posts/getPost` `page` verilince zarfa
// ({ posts, total }) girmesi gerekiyor, ama sunucu tarafı bu davranışı
// desteklemeyen bir sürümdeyse (ör. henüz dağıtılmamış bir backend değişikliği)
// `page` parametresini yok sayıp eski çıplak diziyi döndürmeye devam edebilir.
// Bu durumda `data.posts` `undefined` olur ve liste sessizce boş görünürdü —
// burada iki şekli de kabul ediyoruz.
function extractPostsPage(data: unknown): { posts: Post[]; total: number | null } {
  if (Array.isArray(data)) return { posts: data, total: null };
  const envelope = data as { posts?: Post[]; total?: number } | null | undefined;
  return {
    posts: envelope?.posts || [],
    total: typeof envelope?.total === 'number' ? envelope.total : null,
  };
}

// Sayfalar arasında araya yeni bir gönderi girerse aynı satır iki sayfada
// birden dönebiliyor; kopyalar burada eleniyor (React anahtarları eşsiz kalsın).
function appendUniquePosts(prev: Post[], rows: Post[]): Post[] {
  const seen = new Set(prev.map(postKey));
  return [...prev, ...rows.filter((p) => !seen.has(postKey(p)))];
}

function fetchPage(kind: PostsKind, page: number) {
  return kind === 'posts'
    ? postsAPI.getMyPosts({ page, limit: PAGE_LIMIT })
    : savedPostsAPI.getSavedPosts({ page, limit: PAGE_LIMIT });
}

export interface PostsPagination {
  /** FlatList'e verilecek dizi — hiç çekilmemişken de stabil boş dizi. */
  posts: Post[];
  /** `null` = ilk sayfa henüz hiç çekilmedi ("Kayıtlı" sekmesindeki spinner). */
  rows: Post[] | null;
  /** Sunucudaki TOPLAM satır sayısı; `null` = henüz bilinmiyor. */
  total: number | null;
  loadingMore: boolean;
  /** İlk çekim sürüyor mu — Profil'in tam ekran iskelet kapısı bunu okuyor. */
  firstLoading: boolean;
  /** STABİL referans (bkz. dosya başındaki not). */
  loadMore: () => void;
  /** STABİL. Odak tazelemesi; iptal fonksiyonu döndürüyor. */
  refreshFirstPage: () => () => void;
  /** STABİL. `PostCard` memo'lu, bu prop referans eşitliğini korumak zorunda. */
  handleDelete: (deletedId: string | number) => void;
}

export function usePostsPagination(kind: PostsKind, isActive: boolean): PostsPagination {
  const isSaved = kind === 'saved';
  const { savedPosts, loading: savedIdsLoading, fetchSavedPosts } = useSavedPosts();

  const [rows, setRows] = useState<Post[] | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState<number | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [firstLoading, setFirstLoading] = useState(true);

  // İstek uçuştayken ikinciyi engelleyen kapı. `state` değil `ref`: kaydırma
  // eşiği tek bir kaydırmada arka arkaya defalarca tetikleniyor, state
  // güncellemesi o ana yetişmiyor (aynı desen: NotificationsScreen).
  const inFlight = useRef(false);

  // --- İlk sayfa ----------------------------------------------------------
  const fetchFirstPage = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      const res = await fetchPage(kind, 1);
      const { posts: first, total: t } = extractPostsPage(res.data);
      setRows(first);
      setPage(1);
      setTotal(t ?? first.length);
      if (isSaved) {
        // Context'in id kümesini de tazele — aksi hâlde bookmark ikonu bu
        // sekmedeki (zaten kayıtlı olduğu bilinen) postlar için "dolu"
        // görünmeyebiliyordu, çünkü PostCard'ın isSaved kontrolü context'in
        // (uygulama açılışında bir kez çekilen) savedPosts listesine bakıyor.
        fetchSavedPosts();
        if (first.length > 0) enrichMissingCommentCounts(first).then(setRows);
      }
    } catch {
      setRows([]);
      setTotal(0);
    } finally {
      inFlight.current = false;
      setFirstLoading(false);
    }
  }, [kind, isSaved, fetchSavedPosts]);

  useEffect(() => {
    fetchFirstPage();
  }, [fetchFirstPage]);

  // Sentinel `null` ise liste geçersiz kılınmış demektir (bkz. aşağıdaki
  // kaydedilenler sayacı notu) — sekmeye girildiğinde yeniden çekiliyor.
  useEffect(() => {
    if (!isSaved || !isActive || rows !== null) return;
    fetchFirstPage();
  }, [isSaved, isActive, rows, fetchFirstPage]);

  // --- KAYDEDİLENLER SAYACI ------------------------------------------------
  // Hata şuydu: sayaç `total ?? savedPosts.length` diye yazılıyor ve niyeti
  // "sunucu toplamı biliniyorsa onu, bilinmiyorsa context'in id sayısını
  // göster" idi. Ama `??` yalnızca null/undefined için yedeğe düşer — hiç
  // kaydedilmiş notu olmayan biri profili açtığında `total` 0 yazılıyor ve 0
  // GEÇERLİ bir değer olduğu için bir daha ASLA yedeğe düşmüyordu. Kullanıcı
  // not kaydediyor, context 1 oluyor, ekranda hâlâ `0 ?? 1` = 0 görünüyordu.
  //
  // Çözüm sayacı yamamak değil, bayatlığı kaynağında bitirmek: kaydedilen id
  // listesinin uzunluğu değiştiyse bu ekranın kendi verisi artık geçersiz.
  // İkisini de sentinel'e (`null`) çekiyoruz — sayaç anında context'e düşüyor
  // (doğru değer), liste de sekmeye girildiğinde yeniden çekiliyor.
  //
  // `savedIdsLoading` beklemesi şart: context ilk yüklemesini yaparken dizi
  // önce `[]` sonra gerçek değer oluyor; o geçişi "kullanıcı bir şey kaydetti"
  // sanıp mount'ta gereksiz bir yeniden çekme tetiklemeyelim.
  const savedIdsCountRef = useRef<number | null>(null);
  useEffect(() => {
    if (!isSaved || savedIdsLoading) return;
    const count = savedPosts.length;
    if (savedIdsCountRef.current === null) {
      savedIdsCountRef.current = count;
      return;
    }
    if (savedIdsCountRef.current === count) return;
    savedIdsCountRef.current = count;
    setTotal(null);
    setRows(null);
  }, [isSaved, savedPosts, savedIdsLoading]);

  // --- Sonraki sayfalar ----------------------------------------------------
  // Durdurma koşulları: uçuşta istek var, toplam sayıya ulaşıldı ya da sunucu
  // boş sayfa döndü. Hata hâlinde sayfa numarası ARTMIYOR — yoksa o sayfa
  // kalıcı olarak atlanırdı; kullanıcı tekrar kaydırınca aynı sayfa yeniden
  // deneniyor.
  const loadMoreImpl = useCallback(async () => {
    const current = rows;
    if (inFlight.current || current === null) return;
    if (total !== null && current.length >= total) return;
    inFlight.current = true;
    setLoadingMore(true);
    const nextPage = page + 1;
    try {
      const res = await fetchPage(kind, nextPage);
      const { posts: newRows, total: t } = extractPostsPage(res.data);
      if (newRows.length === 0) {
        // Sunucu boş sayfa verdi: eldeki kadarını toplam sayıp döngüyü kapatıyoruz.
        setTotal(current.length);
      } else {
        setRows((prev) => {
          const base = prev ?? [];
          const next = appendUniquePosts(base, newRows);
          // `total` bilinmiyorsa (sunucu sayfalamayı yok sayıp AYNI tam listeyi
          // döndürüyorsa) ve eklenen satır sayısı 0 ise, gerçekte yeni bir
          // sayfa yok demektir — sonsuz "sonraki sayfa" isteğine girmemek için
          // döngüyü burada kapatıyoruz.
          if (t === null && next.length === base.length) setTotal(base.length);
          return next;
        });
        setPage(nextPage);
        if (t !== null) setTotal(t);
        if (isSaved) {
          enrichMissingCommentCounts(newRows).then((enrichedRows) => {
            if (enrichedRows === newRows) return;
            setRows((prev) => {
              if (!prev) return prev;
              const byKey = new Map(enrichedRows.map((p) => [postKey(p), p]));
              return prev.map((p) => byKey.get(postKey(p)) ?? p);
            });
          });
        }
      }
    } catch {
      // Sessiz geç: satırlar duruyor, kaydırma tekrar denetiyor.
    } finally {
      inFlight.current = false;
      setLoadingMore(false);
    }
  }, [kind, isSaved, rows, page, total]);

  // --- Odak tazelemesi -----------------------------------------------------
  // Profil, Home gibi kalıcı mount'lu bir SEKME (bkz. MainTabsScreen.tsx) —
  // bir gönderiye girip yorum ekleyip geri dönmek bu ekranı yeniden mount
  // ETMİYOR, dolayısıyla listedeki yorum sayısı sunucudan tazelenmeden bayat
  // kalıyordu (kullanıcı bildirdi). Aktif sekmenin 1. sayfası sessizce çekilip
  // id eşleşmesiyle eldeki listeye işleniyor — sayfalama/scroll konumu
  // bozulmuyor.
  const refreshImpl = useCallback(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetchPage(kind, 1);
        const { posts: fresh, total: t } = extractPostsPage(res.data);
        const merged = isSaved ? await enrichMissingCommentCounts(fresh) : fresh;
        if (cancelled) return;
        // `total` ESKİDEN ATILIYORDU: sayaç yalnızca mount'taki ilk çekimden
        // geliyordu, yani not paylaşıldıktan sonra bayat kalıyordu — hiç
        // gönderisi olmayan biri için kalıcı olarak "0". (`null` ise
        // dokunmuyoruz: eski backend şeklinde zarf yok, bilgiyi kaybetmeyelim.)
        setRows((prev) => (prev === null ? prev : mergeFreshPage(prev, merged)));
        if (t !== null) setTotal(t);
      } catch {
        /* sessiz geç: kullanıcı zaten mevcut (bayat da olsa) veriyi görüyor */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [kind, isSaved]);

  const deleteImpl = useCallback(
    (deletedId: string | number) => {
      if (isSaved) fetchSavedPosts();
      setRows((prev) => (prev ? prev.filter((p) => postKey(p) !== String(deletedId)) : prev));
      // Toplam da düşmeli, yoksa "hepsi yüklendi mi?" hesabı (length >= total)
      // bir daha tutmaz ve liste sonuna gelindiğinde boşuna istek atılır.
      setTotal((prev) => (prev === null ? prev : Math.max(0, prev - 1)));
    },
    [isSaved, fetchSavedPosts]
  );

  // --- Kimliği asla değişmeyen dışa açık callback'ler ----------------------
  // Gövde her render'da güncelleniyor ama SARMALAYICININ referansı sabit —
  // Reanimated worklet'i ve `React.memo`'lu PostCard bunu bekliyor.
  const loadMoreRef = useRef(loadMoreImpl);
  loadMoreRef.current = loadMoreImpl;
  const refreshRef = useRef(refreshImpl);
  refreshRef.current = refreshImpl;
  const deleteRef = useRef(deleteImpl);
  deleteRef.current = deleteImpl;

  const loadMore = useCallback(() => {
    loadMoreRef.current();
  }, []);
  const refreshFirstPage = useCallback(() => refreshRef.current(), []);
  const handleDelete = useCallback((deletedId: string | number) => {
    deleteRef.current(deletedId);
  }, []);

  return {
    posts: rows ?? EMPTY,
    rows,
    total,
    loadingMore,
    firstLoading,
    loadMore,
    refreshFirstPage,
    handleDelete,
  };
}
