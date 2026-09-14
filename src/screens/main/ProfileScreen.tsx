import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import Animated, {
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { useFocusEffect, useRoute } from '@react-navigation/native';
import { useQueryClient } from '@tanstack/react-query';
import { useDelayedLoading } from '../../hooks/useDelayedLoading';
import type { RouteProp } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Camera, Edit2, FileText, Palette } from 'lucide-react-native';
import DeerIcon from '../../components/icons/DeerIcon';
import { avatarAPI, badgeAPI, postsAPI, savedPostsAPI } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { useSavedPosts } from '../../context/SavedPostContext';
import PostCard from '../../components/PostCard';

// "Postlar" ve "Kayıtlı" sekmelerinin sayfa boyu (bkz. postsAPI.getMyPosts /
// savedPostsAPI.getSavedPosts — argüman verilince yanıt zarfa giriyor).
const POST_PAGE_LIMIT = 20;
import BadgeChip, { type Badge } from '../../components/BadgeChip';
import ProfileEditModal from '../../components/profile/ProfileEditModal';
import DeleteAccountModal from '../../components/profile/DeleteAccountModal';
import AvatarBuilderScreen from './AvatarBuilderScreen';
import { MY_AVATAR_KEY, useInvalidateMyAvatar, useMyAvatar } from '../../hooks/useMyAvatar';
import AvatarDisplay from '../../components/avatar/AvatarDisplay';
import type { AvatarData } from '../../components/avatar/AvatarDisplay';
import type { Post } from '../../types/post';
import type { MainTabParamList } from '../../navigation/types';
import { useTheme } from '../../context/ThemeContext';
import { TAB_BAR_SAFE_PADDING } from '../../components/layout/tabBarMetrics';
import { useMetrics } from '../../theme/metrics';
import ProfileSkeleton from '../../components/profile/ProfileSkeleton';
import { EmptyState, SHADOW_MD, TABS, TabLoading, type TabKey } from '../../components/profile/profileCommon';
import { PagerPlaceholder } from '../../components/profile/PagerPage';
import ChecklistsTab from '../../components/profile/ChecklistsTab';
import AktsTab from '../../components/profile/AktsTab';
import ScheduleTab from '../../components/profile/ScheduleTab';
import FollowsTab from '../../components/profile/FollowsTab';
import ForumsTab from '../../components/profile/ForumsTab';
import { useMyAktsCalcs, useMyChecklists, useMyFollows, useMySchedule } from '../../hooks/profile/useProfileLists';

const postKey = (post: Post) => String(post.id ?? post.post_id);

// Etkin olmayan sekmenin listesine verilen SABİT boş dizi — her render'da `[]`
// yazmak FlatList'e yeni bir referans gösterip gereksiz iş çıkarırdı.
const NO_POSTS: Post[] = [];

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
    const key = postKey(post);
    const enriched = enrichedById.get(key);
    return enriched ? { ...post, ...enriched } : post;
  });
}

// Taze çekilen (genelde yalnızca 1. sayfa) satırların GÜNCEL alanlarını
// (yorum sayısı, puan vb.) eldeki listeye id eşleşmesiyle işler — sayfalama
// durumunu (page/total) ya da "load more" ile eklenen sonraki satırları
// bozmadan. Bkz. Postlar/Kayıtlı sekmelerindeki focus-tazeleme.
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
// Burada eksik olanları başa ekliyoruz — sunucu zaten en yeniyi önce
// döndürüyor.
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

