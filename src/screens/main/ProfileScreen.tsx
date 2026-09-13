import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import Animated, {
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { useQueryClient } from '@tanstack/react-query';
import { useDelayedLoading } from '../../hooks/useDelayedLoading';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  Bell,
  BellOff,
  Bookmark,
  Calculator,
  CalendarDays,
  Camera,
  Edit2,
  FileText,
  HelpCircle,
  Lightbulb,
  ListChecks,
  MessagesSquare,
  Palette,
  Trash2,
} from 'lucide-react-native';
import DeerIcon from '../../components/icons/DeerIcon';
import {
  aktsAPI,
  avatarAPI,
  badgeAPI,
  checklistAPI,
  departmentFollowAPI,
  faqAPI,
  postsAPI,
  savedPostsAPI,
  scheduleAPI,
  suggestionAPI,
} from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { useSavedPosts } from '../../context/SavedPostContext';
import PostCard from '../../components/PostCard';

// Gönderi satırları kenardan kenara akıyor (bkz. PostCardModern) — bu iki
// sekmede dış yatay boşluk kaldırılıyor, diğerlerinde duruyor.
const POST_TABS = new Set(['posts', 'saved']);

// "Postlar" ve "Kayıtlı" sekmelerinin sayfa boyu (bkz. postsAPI.getMyPosts /
// savedPostsAPI.getSavedPosts — argüman verilince yanıt zarfa giriyor).
const POST_PAGE_LIMIT = 20;
import BadgeChip, { type Badge } from '../../components/BadgeChip';
import ChecklistCard from '../../components/ChecklistCard';
import ChecklistStatsModal from '../../components/ChecklistStatsModal';
import ChecklistEditModal from '../../components/ChecklistEditModal';
import ProfileEditModal from '../../components/profile/ProfileEditModal';
import DeleteAccountModal from '../../components/profile/DeleteAccountModal';
import AvatarBuilderScreen from './AvatarBuilderScreen';
import { MY_AVATAR_KEY, useInvalidateMyAvatar, useMyAvatar } from '../../hooks/useMyAvatar';
import { FOLLOWED_DEPARTMENTS_KEY } from '../../components/layout/MenuDrawerContent';
import AvatarDisplay from '../../components/avatar/AvatarDisplay';
import type { AvatarData } from '../../components/avatar/AvatarDisplay';
import { isWithinEditWindow, type Checklist, type ChecklistItem } from '../../types/checklist';
import { DAY_NAMES, getCourseColor, toMinutes, type ScheduleCourse } from '../../utils/schedule';
import { formatGpa } from '../../utils/gano';
import type { Post } from '../../types/post';
import { goToTab } from '../../navigation/navigateApp';
import type { MainTabParamList, RootStackParamList } from '../../navigation/types';
import { useTheme, useThemeColors } from '../../context/ThemeContext';
import { TAB_BAR_SAFE_PADDING } from '../../components/layout/tabBarMetrics';
import { useMetrics } from '../../theme/metrics';

interface AktsCalc {
  id: number;
  title: string;
  gpa: number | null;
  updated_at: string;
  data: { semesters: { courses: unknown[] }[] };
}

interface Follow {
  faculty: string;
  department: string;
}

interface ForumItem {
  key: string;
  kind: 'faq' | 'suggestion';
  targetId: number;
  created_at: string;
  title: string;
  body?: string;
}

const TABS = [
  { key: 'posts', label: 'Postlar', icon: FileText },
  { key: 'saved', label: 'Kayıtlı', icon: Bookmark },
  { key: 'lists', label: 'Checklistler', icon: ListChecks },
  { key: 'akts', label: 'AKTS', icon: Calculator },
  { key: 'schedule', label: 'Program', icon: CalendarDays },
  { key: 'follows', label: 'Takip', icon: Bell },
  { key: 'forums', label: 'Forumlar', icon: MessagesSquare },
] as const;

type TabKey = (typeof TABS)[number]['key'];

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' });
}

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

// Tam ekran yükleme durumu artık jenerik bir spinner değil, markanın geyik
// ikonu — hafif bir nabız (opacity) animasyonuyla "yükleniyor" hissi veriyor.
function LoadingDeer() {
  const pulse = useSharedValue(0.4);
  useEffect(() => {
    pulse.value = withRepeat(withTiming(1, { duration: 700 }), -1, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const pulseStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));
  return (
    <Animated.View style={pulseStyle}>
      <DeerIcon size={48} color="#2F5755" />
    </Animated.View>
  );
}

export default function ProfileScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
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

  // Tembel yüklenen sekmeler — `null` = henüz çekilmedi, `[]` = gerçekten boş.
  // Sekmeye ilk kez basıldığında (ya da `initialTab` ile doğrudan açıldığında)
  // aşağıdaki effect'ler çekiyor; sentinel'i tekrar `null`'a çekmek yeniden
  // yüklemeyi tetikliyor.
  const [savedPostsData, setSavedPostsData] = useState<Post[] | null>(null);
  const [myChecklists, setMyChecklists] = useState<Checklist[] | null>(null);
  const [aktsCalcs, setAktsCalcs] = useState<AktsCalc[] | null>(null);
  const [mySchedule, setMySchedule] = useState<ScheduleCourse[] | null>(null);
  const [follows, setFollows] = useState<Follow[] | null>(null);

  const [expandedChecklistId, setExpandedChecklistId] = useState<number | null>(null);
  const [statsChecklist, setStatsChecklist] = useState<Checklist | null>(null);
  const [editChecklist, setEditChecklist] = useState<Checklist | null>(null);

  // Avatar artık burada ayrıca çekilmiyor: üst bar ve tab bar ile aynı
  // react-query anahtarını (`MY_AVATAR_KEY`, bkz. hooks/useMyAvatar.ts)
  // paylaşıyor — böylece açılışta tek bir `avatarAPI.get()` isteği kalıyor.
  const avatar = useMyAvatar();
  const queryClient = useQueryClient();
  // Avatar değişince üst bar ve tab bar da tazelensin.
  const invalidateMyAvatar = useInvalidateMyAvatar();
  const [photoUploading, setPhotoUploading] = useState(false);

  const [forumItems, setForumItems] = useState<ForumItem[] | null>(null);
  const [forumLoading, setForumLoading] = useState(false);

  const [showAvatarBuilder, setShowAvatarBuilder] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // Sekme şeridindeki sayaçlar eskiden yalnızca o sekmeye ilk kez basıldığında
  // doluyordu (tembel yükleme) — kullanıcı "tıklamadan sayılar gösterilmiyor"
  // diye bildirdi. Postlar/rozetler dışındaki dört uç (checklist/AKTS/program/
  // takip) kullanıcının KENDİ verisi — sayfalı büyük bir feed değil, tek
  // seferde tam liste çekmek posts/saved'deki gibi bir backend yükü
  // oluşturmuyor — bu yüzden hepsi artık mount'ta birlikte çekiliyor.
  //
  // "Kayıtlı" sayacı ESKİDEN SavedPostContext'in `/saved-posts/ids` sonucuna
  // (global, uygulama açılışında BİR KEZ çekilen `savedPosts.length`)
  // bakıyordu — kullanıcı "kayıtlı sekmesi 0 gösteriyor" diye bildirdi:
  // context'in tek seferlik sonucu, aynı oturumda başka yerden değişen gerçek
  // veriyle senkron kalmıyordu. Artık diğer sekmeler gibi burada kendi
  // `/saved-posts/getPost` isteğiyle taze çekiliyor, context'e bağımlılık yok.
  // YEDİ İSTEK HÂLÂ MOUNT'TA ATILIYOR — bu bilinçli, yukarıdaki nota bakın
  // (sekme sayaçları tıklamadan dolsun diye). DEĞİŞEN ŞEY: artık hiçbiri
  // ekranın çizilmesini BEKLETMİYOR.
  //
  // Eskiden yedisi tek bir `Promise.allSettled`'da toplanıyor ve `setLoading`
  // hepsi bitince kapanıyordu — yani profil, EN YAVAŞ isteğin süresi kadar
  // tam ekran spinner gösteriyordu. Kullanıcı şikayeti ("profil sayfasının
  // yüklenmesi çok uzun sürüyor") tam olarak buydu: yedi istekten altısının
  // ilk karede hiçbir işi yok, sadece sekme şeridindeki sayıyı yazıyorlar.
  //
  // Artık ekranın ilk karesini YALNIZCA kendi gönderilerin belirliyor; geri
  // kalan altısı ateşlenip kendi cevabı geldiğinde kendi state'ini yazıyor.
  // Sayaçlar yine tıklamadan doluyor, sadece birkaç yüz ms sonra.
  const fetchCore = useCallback(async () => {
    setLoading(true);
    myPostsInFlight.current = true;

    // --- Bekletmeyenler: geldiklerinde kendi state'lerine düşüyorlar --------
    badgeAPI
      .getMine()
      .then((res) => setBadges(res.data.badges || []))
      .catch(() => setBadges([]));
    checklistAPI
      .getMine()
      .then((res) => setMyChecklists(res.data.checklists || []))
      .catch(() => setMyChecklists([]));
    aktsAPI
      .getAll()
      .then((res) => setAktsCalcs(res.data.calculations || []))
      .catch(() => setAktsCalcs([]));
    scheduleAPI
      .getMine()
      .then((res) => setMySchedule(res.data?.courses || []))
      .catch(() => setMySchedule([]));
    departmentFollowAPI
      .getMine()
      .then((res) => setFollows(res.data.follows || []))
      .catch(() => setFollows([]));

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

  useEffect(() => {
    if (activeTab !== 'lists' || myChecklists !== null) return;
    checklistAPI
      .getMine()
      .then((res) => setMyChecklists(res.data.checklists || []))
      .catch(() => setMyChecklists([]));
  }, [activeTab, myChecklists]);

  useEffect(() => {
    if (activeTab !== 'akts' || aktsCalcs !== null) return;
    aktsAPI
      .getAll()
      .then((res) => setAktsCalcs(res.data.calculations || []))
      .catch(() => setAktsCalcs([]));
  }, [activeTab, aktsCalcs]);

  useEffect(() => {
    if (activeTab !== 'schedule' || mySchedule !== null) return;
    scheduleAPI
      .getMine()
      .then((res) => setMySchedule(res.data?.courses || []))
      .catch(() => setMySchedule([]));
  }, [activeTab, mySchedule]);

  useEffect(() => {
    if (activeTab !== 'follows' || follows !== null) return;
    departmentFollowAPI
      .getMine()
      .then((res) => setFollows(res.data.follows || []))
      .catch(() => setFollows([]));
  }, [activeTab, follows]);

  useEffect(() => {
    if (activeTab !== 'forums' || forumItems !== null || !user?.id) return;
    setForumLoading(true);
    Promise.all([
      faqAPI.getUserActivity(user.id).catch(() => ({ data: { activity: [] } })),
      suggestionAPI.getUserActivity(user.id).catch(() => ({ data: { activity: [] } })),
    ]).then(([faqRes, sugRes]) => {
      const faqItems: ForumItem[] = (faqRes.data.activity || []).map((a: any) => ({
        key: `faq-${a.comment_id}`,
        kind: 'faq',
        targetId: a.entry_id,
        created_at: a.created_at,
        title: a.question,
        body: a.comment_content,
      }));
      const sugItems: ForumItem[] = (sugRes.data.activity || []).map((a: any) => ({
        key: `suggestion-${a.type}-${a.comment_id || a.suggestion_id}`,
        kind: 'suggestion',
        targetId: a.suggestion_id,
        created_at: a.created_at,
        title: a.type === 'started' ? 'Yeni öneri paylaştı' : 'Öneriye yorum yaptı',
        body: a.type === 'started' ? a.suggestion_content : a.comment_content,
      }));
      const merged = [...faqItems, ...sugItems].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setForumItems(merged);
      setForumLoading(false);
    });
  }, [activeTab, forumItems, user?.id]);

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

  const handleChecklistItemToggle = async (checklistId: number, item: ChecklistItem) => {
    const newChecked = !item.checked;
    setMyChecklists((prev) =>
      prev
        ? prev.map((c) =>
            c.id === checklistId ? { ...c, items: c.items.map((i) => (i.id === item.id ? { ...i, checked: newChecked } : i)) } : c
          )
        : prev
    );
    try {
      await checklistAPI.setItemState(item.id, newChecked);
    } catch {
      Alert.alert('Hata', 'Kaydedilemedi, tekrar deneyin.');
    }
  };

  const handleAktsDelete = (id: number) => {
    Alert.alert('Hesaplamayı sil', 'Bu hesaplamayı silmek istediğinize emin misiniz?', [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: async () => {
          try {
            await aktsAPI.delete(id);
            setAktsCalcs((prev) => (prev ? prev.filter((c) => c.id !== id) : prev));
          } catch {
            Alert.alert('Hata', 'Silinemedi.');
          }
        },
      },
    ]);
  };

  const handleUnfollow = async (faculty: string, department: string) => {
    setFollows((prev) => (prev ? prev.filter((f) => !(f.faculty === faculty && f.department === department)) : prev));
    try {
      await departmentFollowAPI.unfollow(faculty, department);
      // Menüdeki liste 5 dk cache'li (bkz. MenuDrawerContent) — tazelensin.
      queryClient.invalidateQueries({ queryKey: FOLLOWED_DEPARTMENTS_KEY });
    } catch {
      // Sunucu reddettiyse listeyi yeniden çektirmek için sentinel'i sıfırla.
      setFollows(null);
      Alert.alert('Hata', 'İşlem başarısız.');
    }
  };

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
  const listsScrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
    onEndDrag: (event) => runOnJS(rememberPageOffset)('lists', event.contentOffset.y),
    onMomentumEnd: (event) => runOnJS(rememberPageOffset)('lists', event.contentOffset.y),
  });
  const aktsScrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
    onEndDrag: (event) => runOnJS(rememberPageOffset)('akts', event.contentOffset.y),
    onMomentumEnd: (event) => runOnJS(rememberPageOffset)('akts', event.contentOffset.y),
  });
  const scheduleScrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
    onEndDrag: (event) => runOnJS(rememberPageOffset)('schedule', event.contentOffset.y),
    onMomentumEnd: (event) => runOnJS(rememberPageOffset)('schedule', event.contentOffset.y),
  });
  const followsScrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
    onEndDrag: (event) => runOnJS(rememberPageOffset)('follows', event.contentOffset.y),
    onMomentumEnd: (event) => runOnJS(rememberPageOffset)('follows', event.contentOffset.y),
  });
  const forumsScrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
    onEndDrag: (event) => runOnJS(rememberPageOffset)('forums', event.contentOffset.y),
    onMomentumEnd: (event) => runOnJS(rememberPageOffset)('forums', event.contentOffset.y),
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
    return (
      <View className="flex-1 items-center justify-center">
        <LoadingDeer />
      </View>
    );
  }

  // `headerTotalHeight` kadar dolgu içeriği şeridin TAM altına yapıştırıyordu
  // (ör. Program sekmesindeki "Düzenle" butonu şeride bitişik duruyordu);
  // sekme şeridiyle içerik arasında sabit bir nefes payı bırakılıyor.
  const pageContentStyle = { paddingBottom: TAB_BAR_SAFE_PADDING, paddingTop: headerTotalHeight + 14 };
  // NativeWind'in `className` derleme-zamanı dönüşümü yalnızca 'react-native'
  // içinden doğrudan import edilen bileşenleri tanıyor — `Animated.ScrollView`
  // (react-native-reanimated) bu listede değil, `contentContainerClassName`
  // burada sessizce hiçbir şey yapmazdı. Aynı "px-4 gap-2.5" değerleri (16px
  // yatay dolgu, 10px boşluk) doğrudan style olarak veriliyor.
  const paddedPageContentStyle = { ...pageContentStyle, paddingHorizontal: 16, gap: 10 };

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
        <Animated.ScrollView
          style={{ width: screenWidth }}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={paddedPageContentStyle}
          onScroll={listsScrollHandler}
          scrollEventThrottle={32}
        >
          {activeTab === 'lists' &&
            (myChecklists === null ? (
              <TabLoading />
            ) : myChecklists.length === 0 ? (
              <EmptyState
                icon={ListChecks}
                text="Henüz bir checklist oluşturmadın."
                actionLabel="Checklistlere Git"
                onAction={() => navigation.navigate('Checklists')}
              />
            ) : (
              myChecklists.map((checklist) => (
                <ChecklistCard
                  key={checklist.id}
                  checklist={checklist}
                  isOpen={expandedChecklistId === checklist.id}
                  onToggleOpen={(c) => setExpandedChecklistId((prev) => (prev === c.id ? null : c.id))}
                  onToggleItem={handleChecklistItemToggle}
                  onStatsClick={setStatsChecklist}
                  onEditClick={setEditChecklist}
                  canEdit={isWithinEditWindow(checklist)}
                />
              ))
            ))}
        </Animated.ScrollView>
        ) : (
          <View style={{ width: screenWidth }} />
        )}

        {isTabMounted('akts') ? (
        <Animated.ScrollView
          style={{ width: screenWidth }}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={paddedPageContentStyle}
          onScroll={aktsScrollHandler}
          scrollEventThrottle={32}
        >
          {activeTab === 'akts' &&
            (aktsCalcs === null ? (
              <TabLoading />
            ) : aktsCalcs.length === 0 ? (
              <EmptyState
                icon={Calculator}
                text="Henüz kayıtlı AKTS hesaplaman yok."
                actionLabel="Hesaplayıcıya Git"
                onAction={() => navigation.navigate('AktsCalculator')}
              />
            ) : (
              aktsCalcs.map((calc) => {
                const semesterCount = calc.data?.semesters?.length || 0;
                const courseCount = calc.data?.semesters?.reduce((sum, s) => sum + (s.courses?.length || 0), 0) || 0;
                return (
                  <View key={calc.id} className="flex-row items-center bg-surface rounded-lg p-3.5 mb-3" style={SHADOW_SM}>
                    <View className="flex-1">
                      <Text className="text-sm font-bold text-ink" numberOfLines={1}>
                        {calc.title}
                      </Text>
                      <Text className="text-[11.5px] text-muted2 mt-0.5">
                        {semesterCount} dönem · {courseCount} ders · {formatDate(calc.updated_at)}
                      </Text>
                    </View>
                    <View className="items-center mr-2.5">
                      <Text className="text-lg font-extrabold text-accent">{formatGpa(calc.gpa)}</Text>
                      <Text className="text-xs text-muted2 uppercase">GANO</Text>
                    </View>
                    <Pressable
                      className="bg-brand rounded-lg px-2.5 py-[7px]"
                      onPress={() => navigation.navigate('AktsCalculator', { loadId: calc.id })}
                    >
                      <Text className="text-white text-xs font-bold">Düzenle</Text>
                    </Pressable>
                    <Pressable onPress={() => handleAktsDelete(calc.id)} hitSlop={8} className="ml-2">
                      <Trash2 size={17} color="#dc2626" />
                    </Pressable>
                  </View>
                );
              })
            ))}
        </Animated.ScrollView>
        ) : (
          <View style={{ width: screenWidth }} />
        )}

        {isTabMounted('schedule') ? (
        <Animated.ScrollView
          style={{ width: screenWidth }}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={paddedPageContentStyle}
          onScroll={scheduleScrollHandler}
          scrollEventThrottle={32}
        >
          {activeTab === 'schedule' &&
            (mySchedule === null ? (
              <TabLoading />
            ) : mySchedule.length === 0 ? (
              <EmptyState
                icon={CalendarDays}
                text="Henüz ders programı oluşturmadın."
                actionLabel="Ders Programı Oluştur"
                onAction={() => navigation.navigate('Schedule')}
              />
            ) : (
              <View>
                <Pressable
                  className="flex-row self-end items-center gap-1.5 bg-brand rounded-lg px-3 py-2 mb-2.5"
                  onPress={() => navigation.navigate('Schedule')}
                >
                  <Edit2 size={13} color="#fff" />
                  <Text className="text-white text-xs font-bold">Düzenle</Text>
                </Pressable>
                {[1, 2, 3, 4, 5, 6].map((day) => {
                  const dayCourses = mySchedule.filter((c) => c.day === day).sort((a, b) => toMinutes(a.start) - toMinutes(b.start));
                  if (dayCourses.length === 0) return null;
                  return (
                    <View key={day} className="bg-surface rounded-lg p-3.5 mb-3" style={SHADOW_SM}>
                      <Text className="text-[13px] font-bold text-ink mb-2">{DAY_NAMES[day]}</Text>
                      {dayCourses.map((c) => (
                        <View key={c.id} className="flex-row items-center gap-2 py-1.5">
                          <View className="w-1 h-[26px] rounded-sm" style={{ backgroundColor: getCourseColor(c.colorIdx).hex }} />
                          <View className="flex-1">
                            <Text className="text-[12.5px] font-semibold text-ink" numberOfLines={1}>
                              {c.name}
                            </Text>
                            <Text className="text-[11px] text-muted mt-px">
                              {c.start}–{c.end}
                              {c.location ? ` · ${c.location}` : ''}
                            </Text>
                          </View>
                        </View>
                      ))}
                    </View>
                  );
                })}
              </View>
            ))}
        </Animated.ScrollView>
        ) : (
          <View style={{ width: screenWidth }} />
        )}

        {isTabMounted('follows') ? (
        <Animated.ScrollView
          style={{ width: screenWidth }}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={paddedPageContentStyle}
          onScroll={followsScrollHandler}
          scrollEventThrottle={32}
        >
          {activeTab === 'follows' &&
            (follows === null ? (
              <TabLoading />
            ) : follows.length === 0 ? (
              <EmptyState
                icon={Bell}
                text='Henüz bölüm takip etmiyorsun. Bölüm sayfasındaki "Takip Et" butonuyla haberdar olabilirsin.'
                actionLabel="Bölümlere Göz At"
                onAction={() => goToTab(navigation, 'Departments')}
              />
            ) : (
              follows.map((f) => (
                <View
                  key={`${f.faculty}-${f.department}`}
                  className="flex-row items-center bg-surface rounded-lg p-3.5 mb-3"
                  style={SHADOW_SM}
                >
                  <Pressable
                    className="flex-1"
                    onPress={() => navigation.navigate('DepartmentDetail', { faculty: f.faculty, department: f.department })}
                  >
                    <Text className="text-sm font-bold text-ink" numberOfLines={1}>
                      {f.department}
                    </Text>
                    <Text className="text-[11.5px] text-muted2 mt-0.5">{f.faculty}</Text>
                  </Pressable>
                  <Pressable
                    className="flex-row items-center gap-[5px] border border-line rounded-lg px-2.5 py-[7px]"
                    onPress={() => handleUnfollow(f.faculty, f.department)}
                  >
                    <BellOff size={13} color={isDark ? '#9ca3af' : '#6b7280'} />
                    <Text className="text-[11.5px] text-muted font-semibold">Bırak</Text>
                  </Pressable>
                </View>
              ))
            ))}
        </Animated.ScrollView>
        ) : (
          <View style={{ width: screenWidth }} />
        )}

        {isTabMounted('forums') ? (
        <Animated.ScrollView
          style={{ width: screenWidth }}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={paddedPageContentStyle}
          onScroll={forumsScrollHandler}
          scrollEventThrottle={32}
        >
          {activeTab === 'forums' &&
            (forumLoading || forumItems === null ? (
              <TabLoading />
            ) : forumItems.length === 0 ? (
              <EmptyState icon={MessagesSquare} text="Henüz bir foruma katılmadı." />
            ) : (
              forumItems.map((item) => (
                <Pressable
                  key={item.key}
                  className="flex-row gap-2 bg-surface rounded-lg p-3.5 mb-3"
                  style={SHADOW_SM}
                  onPress={() =>
                    item.kind === 'faq'
                      ? navigation.navigate('FaqDetail', { id: item.targetId })
                      : navigation.navigate('SuggestionDetail', { id: item.targetId })
                  }
                >
                  {item.kind === 'faq' ? (
                    <HelpCircle size={15} color={isDark ? '#5A9690' : '#2F5755'} />
                  ) : (
                    <Lightbulb size={15} color={isDark ? '#5A9690' : '#2F5755'} />
                  )}
                  <View className="flex-1">
                    <Text className="text-[11.5px] font-semibold text-muted">{item.title}</Text>
                    {!!item.body && (
                      <Text className="text-sm text-ink2 mt-[3px]" numberOfLines={2}>
                        {item.body}
                      </Text>
                    )}
                    <Text className="text-[10.5px] text-muted2 mt-1">{formatDate(item.created_at)}</Text>
                  </View>
                </Pressable>
              ))
            ))}
        </Animated.ScrollView>
        ) : (
          <View style={{ width: screenWidth }} />
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
                      ? (myChecklists?.length ?? null)
                      : key === 'akts'
                        ? (aktsCalcs?.length ?? null)
                        : key === 'schedule'
                          ? (mySchedule?.length ?? null)
                          : key === 'follows'
                            ? (follows?.length ?? null)
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

      {statsChecklist && <ChecklistStatsModal checklist={statsChecklist} onClose={() => setStatsChecklist(null)} />}
      {editChecklist && (
        <ChecklistEditModal
          checklist={editChecklist}
          onClose={() => setEditChecklist(null)}
          // Sentinel'i `null`'a çekmek yeniden yüklemeyi tetikliyor (bkz.
          // tembel yükleme effect'leri) — düzenleme/silme sonrası liste
          // sekmede kalınarak tazeleniyor.
          onSaved={() => setMyChecklists(null)}
        />
      )}

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

// Sekme verisi ilk kez (ya da bir mutasyondan sonra yeniden) çekilirken
// gösteriliyor — "henüz kaydın yok" metinleri yükleme bitmeden görünmesin diye.
function TabLoading() {
  const colors = useThemeColors();
  return <ActivityIndicator style={{ marginTop: 24 }} color={colors.accent} />;
}

function EmptyState({ icon: Icon, text, actionLabel, onAction }: { icon: any; text: string; actionLabel?: string; onAction?: () => void }) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  return (
    <View className="items-center py-[50px] gap-2.5">
      <Icon size={40} color={isDark ? '#6b7280' : '#d1d5db'} />
      <Text className="text-muted2 text-[13.5px] text-center px-[30px]">{text}</Text>
      {!!actionLabel && (
        <Pressable className="bg-brand rounded-[10px] px-[18px] py-2.5 mt-1" onPress={onAction}>
          <Text className="text-white text-[13px] font-bold">{actionLabel}</Text>
        </Pressable>
      )}
    </View>
  );
}

const SHADOW_MD = {
  shadowColor: '#000',
  shadowOpacity: 0.1,
  shadowRadius: 8,
  shadowOffset: { width: 0, height: 3 },
  elevation: 3,
};

const SHADOW_SM = {
  shadowColor: '#000',
  shadowOpacity: 0.06,
  shadowRadius: 6,
  shadowOffset: { width: 0, height: 2 },
  elevation: 2,
};