export default function ProfileScreen() {
  const route = useRoute<RouteProp<MainTabParamList, 'Profile'>>();
  const { user } = useAuth();
  const isStaff = user?.role === 'admin' || user?.role === 'moderator';
  const { savedPosts, loading: savedIdsLoading, fetchSavedPosts } = useSavedPosts();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [loadingRaw, setLoading] = useState(true);
  // İnternet hızlıysa (veri 200ms'den önce gelirse) LoadingDeer HİÇ
  // görünmüyor. bkz. useDelayedLoading.ts
  const loading = useDelayedLoading(loadingRaw);
  const [activeTab, setActiveTab] = useState<TabKey>(route.params?.initialTab ?? 'posts');
  // Sekmeler artık yatay kaydırmalı bir "pager" (bkz. render) — sekme
  // butonuna basınca ya da kaydırma bitince ikisi birbirini senkron tutuyor.
  const pagerRef = useRef<ScrollView>(null);
  // Pager gerçekte ContentContainer'ın (bkz. src/theme/metrics.ts) sınırladığı
  // `contentMaxWidth` genişliğinde render ediliyor, tam ekran genişliğinde
  // değil — tablette bu ikisi (screenWidth vs. gerçek pager genişliği)
  // birbirinden ayrışınca sekmeler arası kayma/flash oluyordu.
  const { width: windowWidth, contentMaxWidth } = useMetrics();
  const screenWidth = Math.min(windowWidth, contentMaxWidth);

  // Mount'ta çekilenler: yalnızca ilk açılan "Postlar" sekmesi ve profil
  // kartındaki rozetler.
  const [myPosts, setMyPosts] = useState<Post[]>([]);
  const [badges, setBadges] = useState<Badge[]>([]);

  // --- Sonsuz kaydırma durumu (yalnızca iki gönderi sekmesi) --------------
  // `total` sunucudaki gerçek satır sayısı: "hepsi yüklendi mi?" sorusu
  // `liste.length >= total` ile cevaplanıyor, sekme sayaçları da bunu yazıyor.
  // `null` = henüz bilinmiyor.
  const [myPostsPage, setMyPostsPage] = useState(1);
  const [myPostsTotal, setMyPostsTotal] = useState<number | null>(null);
  const [myPostsLoadingMore, setMyPostsLoadingMore] = useState(false);
  const [savedPostsPage, setSavedPostsPage] = useState(1);
  const [savedPostsTotal, setSavedPostsTotal] = useState<number | null>(null);
  const [savedPostsLoadingMore, setSavedPostsLoadingMore] = useState(false);
  // İstek uçuştayken ikinciyi engelleyen kapılar. `state` değil `ref`: kaydırma
  // eşiği tek bir kaydırmada arka arkaya defalarca tetikleniyor, state
  // güncellemesi o ana yetişmiyor (aynı desen: NotificationsScreen).
  const myPostsInFlight = useRef(false);
  const savedPostsInFlight = useRef(false);

  // Tembel yüklenen "Kayıtlı" sekmesi — `null` = henüz çekilmedi, `[]` =
  // gerçekten boş. Sentinel'i tekrar `null`'a çekmek yeniden yüklemeyi
  // tetikliyor.
  const [savedPostsData, setSavedPostsData] = useState<Post[] | null>(null);

  // Kalan dört listenin verisi artık BU BİLEŞENDE DEĞİL: her biri kendi sekme
  // bileşeninin içinde, react-query anahtarı üzerinden (bkz.
  // hooks/profile/useProfileLists.ts). Burada yalnızca sekme şeridindeki
  // SAYAÇLAR için okunuyorlar — aynı anahtar olduğu için ikinci bir ağ isteği
  // atılmıyor ve "sayaçlar tıklamadan dolmalı" kuralı korunuyor.
  const { data: checklistsForCount } = useMyChecklists();
  const { data: aktsForCount } = useMyAktsCalcs();
  const { data: scheduleForCount } = useMySchedule();
  const { data: followsForCount } = useMyFollows();

  // Avatar artık burada ayrıca çekilmiyor: üst bar ve tab bar ile aynı
  // react-query anahtarını (`MY_AVATAR_KEY`, bkz. hooks/useMyAvatar.ts)
  // paylaşıyor — böylece açılışta tek bir `avatarAPI.get()` isteği kalıyor.
  const avatar = useMyAvatar();
  const queryClient = useQueryClient();
  // Avatar değişince üst bar ve tab bar da tazelensin.
  const invalidateMyAvatar = useInvalidateMyAvatar();
  const [photoUploading, setPhotoUploading] = useState(false);

  const [showAvatarBuilder, setShowAvatarBuilder] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // Sekme şeridindeki sayaçlar eskiden yalnızca o sekmeye ilk kez basıldığında
  // doluyordu (tembel yükleme) — kullanıcı "tıklamadan sayılar gösterilmiyor"
  // diye bildirdi. Bu yüzden checklist/AKTS/program/takip uçları AÇILIŞTA
  // çekilmeye devam ediyor; değişen şey nerede çekildikleri: artık react-query
  // anahtarlarında (yukarıdaki `...ForCount` hook'ları), ham state'te değil.
  // Aynı anahtarı sekme bileşeni de okuduğu için ikinci istek atılmıyor.
  //
  // "Kayıtlı" sayacı ESKİDEN SavedPostContext'in `/saved-posts/ids` sonucuna
  // (global, uygulama açılışında BİR KEZ çekilen `savedPosts.length`)
  // bakıyordu — kullanıcı "kayıtlı sekmesi 0 gösteriyor" diye bildirdi:
  // context'in tek seferlik sonucu, aynı oturumda başka yerden değişen gerçek
  // veriyle senkron kalmıyordu. Artık kendi `/saved-posts/getPost` isteğiyle
  // taze çekiliyor, context'e bağımlılık yok.
  //
  // Eskiden yedi istek tek bir `Promise.allSettled`'da toplanıyor ve
  // `setLoading` hepsi bitince kapanıyordu — yani profil, EN YAVAŞ isteğin
  // süresi kadar tam ekran spinner gösteriyordu. Kullanıcı şikayeti ("profil
  // sayfasının yüklenmesi çok uzun sürüyor") tam olarak buydu. Artık ekranın
  // ilk karesini YALNIZCA kendi gönderilerin belirliyor.
  const fetchCore = useCallback(async () => {
    setLoading(true);
    myPostsInFlight.current = true;

    // --- Bekletmeyenler: geldiklerinde kendi state'lerine düşüyorlar --------
    badgeAPI
      .getMine()
      .then((res) => setBadges(res.data.badges || []))
      .catch(() => setBadges([]));

    savedPostsAPI
      .getSavedPosts({ page: 1, limit: POST_PAGE_LIMIT })
      .then((res) => {
        const { posts: savedFirstPage, total: savedTotal } = extractPostsPage(res.data);
        setSavedPostsData(savedFirstPage);
        setSavedPostsPage(1);
        setSavedPostsTotal(savedTotal ?? savedFirstPage.length);
        // Context'in id kümesini de tazele — aksi hâlde bookmark ikonu bu
        // sekmedeki (zaten kayıtlı olduğu bilinen) postlar için "dolu"
        // görünmeyebiliyordu, çünkü PostCard'ın isSaved kontrolü context'in
        // (uygulama açılışında bir kez çekilen) savedPosts listesine bakıyor.
        fetchSavedPosts();
        if (savedFirstPage.length > 0) {
          enrichMissingCommentCounts(savedFirstPage).then(setSavedPostsData);
        }
      })
      .catch(() => {
        setSavedPostsData([]);
        setSavedPostsTotal(0);
      });

    // --- Ekranın ilk karesini belirleyen tek istek -------------------------
    try {
      const res = await postsAPI.getMyPosts({ page: 1, limit: POST_PAGE_LIMIT });
      const { posts: firstPage, total } = extractPostsPage(res.data);
      setMyPosts(firstPage);
      setMyPostsPage(1);
      setMyPostsTotal(total ?? firstPage.length);
    } catch {
      setMyPosts([]);
      setMyPostsTotal(0);
    } finally {
      myPostsInFlight.current = false;
      setLoading(false);
    }
  }, [fetchSavedPosts]);

  useEffect(() => {
    fetchCore();
  }, [fetchCore]);

  // Profil artık kalıcı mount'lu bir SEKME (bkz. MainTabsScreen.tsx) — bu
  // yüzden `initialTab` yalnızca useState'in başlangıç değeri olarak okunamaz:
  // menüdeki "Notlarım" / "Kaydettiğim Notlarım" kısayolları ikinci kez
  // basıldığında da doğru sekmeyi açsın diye parametre değiştikçe uygulanıyor.
  const initialTabParam = route.params?.initialTab;
  useEffect(() => {
    if (!initialTabParam) return;
    setActiveTab(initialTabParam);
    const idx = TABS.findIndex((t) => t.key === initialTabParam);
    if (idx >= 0) pagerRef.current?.scrollTo({ x: idx * screenWidth, animated: false });
  }, [initialTabParam, screenWidth]);

  // --- Sekme başına tembel yükleme ---------------------------------------
  // Hepsi aynı deseni izliyor: sentinel `null` ise sekme henüz açılmamış
  // demektir, ilk açılışta çekiliyor. Hata durumunda `[]` yazılıyor ki ekran
  // sonsuza kadar yükleniyor göstermesin. `activeTab`'a bağlı oldukları için
  // `route.params.initialTab` ile doğrudan bir sekmeye girildiğinde de
  // (örn. menüdeki "Kaydettiğim Notlarım") aynı şekilde tetikleniyorlar.
  const fetchSavedFirstPage = useCallback(async () => {
    if (savedPostsInFlight.current) return;
    savedPostsInFlight.current = true;
    try {
      const res = await savedPostsAPI.getSavedPosts({ page: 1, limit: POST_PAGE_LIMIT });
      const { posts: rows, total } = extractPostsPage(res.data);
      setSavedPostsData(rows);
      setSavedPostsPage(1);
      setSavedPostsTotal(total ?? rows.length);
      // Bkz. fetchCore'daki not: bookmark ikonu context'in savedPosts id
      // kümesine bakıyor, bu yüzden bu ekranın kendi verisiyle birlikte tazelenmeli.
      fetchSavedPosts();
      if (rows.length > 0) {
        enrichMissingCommentCounts(rows).then(setSavedPostsData);
      }
    } catch {
      setSavedPostsData([]);
      setSavedPostsTotal(0);
    } finally {
      savedPostsInFlight.current = false;
    }
  }, [fetchSavedPosts]);

  useEffect(() => {
    if (activeTab !== 'saved' || savedPostsData !== null) return;
    fetchSavedFirstPage();
  }, [activeTab, savedPostsData, fetchSavedFirstPage]);

  // KAYDEDİLENLER SAYACI: bir not kaydedilince/çıkarılınca burayı tazele.
  //
  // Hata şuydu: sayaç `savedPostsTotal ?? savedPosts.length` diye yazılıyor ve
  // niyeti "sunucu toplamı biliniyorsa onu, bilinmiyorsa context'in id
  // sayısını göster" idi. Ama `??` yalnızca null/undefined için yedeğe düşer —
  // hiç kaydedilmiş notu olmayan biri profili açtığında `savedPostsTotal` 0
  // yazılıyor ve 0 GEÇERLİ bir değer olduğu için bir daha ASLA yedeğe
  // düşmüyordu. Kullanıcı not kaydediyor, context 1 oluyor, ekranda hâlâ
  // `0 ?? 1` = 0 görünüyordu.
  //
  // Çözüm sayacı yamamak değil, bayatlığı kaynağında bitirmek: kaydedilen id
  // listesinin uzunluğu değiştiyse bu ekranın kendi verisi artık geçersiz.
  // İkisini de sentinel'e (`null`) çekiyoruz — sayaç anında context'e düşüyor
  // (doğru değer), liste de sekmeye girildiğinde yeniden çekiliyor.
  //
  // `savedIdsLoading` beklemesi şart: context ilk yüklemesini yaparken dizi
  // önce `[]` sonra gerçek değer oluyor; o geçişi "kullanıcı bir şey kaydetti"
  // sanıp mount'ta gereksiz bir yeniden çekme tetiklemeyelim. Temel değer,
  // context ilk kez oturduğunda alınıyor.
  const savedIdsCountRef = useRef<number | null>(null);
  useEffect(() => {
    if (savedIdsLoading) return;
    const count = savedPosts.length;
    if (savedIdsCountRef.current === null) {
      savedIdsCountRef.current = count;
      return;
    }
    if (savedIdsCountRef.current === count) return;
    savedIdsCountRef.current = count;
    setSavedPostsTotal(null);
    setSavedPostsData(null);
  }, [savedPosts, savedIdsLoading]);

  // Profil, Home gibi kalıcı mount'lu bir SEKME (bkz. MainTabsScreen.tsx) —
  // bir gönderiye girip yorum ekleyip geri dönmek bu ekranı yeniden mount
  // ETMİYOR, dolayısıyla `myPosts`/`savedPostsData` içindeki yorum sayısı
  // sunucudan tazelenmeden bayat kalıyordu (kullanıcı bildirdi). Sekme her
  // odaklandığında aktif sekmenin 1. sayfası sessizce çekilip id eşleşmesiyle
  // eldeki listeye işleniyor — sayfalama/scroll konumu bozulmuyor.
  //
  // ÖNEMLİ: useCallback bağımlılığı SADECE `activeTab` (bir primitive) —
  // `myPosts`/`savedPostsData` deps'e girseydi, bu efektin kendi setState'i
  // yeni bir dizi referansı üretip callback'i yeniden kurar, bu da
  // useFocusEffect'i odaktayken tekrar tetikler, o da tekrar setState çağırır:
  // sonsuz döngü (bkz. SavedPostContext.fetchSavedPosts'ta yaşanan aynı hata).
  const didProfileFocusOnceRef = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (!didProfileFocusOnceRef.current) {
        didProfileFocusOnceRef.current = true;
        return;
      }
      let cancelled = false;
      (async () => {
        try {
          // `total` ESKİDEN ATILIYORDU. Sayaçlar (`myPostsTotal` /
          // `savedPostsTotal`) yalnızca mount'taki ilk çekimden geliyordu, yani
          // not paylaşıldıktan sonra bayat kalıyordu — hiç gönderisi olmayan
          // biri için kalıcı olarak "0". Artık her odak tazelemesinde sunucunun
          // söylediği toplam yazılıyor. (`null` ise dokunmuyoruz: eski backend
          // şeklinde zarf yok, bilgiyi kaybetmeyelim.)
          if (activeTab === 'posts') {
            const res = await postsAPI.getMyPosts({ page: 1, limit: POST_PAGE_LIMIT });
            const { posts: fresh, total } = extractPostsPage(res.data);
            if (!cancelled) {
              setMyPosts((prev) => mergeFreshPage(prev, fresh));
              if (total !== null) setMyPostsTotal(total);
            }
          } else if (activeTab === 'saved') {
            const res = await savedPostsAPI.getSavedPosts({ page: 1, limit: POST_PAGE_LIMIT });
            const { posts: fresh, total } = extractPostsPage(res.data);
            const enrichedFresh = await enrichMissingCommentCounts(fresh);
            if (!cancelled) {
              setSavedPostsData((prev) => (prev ? mergeFreshPage(prev, enrichedFresh) : prev));
              if (total !== null) setSavedPostsTotal(total);
            }
          }
        } catch {
          /* sessiz geç: kullanıcı zaten mevcut (bayat da olsa) veriyi görüyor */
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [activeTab])
  );

  // --- Sonraki sayfalar ---------------------------------------------------
  // Durdurma koşulları: uçuşta istek var, toplam sayıya ulaşıldı ya da sunucu
  // boş sayfa döndü. Hata hâlinde sayfa numarası ARTMIYOR — yoksa o sayfa
  // kalıcı olarak atlanırdı; kullanıcı tekrar kaydırınca aynı sayfa yeniden
  // deneniyor.
  const loadMoreMyPosts = useCallback(async () => {
    if (myPostsInFlight.current) return;
    if (myPostsTotal !== null && myPosts.length >= myPostsTotal) return;
    myPostsInFlight.current = true;
    setMyPostsLoadingMore(true);
    const nextPage = myPostsPage + 1;
    try {
      const res = await postsAPI.getMyPosts({ page: nextPage, limit: POST_PAGE_LIMIT });
      const { posts: rows, total } = extractPostsPage(res.data);
      if (rows.length === 0) {
        // Sunucu boş sayfa verdi: eldeki kadarını toplam sayıp döngüyü kapatıyoruz.
        setMyPostsTotal(myPosts.length);
      } else {
        setMyPosts((prev) => {
          const next = appendUniquePosts(prev, rows);
          // `total` bilinmiyorsa (sunucu sayfalamayı yok sayıp AYNI tam listeyi
          // döndürüyorsa) ve eklenen satır sayısı 0 ise, gerçekte yeni bir
          // sayfa yok demektir — sonsuz "sonraki sayfa" isteğine girmemek için
          // döngüyü burada kapatıyoruz.
          if (total === null && next.length === prev.length) setMyPostsTotal(prev.length);
          return next;
        });
        setMyPostsPage(nextPage);
        if (total !== null) setMyPostsTotal(total);
      }
    } catch {
      // Sessiz geç: satırlar duruyor, kaydırma tekrar denetiyor.
    } finally {
      myPostsInFlight.current = false;
      setMyPostsLoadingMore(false);
    }
  }, [myPosts, myPostsPage, myPostsTotal]);

  const loadMoreSavedPosts = useCallback(async () => {
    if (savedPostsInFlight.current || savedPostsData === null) return;
    if (savedPostsTotal !== null && savedPostsData.length >= savedPostsTotal) return;
    savedPostsInFlight.current = true;
    setSavedPostsLoadingMore(true);
    const nextPage = savedPostsPage + 1;
    try {
      const res = await savedPostsAPI.getSavedPosts({ page: nextPage, limit: POST_PAGE_LIMIT });
      const { posts: rows, total } = extractPostsPage(res.data);
      if (rows.length === 0) {
        setSavedPostsTotal(savedPostsData.length);
      } else {
        setSavedPostsData((prev) => {
          const base = prev ?? [];
          const next = appendUniquePosts(base, rows);
          if (total === null && next.length === base.length) setSavedPostsTotal(base.length);
          return next;
        });
        setSavedPostsPage(nextPage);
        if (total !== null) setSavedPostsTotal(total);
        enrichMissingCommentCounts(rows).then((enrichedRows) => {
          if (enrichedRows === rows) return;
          setSavedPostsData((prev) => {
            if (!prev) return prev;
            const byKey = new Map(enrichedRows.map((p) => [postKey(p), p]));
            return prev.map((p) => byKey.get(postKey(p)) ?? p);
          });
        });
      }
    } catch {
      // Bkz. loadMoreMyPosts.
    } finally {
      savedPostsInFlight.current = false;
      setSavedPostsLoadingMore(false);
    }
  }, [savedPostsData, savedPostsPage, savedPostsTotal]);

  // Sekme içerikleri dış ScrollView'in içinde `map` ile basılıyor (FlatList
  // yok, bkz. render). Bu yüzden `onEndReached` yerine ScrollView'in kendi
  // kaydırma olayından, görünür yüksekliğin yarısı kadar bir eşikle
  // ("onEndReachedThreshold={0.5}" karşılığı) tetikliyoruz.
  //
  // Artık iki sayfa (`posts`/`saved`) Reanimated'in `useAnimatedScrollHandler`
  // ile kaydırılıyor (bkz. aşağıdaki kayan başlık bloğu) — bu yüzden `tab`
  // parametresiyle çağrılıyor ve `nativeEvent`'i doğrudan (sarmalanmamış)
  // alıyor. `activeTab !== tab` kontrolü, yalnızca gerçekten görünür sayfa
  // sonraki sayfayı çekebilsin diye korunuyor.
  const handleScroll = useCallback(
    (tab: 'posts' | 'saved', nativeEvent: NativeScrollEvent) => {
      if (activeTab !== tab) return;
      const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
      const distanceToEnd = contentSize.height - contentOffset.y - layoutMeasurement.height;
      if (distanceToEnd > layoutMeasurement.height * 0.5) return;
      if (tab === 'posts') loadMoreMyPosts();
      else loadMoreSavedPosts();
    },
    [activeTab, loadMoreMyPosts, loadMoreSavedPosts]
  );

  // ÖNEMLİ (off-by-one düzeltmesi): eskiden pager'ın `contentOffset` prop'u
  // HER render'da canlı olarak yeniden yazılıyordu. `handleTabPress`'in
  // başlattığı `scrollTo({animated:true})` sürerken bu `onScroll` (32ms
  // throttle) ara bir indeksi yuvarlayıp `setActiveTab` çağırıyordu, bu da
  // `contentOffset`'i o ara sayfaya çakıp animasyonu BİR SAYFA ERKEN
  // durduruyordu — "tablarda gezerken neye tıkladıysam bir sağına ya da bir
  // soluna gidiyor" şikâyeti buydu. Artık `contentOffset` prop'u yok (bkz.
  // render), kesin doğru sayfa `onMomentumScrollEnd`'den geliyor;
  // `handlePagerScroll` yalnızca sürüklerken şeridin/sayfanın önizlemesi
  // için çalışıyor ve KENDİ programatik `scrollTo`'muz sürerken (bu kilit
  // sayesinde) devre dışı kalıyor.
  const isProgrammaticScrollRef = useRef(false);

  const handlePagerScroll = useCallback(
    ({ nativeEvent }: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (isProgrammaticScrollRef.current) return;
      if (screenWidth <= 0) return;
      const idx = Math.round(nativeEvent.contentOffset.x / screenWidth);
      const key = TABS[idx]?.key;
      if (key && key !== activeTab) setActiveTab(key);
    },
    [screenWidth, activeTab]
  );

  // Kaydırma bittiğinde (elle sürükleyip bırakınca DA, `pagingEnabled`
  // sayfayı kendi kendine hizaya oturttuğunda DA) gerçek sayfa burada kesin
  // olarak belirleniyor — hiçbir sayfa boş/yanlış sekmede takılı kalmıyor.
  const handlePagerMomentumEnd = useCallback(
    ({ nativeEvent }: NativeSyntheticEvent<NativeScrollEvent>) => {
      isProgrammaticScrollRef.current = false;
      if (screenWidth <= 0) return;
      const idx = Math.round(nativeEvent.contentOffset.x / screenWidth);
      const key = TABS[idx]?.key;
      if (key && key !== activeTab) setActiveTab(key);
    },
    [screenWidth, activeTab]
  );

  const handleTabPress = useCallback(
    (index: number) => {
      isProgrammaticScrollRef.current = true;
      setActiveTab(TABS[index].key);
      pagerRef.current?.scrollTo({ x: index * screenWidth, animated: true });
    },
    [screenWidth]
  );

  // --- Sekme şeridini aktif sekmeye ortalama --------------------------------
  // Eskiden şeridin ne `ref`'i ne `onLayout`'u ne de bir `scrollTo` çağrısı
  // vardı — sekmeler hiçbir zaman ortalanmıyordu, 5-7. sekmeler ekran dışında
  // kalıyordu ("tablar asla olması gereken yerde ortada render olmuyor").
  // Her sekmenin x/width'i `onLayout` ile ölçülüp (bkz. render) aktif sekme
  // değiştiğinde şerit o sekmeyi ortasına getirecek şekilde kaydırılıyor.
  const stripRef = useRef<ScrollView>(null);
  const stripWidthRef = useRef(0);
  const stripContentWidthRef = useRef(0);
  const tabLayoutsRef = useRef<Partial<Record<TabKey, { x: number; width: number }>>>({});

  const centerStripOn = useCallback((key: TabKey) => {
    const item = tabLayoutsRef.current[key];
    const stripWidth = stripWidthRef.current;
    if (!item || stripWidth <= 0) return;
    const maxScroll = Math.max(0, stripContentWidthRef.current - stripWidth);
    const target = Math.min(Math.max(item.x + item.width / 2 - stripWidth / 2, 0), maxScroll);
    stripRef.current?.scrollTo({ x: target, animated: true });
  }, []);

  useEffect(() => {
    centerStripOn(activeTab);
  }, [activeTab, centerStripOn]);

  // `useCallback` ŞART: `PostCard` `React.memo` ile sarılı ve bu fonksiyon ona
  // prop olarak gidiyor. Her render'da yeniden yaratıldığında referans eşitliği
  // bozuluyor, memo hiçbir kartı atlayamıyor ve kaydırma sırasında TÜM liste
  // yeniden render oluyordu — memo'nun bu ekranda etkisiz kalmasının sebebi.
  const handlePostDelete = useCallback((deletedId: string | number) => {
    setMyPosts((prev) => prev.filter((p) => postKey(p) !== String(deletedId)));
    // Toplam da düşmeli, yoksa "hepsi yüklendi mi?" hesabı (length >= total)
    // bir daha tutmaz ve liste sonuna gelindiğinde boşuna istek atılır.
    setMyPostsTotal((prev) => (prev === null ? prev : Math.max(0, prev - 1)));
  }, []);

  // Kaydedilenler sekmesindeki kartlara ESKİDEN her render'da yeniden yaratılan
  // satır içi bir ok fonksiyonu veriliyordu — aynı memo kırılması. Silinen
  // kartın kimliği artık kapanıştan (closure) değil parametreden geliyor.
  const handleSavedPostDelete = useCallback(
    (deletedId: string | number) => {
      fetchSavedPosts();
      setSavedPostsData((prev) => (prev ? prev.filter((p) => postKey(p) !== String(deletedId)) : prev));
      setSavedPostsTotal((prev) => (prev === null ? prev : Math.max(0, prev - 1)));
    },
    [fetchSavedPosts]
  );

  const renderMyPost = useCallback(
    ({ item }: { item: Post }) => <PostCard post={item} showStatus showRating={false} onDelete={handlePostDelete} />,
    [handlePostDelete]
  );

  const renderSavedPost = useCallback(
    ({ item }: { item: Post }) => <PostCard post={item} showStatus showRating onDelete={handleSavedPostDelete} />,
    [handleSavedPostDelete]
  );

  const visibleBadgeCount = badges.filter((b) => b.is_visible !== false).length;

  const handleToggleBadgeVisibility = async (badge: Badge) => {
    const nextVisible = !(badge.is_visible !== false);
    if (!nextVisible && visibleBadgeCount <= 1) {
      Alert.alert('Uyarı', 'En az bir rozet görünür kalmalı.');
      return;
    }
    try {
      await badgeAPI.setVisibility(badge.id, nextVisible);
      setBadges((prev) => prev.map((b) => (b.id === badge.id ? { ...b, is_visible: nextVisible } : b)));
    } catch (err: any) {
      Alert.alert('Hata', err.response?.data?.message || 'Rozet görünürlüğü güncellenemedi.');
    }
  };

  const handlePickPhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('İzin gerekli', 'Fotoğraf seçmek için galeri izni vermelisiniz.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    setPhotoUploading(true);
    try {
      const res = await avatarAPI.uploadPhoto({
        uri: asset.uri,
        name: asset.fileName || 'photo.jpg',
        type: asset.mimeType || 'image/jpeg',
      });
      // Yanıttaki avatarı önbelleğe doğrudan yazıyoruz ki bu ekran, üst bar ve
      // tab bar ağ turunu beklemeden anında güncellensin; ardından gelen
      // invalidate sunucudaki son hâlle senkronu garantiliyor.
      queryClient.setQueryData(MY_AVATAR_KEY, (res.data.avatar as AvatarData | null) ?? null);
      invalidateMyAvatar();
    } catch (err: any) {
      Alert.alert('Hata', err.response?.data?.error || 'Fotoğraf yüklenemedi.');
    } finally {
      setPhotoUploading(false);
    }
  };

  // --- Kayan (collapsing) profil başlığı -----------------------------------
  // Eskiden profil kartı + sekme şeridi pager'ın DIŞINDA, sabit duruyordu —
  // "aşağı kaydırdıkça profil kısmı sabit kalmamalı, kaymalı, en üstte tablar
  // kalacak kadar yok olabilmeli" şikâyeti buydu. Artık kart ölçülüp
  // (`cardHeight`) sayfa içeriği o kadar boşlukla başlıyor; kart+şerit,
  // sayfanın ÜSTÜNDE mutlak konumlu bir katman olarak `scrollY` kadar yukarı
  // kayıyor. Sayfanın kendi native kaydırması içeriği zaten normal şekilde
  // yukarı taşıdığı için (paddingTop sabit kalıyor), üstteki katman sadece
  // "kart kadar" yukarı gidip duruyor — şerit böylece ekranın en üstünde
  // yapışık kalıyor, kart tamamen kayboluyor.
  const scrollY = useSharedValue(0);
  const [cardHeight, setCardHeight] = useState(0);
  const cardHeightShared = useSharedValue(0);
  const [stripHeight, setStripHeight] = useState(0);
  const headerTotalHeight = cardHeight + stripHeight;
  // Her sekmenin KENDİ dikey kaydırma konumu — sekme değiştirince (bkz. aşağı)
  // `scrollY` o sekmenin son bilinen konumuna senkronlanıyor; aksi hâlde
  // başlık, önceki sekmede nerede kalmışsa orada donuk kalırdı.
  const pageScrollOffsets = useRef<Record<TabKey, number>>({
    posts: 0,
    saved: 0,
    lists: 0,
    akts: 0,
    schedule: 0,
    follows: 0,
    forums: 0,
  });
  const rememberPageOffset = useCallback((key: TabKey, y: number) => {
    pageScrollOffsets.current[key] = y;
  }, []);

  useEffect(() => {
    scrollY.value = withTiming(pageScrollOffsets.current[activeTab] ?? 0, { duration: 180 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const headerAnimStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -Math.min(scrollY.value, cardHeightShared.value) }],
  }));
  const cardAnimStyle = useAnimatedStyle(() => ({
    opacity: cardHeightShared.value > 0 ? 1 - Math.min(scrollY.value, cardHeightShared.value * 0.7) / (cardHeightShared.value * 0.7) : 1,
  }));

  // İki gönderi sekmesi hem `scrollY`'yi besliyor hem de sonsuz kaydırma
  // eşiğini (bkz. handleScroll) kontrol ediyor; kalan beş sekme yalnızca
  // `scrollY`'yi besliyor. Sekme sayısı sabit (7) olduğu için hook'lar burada
  // döngüsüz, tek tek çağrılıyor.
  const postsScrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
      const distanceToEnd = event.contentSize.height - event.contentOffset.y - event.layoutMeasurement.height;
      if (distanceToEnd <= event.layoutMeasurement.height * 0.5) {
        runOnJS(handleScroll)('posts', event);
      }
    },
    onEndDrag: (event) => runOnJS(rememberPageOffset)('posts', event.contentOffset.y),
    onMomentumEnd: (event) => runOnJS(rememberPageOffset)('posts', event.contentOffset.y),
  });
  const savedScrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
      const distanceToEnd = event.contentSize.height - event.contentOffset.y - event.layoutMeasurement.height;
      if (distanceToEnd <= event.layoutMeasurement.height * 0.5) {
        runOnJS(handleScroll)('saved', event);
      }
    },
    onEndDrag: (event) => runOnJS(rememberPageOffset)('saved', event.contentOffset.y),
    onMomentumEnd: (event) => runOnJS(rememberPageOffset)('saved', event.contentOffset.y),
  });

  // SAYFA PENCERELEME.
  //
  // Pager yatay bir ScrollView ve yedi sayfasının YEDİSİ de mount'luydu: yedi
  // native scroll view + yedi Reanimated scroll worklet, profil ekranda olmasa
  // bile ayakta. Testçilerin "profilde daha çok donuyor" demesinin payı buydu.
  //
  // Artık yalnızca aktif sekme ve İKİ KOMŞUSU gerçek scroll view olarak
  // mount'lu; geri kalanlar yerlerinde `screenWidth` genişliğinde boş bir View
  // tutuyor (pager'ın geometrisi bozulmasın, `scrollTo(idx * screenWidth)`
  // çalışmaya devam etsin diye).
  //
  // ±1 penceresi kasıtlı: `handlePagerScroll` sayfayı YARIYA gelindiğinde
  // değiştiriyor (`Math.round`), yani hedef sayfa siz oraya varmadan ÖNCE
  // zaten mount olmuş oluyor — parmakla kaydırırken boş sayfa görünmüyor.
  //
  // Bir kez mount olan sayfa mount'lu KALIYOR: kaydırma konumu (bkz.
  // `pageScrollOffsets`) ve yüklenmiş verisi korunsun diye.
  //
  // İlk iki sayfa (Postlar, Kayıtlı) bu listede yok — indeksleri 0 ve 1,
  // varsayılan sekme de Postlar olduğu için pencere zaten ikisini de kapsıyor;
  // koşula sokmak sadece gereksiz dallanma olurdu.
  const activeIndex = TABS.findIndex((t) => t.key === activeTab);
  const [mountedTabs, setMountedTabs] = useState<TabKey[]>(() => ['posts', 'saved']);
  useEffect(() => {
    setMountedTabs((prev) => {
      const next = new Set(prev);
      for (let i = activeIndex - 1; i <= activeIndex + 1; i += 1) {
        const k = TABS[i]?.key;
        if (k) next.add(k);
      }
      // Referansı boşuna değiştirme: her kaydırmada yeni dizi = gereksiz render.
      return next.size === prev.length ? prev : Array.from(next);
    });
  }, [activeIndex]);
  const isTabMounted = useCallback((key: TabKey) => mountedTabs.includes(key), [mountedTabs]);

  if (loading) {
    return <ProfileSkeleton />;
  }

  // `headerTotalHeight` kadar dolgu içeriği şeridin TAM altına yapıştırıyordu
  // (ör. Program sekmesindeki "Düzenle" butonu şeride bitişik duruyordu);
  // sekme şeridiyle içerik arasında sabit bir nefes payı bırakılıyor.
  const pageContentStyle = { paddingBottom: TAB_BAR_SAFE_PADDING, paddingTop: headerTotalHeight + 14 };

  // Beş "basit" sekmenin ortak prop kümesi. Hepsi stabil referans olduğu için
  // sekme bileşenlerinin `React.memo`'su iş görüyor: bu ekranda bir modal
  // açılması ya da bir sayacın değişmesi o ağaçlara HİÇ girmiyor.
  const tabProps = {
    width: screenWidth,
    headerHeight: headerTotalHeight,
    scrollY,
    onRememberOffset: rememberPageOffset,
  };

  return (
    <View className="flex-1 bg-ground">
      {/* Pager ÖNCE render ediliyor: başlık katmanı ondan SONRA gelip üstüne
          mutlak konumla biniyor (bkz. aşağı), böylece pager'ın kaydırması
          başlığın altından "akıyor" gibi görünüyor. Her sayfanın üst dolgusu
          (`paddingTop: headerTotalHeight`) sabit — sayfa kendi native
          kaydırmasıyla zaten yukarı akıyor, üstteki katman sadece kart kadar
          (`cardHeight`) yukarı giderek onunla aynı hizada kalıyor; kart
          tamamını kat ettikten sonra şerit ekranın en üstünde sabitleniyor. */}
      <ScrollView
        ref={pagerRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handlePagerScroll}
        onScrollBeginDrag={() => {
          isProgrammaticScrollRef.current = false;
        }}
        onMomentumScrollEnd={handlePagerMomentumEnd}
        scrollEventThrottle={32}
        style={{ flex: 1 }}
      >
        {/* Gönderiler ve Kaydedilenler sekmeleri ARTIK SANALLAŞTIRILMIŞ.
            Eskiden `Animated.ScrollView` içinde düz bir `.map()` vardı: liste
            ne kadar uzunsa o kadar kart aynı anda mount kalıyor, hepsi her
            render'da yeniden çiziliyordu — profilde kaydırma kasmasının ve
            ısınmanın asıl kaynağı buydu. Kayan başlık düzeni aynen korunuyor:
            `onScroll` yine aynı worklet, üst dolgu yine `pageContentStyle`. */}
        <Animated.FlatList
          style={{ width: screenWidth }}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={pageContentStyle}
          onScroll={postsScrollHandler}
          scrollEventThrottle={16}
          data={activeTab === 'posts' ? myPosts : NO_POSTS}
          keyExtractor={postKey}
          renderItem={renderMyPost}
          // `removeClippedSubviews` BİLEREK KAPALI: kartlar dokunulabilir ve bu
          // prop'un ekrandan çıkıp giren satırlarda dokunmayı yutması bilinen
          // bir sorun. Sanallaştırmanın asıl kazancı zaten aşağıdaki üç ayarda.
          removeClippedSubviews={false}
          maxToRenderPerBatch={5}
          windowSize={7}
          initialNumToRender={5}
          ListEmptyComponent={
            activeTab === 'posts' ? <EmptyState icon={FileText} text="Henüz not paylaşmadınız." /> : null
          }
          ListFooterComponent={myPostsLoadingMore ? <TabLoading /> : null}
        />

        <Animated.FlatList
          style={{ width: screenWidth }}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={pageContentStyle}
          onScroll={savedScrollHandler}
          scrollEventThrottle={16}
          data={activeTab === 'saved' && savedPostsData ? savedPostsData : NO_POSTS}
          keyExtractor={postKey}
          renderItem={renderSavedPost}
          removeClippedSubviews={false}
          maxToRenderPerBatch={5}
          windowSize={7}
          initialNumToRender={5}
          ListEmptyComponent={
            activeTab !== 'saved' ? null : savedPostsData === null ? (
              <TabLoading />
            ) : (
              <EmptyState icon={FileText} text="Henüz not kaydetmediniz." />
            )
          }
          ListFooterComponent={savedPostsLoadingMore ? <TabLoading /> : null}
        />

        {isTabMounted('lists') ? (
          <ChecklistsTab active={activeTab === 'lists'} {...tabProps} />
        ) : (
          <PagerPlaceholder width={screenWidth} />
        )}

        {isTabMounted('akts') ? (
          <AktsTab active={activeTab === 'akts'} {...tabProps} />
        ) : (
          <PagerPlaceholder width={screenWidth} />
        )}

        {isTabMounted('schedule') ? (
          <ScheduleTab active={activeTab === 'schedule'} {...tabProps} />
        ) : (
          <PagerPlaceholder width={screenWidth} />
        )}

        {isTabMounted('follows') ? (
          <FollowsTab active={activeTab === 'follows'} {...tabProps} />
        ) : (
          <PagerPlaceholder width={screenWidth} />
        )}

        {isTabMounted('forums') ? (
          <ForumsTab active={activeTab === 'forums'} {...tabProps} />
        ) : (
          <PagerPlaceholder width={screenWidth} />
        )}
      </ScrollView>

      {/* Başlık katmanı: pager'ın ÜSTÜNDE mutlak konumlu. Kart, `cardAnimStyle`
          ile hem kayıyor hem soluyor; şerit hep tam opak ve `headerAnimStyle`
          ile kartla birlikte yukarı gidip kartın yüksekliğinde duruyor —
          böylece ekranın en üstünde "yapışmış" gibi kalıyor. */}
      {/* `collapsable={false}`: bu da arka planı olmayan, yalnızca
          konumlandırma taşıyan bir `box-none` sarmalayıcı — Android'de
          düzleştirilip dokunuş yönlendirmesini kaybedebilir (ayrıntılı
          gerekçe WaveTabBar.tsx'te). Savunma amaçlı. */}
      <Animated.View
        pointerEvents="box-none"
        collapsable={false}
        style={[{ position: 'absolute', top: 0, left: 0, right: 0 }, headerAnimStyle]}
      >
        {/* NativeWind'in `className` derleme dönüşümü yalnızca 'react-native'den
            doğrudan import edilen bileşenleri (View, ScrollView, ...) tanıyor —
            `Animated.View` (reanimated) bu listede değil, üzerine className
            koymak sessizce hiçbir şey yapmaz. Bu yüzden görsel sınıflar (arka
            plan/dolgu/köşe) düz bir `View`de kalıyor; `Animated.View` yalnızca
            saydamlık/kayma animasyonunu taşıyor. */}
        <Animated.View
          onLayout={(e) => {
            const h = e.nativeEvent.layout.height;
            setCardHeight(h);
            cardHeightShared.value = h;
          }}
          style={cardAnimStyle}
        >
          <View className="bg-surface p-4 m-4 mb-5 rounded-lg" style={SHADOW_MD}>
          <View className="flex-row gap-3.5">
            <View className="w-20 h-20">
              <View className="w-20 h-20 rounded-[20px] bg-brand items-center justify-center overflow-hidden">
                {avatar ? <AvatarDisplay avatar={avatar} size={80} /> : <DeerIcon size={32} color="#fff" />}
              </View>
              <Pressable
                className="absolute -bottom-[3px] -right-[3px] w-[22px] h-[22px] rounded-[11px] bg-indigo-600 items-center justify-center"
                onPress={() => setShowAvatarBuilder(true)}
              >
                <Palette size={12} color="#fff" />
              </Pressable>
              <Pressable
                className="absolute -bottom-[3px] -left-[3px] w-[22px] h-[22px] rounded-[11px] bg-brand items-center justify-center"
                onPress={handlePickPhoto}
                disabled={photoUploading}
              >
                {photoUploading ? <ActivityIndicator size="small" color="#fff" /> : <Camera size={12} color="#fff" />}
              </Pressable>
            </View>
            <View className="flex-1">
              <Text className="text-[19px] font-extrabold text-ink">{user?.username}</Text>
              <Text className="text-[13px] text-ink2 mt-0.5">{user?.full_name}</Text>
              <Text className="text-[12.5px] text-muted mt-px">{user?.email}</Text>
              {!!user?.phone && <Text className="text-xs text-muted2 mt-0.5">{user.phone}</Text>}
              {!!user?.department && (
                <Text className="text-xs text-muted2 mt-0.5">
                  {user.department}
                  {user.faculty ? ` · ${user.faculty}` : ''}
                </Text>
              )}
              {!!user?.bio && <Text className="text-[12.5px] text-ink2 mt-1.5 leading-[17px]">{user.bio}</Text>}
            </View>
          </View>

          <View className="flex-row flex-wrap gap-2 mt-3.5">
            {badges.filter((b) => b.is_visible !== false).length === 0 ? (
              <Text className="text-[11.5px] text-muted2">Henüz rozet yok — not paylaşarak rozet kazanabilirsin!</Text>
            ) : (
              badges.filter((b) => b.is_visible !== false).map((badge) => <BadgeChip key={badge.id} badge={badge} />)
            )}
          </View>

          <Pressable
            className="flex-row items-center justify-center gap-1.5 bg-brand rounded-[10px] py-2.5 mt-3.5"
            onPress={() => setShowEditModal(true)}
          >
            <Edit2 size={15} color="#fff" />
            <Text className="text-white text-[13px] font-bold">Düzenle</Text>
          </Pressable>
          </View>
        </Animated.View>

        {/* Sekme şeridi bilinçli olarak kendi kutusunda: altında ince bir çizgi
            ve gölge var ki profil kartından ayrı, kendi başına bir yapı olduğu
            görünsün (kullanıcı isteği). */}
        <View
          onLayout={(e) => setStripHeight(e.nativeEvent.layout.height)}
          className="bg-surface rounded-lg mx-4 mb-5 border-b border-line-soft"
          style={SHADOW_MD}
        >
          <ScrollView
            ref={stripRef}
            showsVerticalScrollIndicator={false}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerClassName="px-3"
            onLayout={(e) => {
              stripWidthRef.current = e.nativeEvent.layout.width;
              centerStripOn(activeTab);
            }}
            onContentSizeChange={(w) => {
              stripContentWidthRef.current = w;
            }}
          >
            {TABS.map(({ key, label, icon: Icon }, index) => {
              // Tembel yüklenen sekmelerde sayaç ancak veri geldiğinde
              // gösteriliyor; aksi hâlde açılışta hepsi yanıltıcı "(0)"
              // görünürdü. ("Kayıtlı" sayacı SavedPostContext'ten geldiği için
              // ilk andan itibaren doğru.)
              // İki gönderi sekmesi artık sayfalı: sayaç "ekranda kaç satır
              // var" değil, sunucudaki TOPLAM — biliniyorsa `total` yazılıyor.
              const count =
                key === 'posts'
                  ? (myPostsTotal ?? myPosts.length)
                  : key === 'saved'
                    ? (savedPostsTotal ?? savedPosts.length)
                    : key === 'lists'
                      ? (checklistsForCount?.length ?? null)
                      : key === 'akts'
                        ? (aktsForCount?.length ?? null)
                        : key === 'schedule'
                          ? (scheduleForCount?.length ?? null)
                          : key === 'follows'
                            ? (followsForCount?.length ?? null)
                            : null;
              const active = activeTab === key;
              return (
                <Pressable
                  key={key}
                  className={`flex-row items-center gap-[5px] py-3 mr-[18px] border-b-2 ${active ? 'border-b-brand' : 'border-b-transparent'}`}
                  onPress={() => handleTabPress(index)}
                  onLayout={(e) => {
                    tabLayoutsRef.current[key] = { x: e.nativeEvent.layout.x, width: e.nativeEvent.layout.width };
                    if (active) centerStripOn(key);
                  }}
                >
                  <Icon size={14} color={active ? (isDark ? '#5A9690' : '#2F5755') : '#9ca3af'} />
                  <Text className={`text-[12.5px] font-semibold ${active ? 'text-accent' : 'text-muted2'}`}>
                    {label}
                    {count !== null ? ` (${count})` : ''}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </Animated.View>

      {/* Checklist istatistik/düzenleme modalları artık ChecklistsTab'ın
          içinde: onları açan state de orada yaşıyor, bir kartı açmak bu ekrana
          hiç ulaşmıyor. */}
      {showEditModal && (
        <ProfileEditModal
          badges={badges}
          onToggleBadgeVisibility={handleToggleBadgeVisibility}
          onClose={() => setShowEditModal(false)}
          onDeleteAccountRequest={() => setShowDeleteModal(true)}
        />
      )}
      {showDeleteModal && <DeleteAccountModal onClose={() => setShowDeleteModal(false)} />}

      <Modal visible={showAvatarBuilder} animationType="slide" onRequestClose={() => setShowAvatarBuilder(false)}>
        {/* RN'in `Modal`ı iOS'ta içeriğini AYRI bir native pencerede sunuyor —
            uygulama kökündeki `SafeAreaProvider` (App.tsx) o pencere için insets'i
            (özellikle notch/Dynamic Island'ın üst boşluğu) doğru ölçemiyor,
            AvatarBuilderScreen içindeki `SafeAreaView edges={['top']}` bu yüzden
            iOS'ta 0'a yakın bir üst boşlukla çiziyordu ("avatar çok üstte
            kalıyor"). Modal'ın kendi `SafeAreaProvider`'ı içeride yeniden
            ölçüm yaptırıyor — bilinen bir react-native-safe-area-context deseni. */}
        <SafeAreaProvider>
          <AvatarBuilderScreen
            initialConfig={avatar?.config || {}}
            isStaff={isStaff}
            onClose={() => setShowAvatarBuilder(false)}
            onSaved={(newCfg) => {
              queryClient.setQueryData(MY_AVATAR_KEY, (prev: AvatarData | null | undefined) => ({
                ...(prev || {}),
                config: newCfg,
              }));
              invalidateMyAvatar();
            }}
          />
        </SafeAreaProvider>
      </Modal>
    </View>
  );
}
