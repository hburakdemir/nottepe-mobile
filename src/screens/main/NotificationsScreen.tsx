import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Linking, ListRenderItem, Pressable, Text, View } from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import {
  Bell,
  BookOpen,
  Calendar,
  CheckCircle,
  ExternalLink,
  Megaphone,
  MessageSquare,
  Settings,
  Tag,
  User,
  MailOpen,
  Trash2,
} from 'lucide-react-native';
import { notificationAPI, userNotificationAPI } from '../../lib/api';
import type { RootStackParamList } from '../../navigation/types';
import { useTheme } from '../../context/ThemeContext';
import SwipeActions from '../../components/layout/SwipeActions';
import NotificationSettingsSheet from '../../components/notifications/NotificationSettingsSheet';
import { useNotificationPrefs } from '../../lib/notificationPrefs';
import { setNotificationsScreenFocused } from '../../lib/push/pushState';
import { useInvalidateUnreadNotifications, useMarkNotificationsRead } from '../../hooks/useUnreadNotifications';
import { useInvalidateUnreadAnnouncements } from '../../hooks/useUnreadAnnouncements';
import { useNotificationCategories } from '../../hooks/useNotificationCategories';
import { Skeleton, SkeletonGroup } from '../../components/Skeleton';

// Admin bağlantıyı şemasız girebiliyor ("nottepe.com", "www...") — `Linking.openURL`
// şemasız bir URL'i REDDEDİYOR (native tarafta sessizce hiçbir şey olmuyormuş gibi
// görünüyordu, "daha fazla bilgi çalışmıyor" şikayeti buradan geliyordu).
function normalizeExternalUrl(raw: string): string {
  const trimmed = raw.trim();
  return /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(trimmed) ? trimmed : `https://${trimmed}`;
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('tr-TR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

interface Announcement {
  id: number;
  title: string;
  content: string;
  link?: string | null;
  category_name?: string;
  is_viewed?: boolean;
  viewed_at?: string | null;
  creator_full_name?: string | null;
  creator_role?: string | null;
  created_at: string;
}

function formatDateTime(dateString: string): string {
  return new Date(dateString).toLocaleDateString('tr-TR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Aktivite listesi sayfalı çekiliyor (bkz. userNotificationAPI.getAll).
const ACTIVITY_PAGE_LIMIT = 30;
// "Geri al" şeridinin ekranda kalma süresi.
const UNDO_TIMEOUT_MS = 4000;

const ACTIVITY_TYPE_META: Record<string, { icon: any; label: (n: any) => string }> = {
  comment_on_post: {
    icon: MessageSquare,
    label: (n) => `${n.actor_full_name || n.actor_username || 'Bir kullanıcı'} "${n.post_title || 'postun'}" gönderine yorum yaptı.`,
  },
  dept_new_post: {
    icon: BookOpen,
    label: (n) => `Takip ettiğin bölümde yeni not paylaşıldı: ${n.post_title || 'yeni not'}`,
  },
  post_approved: {
    icon: CheckCircle,
    label: (n) => `Paylaştığın not onaylandı: ${n.post_title || 'notun'}`,
  },
  request_fulfilled: {
    icon: CheckCircle,
    label: (n) =>
      `Not isteğin karşılandı: ${n.post_title || 'karşılanan not'}${
        n.actor_username ? ` — ${n.actor_full_name || n.actor_username} tarafından` : ''
      }`,
  },
  supported_req_fulfilled: {
    icon: CheckCircle,
    label: (n) =>
      `"+1" verdiğin not isteği karşılandı: ${n.post_title || 'karşılanan not'}${
        n.actor_username ? ` — ${n.actor_full_name || n.actor_username} tarafından` : ''
      }`,
  },
  comment_reply: {
    icon: MessageSquare,
    label: (n) =>
      `${n.actor_full_name || n.actor_username || 'Bir kullanıcı'} yorumuna yanıt verdi${
        n.faq_question ? `: ${n.faq_question}` : n.suggestion_content ? ' (öneri)' : ''
      }`,
  },
};

// `unread`: kaydırma menüsündeki "Okunmadı" aksiyonunun YEREL karşılığı
// (bkz. lib/notificationPrefs.ts). Rozet eskiden yalnız sunucudaki
// `is_viewed`'a bakıyordu, o yüzden aksiyonun hiçbir görsel karşılığı yoktu;
// artık ikisi birleşiyor — Aktivite sekmesindeki `ActivityCard` ile aynı desen.
function AnnouncementCard({ notif, unread }: { notif: Announcement; unread?: boolean }) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  // Kullanıcı elle "okunmadı" dediyse sunucu görüntülenmiş saysa bile kart
  // yeniden "Yeni" görünüyor: yerel tercih sunucuyu geçersiz kılıyor.
  const isViewed = !!notif.is_viewed && !unread;
  return (
    <View className="bg-surface rounded-xl p-3.5 mb-2.5">
      <View className="flex-row items-center flex-wrap gap-1.5 mb-2">
        <View className={`px-2 py-[3px] rounded-full ${isViewed ? 'bg-inset' : 'bg-brand'}`}>
          <Text className={`text-[10.5px] font-semibold ${isViewed ? 'text-muted' : 'text-white'}`}>
            {isViewed ? `Görüntüleme Tarihi${notif.viewed_at ? ` · ${formatDateTime(notif.viewed_at)}` : ''}` : 'Yeni'}
          </Text>
        </View>
        {!!notif.category_name && (
          <View className="flex-row items-center gap-1 bg-brand-light rounded-full px-2 py-[3px]">
            <Tag size={11} color="#fff" />
            <Text className="text-[10.5px] font-semibold text-white">{notif.category_name}</Text>
          </View>
        )}
        {!!notif.creator_full_name && (
          <View className="flex-row items-center gap-1 bg-inset rounded-full px-2 py-[3px]">
            <User size={11} color={isDark ? '#9ca3af' : '#4b5563'} />
            <Text className="text-[10.5px] font-semibold text-muted">{notif.creator_full_name}</Text>
            {!!notif.creator_role && (
              <View className={`rounded ml-0.5 px-1 ${notif.creator_role === 'admin' ? 'bg-blue-900' : 'bg-accent-soft'}`}>
                <Text className={`text-[9px] font-bold ${notif.creator_role === 'admin' ? 'text-yellow-300' : 'text-info'}`}>
                  {notif.creator_role}
                </Text>
              </View>
            )}
          </View>
        )}
        <View className="flex-row items-center gap-1 ml-auto">
          <Calendar size={11} color={isDark ? '#6b7280' : '#9ca3af'} />
          <Text className="text-[11px] text-muted2">Duyuru Tarihi: {formatDate(notif.created_at)}</Text>
        </View>
      </View>
      <Text className="text-[15.5px] font-bold text-ink mb-1.5">{notif.title}</Text>
      <Text className="text-[13.5px] text-muted leading-[19px]">{notif.content}</Text>
      {!!notif.link && (
        <Pressable
          className="flex-row items-center gap-1.5 mt-2.5"
          onPress={() => Linking.openURL(normalizeExternalUrl(notif.link!)).catch(() => {})}
        >
          <ExternalLink size={14} color={isDark ? '#60a5fa' : '#1d4ed8'} />
          <Text className="text-[13px] text-info font-semibold">Daha fazla bilgi</Text>
        </Pressable>
      )}
    </View>
  );
}

// Filtre çipi (Tümü + kategoriler). Ayrı bileşen olmasının iki sebebi var:
// (1) dokunma alanı tek yerde büyütülüyor — çipin kendisi `py-1.5` ile 24-26px
// yüksekliğinde, parmak payı olmadan gerçek cihazda ıskalanabiliyor;
// (2) basılıyken sönükleşme (`active:opacity-60`) tüm çiplerde aynı.
function FilterChip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
      onPress={onPress}
      className={`rounded-full px-3 py-1.5 border active:opacity-60 ${
        selected ? 'bg-brand border-brand' : 'bg-surface border-line'
      }`}
    >
      <Text className={`text-xs font-medium ${selected ? 'text-white' : 'text-muted'}`}>{label}</Text>
    </Pressable>
  );
}

// Bildirim/aktivite satırının iskeleti — `ActivityCard` ile aynı ölçüler
// (34px ikon yuvası, 13.5px iki satır metin, 11px tarih). Eskiden burada tek
// bir çark dönüyordu: liste gelince ekran boş ortadan dolu listeye zıplıyordu.
function NotificationRowsSkeleton() {
  return (
    <SkeletonGroup>
      <View className="mt-1">
        {([
          ['100%', '62%'],
          ['94%'],
          ['100%', '48%'],
          ['88%'],
          ['100%', '70%'],
          ['92%'],
        ] as const).map((lines, i) => (
          <View key={i} className="flex-row items-start gap-2.5 bg-surface rounded-xl p-3 mb-2.5">
            <Skeleton width={34} height={34} radius={17} />
            <View className="flex-1 gap-1.5">
              {lines.map((w, j) => (
                <Skeleton key={j} height={13} style={{ width: w }} />
              ))}
              <Skeleton width={72} height={11} />
            </View>
          </View>
        ))}
      </View>
    </SkeletonGroup>
  );
}

function ActivityCard({ notif, unread }: { notif: any; unread: boolean }) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const meta = ACTIVITY_TYPE_META[notif.type];
  const Icon = meta?.icon || Bell;
  const label = meta ? meta.label(notif) : 'Yeni aktivite bildirimi';
  const canNavigate = !!notif.post_id || !!notif.faq_entry_id || !!notif.suggestion_id;

  const handlePress = () => {
    if (notif.post_id) navigation.navigate('PostDetail', { postId: notif.post_id });
    else if (notif.faq_entry_id) navigation.navigate('FaqDetail', { id: notif.faq_entry_id });
    else if (notif.suggestion_id) navigation.navigate('SuggestionDetail', { id: notif.suggestion_id });
  };

  return (
    <Pressable className="flex-row items-start gap-2.5 bg-surface rounded-xl p-3 mb-2.5" disabled={!canNavigate} onPress={handlePress}>
      <View className="w-[34px] h-[34px] rounded-[17px] bg-accent-soft items-center justify-center">
        <Icon size={16} color={isDark ? '#5A9690' : '#2F5755'} />
      </View>
      <View className="flex-1">
        <Text className="text-[13.5px] text-ink2 leading-[19px]">{label}</Text>
        <Text className="text-[11px] text-muted2">{formatDate(notif.created_at)}</Text>
      </View>
      {unread && <View className="w-2 h-2 rounded-full bg-brand mt-1.5" />}
    </Pressable>
  );
}

export default function NotificationsScreen() {
  const route = useRoute<RouteProp<RootStackParamList, 'Notifications'>>();
  const { theme, colors } = useTheme();
  const isDark = theme === 'dark';
  const [tab, setTab] = useState<'duyurular' | 'aktivite'>(route.params?.initialTab ?? 'duyurular');
  const [showSettings, setShowSettings] = useState(false);

  // Rozet çift sayımı kancası (plan 3.5/5): bu ekran Aktivite sekmesine girince
  // her şeyi okundu yapıyor. Ekran odaktayken bir push gelirse rozeti artırmak
  // yanlış olurdu — kullanıcı zaten listeye bakıyor. Push tarafı bu bayrağa
  // bakıp artırmayı atlıyor, yalnızca listeyi tazeliyor.
  useFocusEffect(
    useCallback(() => {
      setNotificationsScreenFocused(true);
      return () => setNotificationsScreenFocused(false);
    }, [])
  );

  // Kategoriler react-query'de uzun `staleTime` ile duruyor; ekran her
  // açıldığında yeniden çekilmiyor.
  const categories = useNotificationCategories();
  const [activeCategory, setActiveCategory] = useState('');
  // KÖK NEDEN ("Tümü butonu tıklanmıyor"): `activeCategory`'nin BAŞLANGIÇ
  // değeri zaten `''`, yani "Tümü" varsayılan olarak seçili. `setActiveCategory('')`
  // aynı değeri yazdığı için React state'i değişmiş saymıyor: ne aşağıdaki
  // efekt tetikleniyor, ne çipin görünümü değişiyor — kullanıcı basıyor,
  // EKRANDA HİÇBİR ŞEY OLMUYOR ve bunu "buton çalışmıyor" diye tarif ediyor.
  // (Önceki düzeltme çipi görünür kılmıştı, ama tepkisizliği gidermemişti.)
  // Bu sayaç her basışta artıyor ve efektin bağımlılığında: aynı kategoriye
  // basmak bile artık gerçek bir yeniden çekme + görünür yükleniyor göstergesi
  // demek.
  const [categoryReloadKey, setCategoryReloadKey] = useState(0);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loadingAnnouncements, setLoadingAnnouncements] = useState(true);
  const showAnnouncementSkeleton = loadingAnnouncements;

  const handleSelectCategory = useCallback((slug: string) => {
    setActiveCategory(slug);
    setCategoryReloadKey((k) => k + 1);
  }, []);

  const [activity, setActivity] = useState<any[]>([]);
  const [activityLoading, setActivityLoading] = useState(true);
  const showActivitySkeleton = activityLoading;
  const [activityLoaded, setActivityLoaded] = useState(false);
  const [activityPage, setActivityPage] = useState(1);
  const [activityLoadingMore, setActivityLoadingMore] = useState(false);
  const [activityHasMore, setActivityHasMore] = useState(true);
  // İstek uçuştayken ikinci isteği engelleyen kapı. `state` değil `ref`:
  // `onEndReached` hızlı kaydırmada aynı render içinde birden çok kez
  // tetiklenebiliyor, state güncellemesi o ana yetişmiyor.
  const activityInFlight = useRef(false);
  const prefs = useNotificationPrefs();
  const markNotificationsRead = useMarkNotificationsRead();
  const invalidateAnnouncementsUnread = useInvalidateUnreadAnnouncements();
  const invalidateActivityUnread = useInvalidateUnreadNotifications();

  // Silinen son satırın id'si + türü — "Geri al" şeridi bunu hedefliyor.
  const [undoTarget, setUndoTarget] = useState<{ id: string; kind: 'announcement' | 'activity' } | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setLoadingAnnouncements(true);
    notificationAPI
      .getAll(activeCategory)
      .then((res) => setAnnouncements(res.data || []))
      .catch(() => setAnnouncements([]))
      .finally(() => setLoadingAnnouncements(false));
    // `categoryReloadKey` bilerek bağımlılıkta: aynı çipe (ör. zaten seçili
    // olan "Tümü") basmak da gerçek bir yeniden çekme tetiklesin diye.
  }, [activeCategory, categoryReloadKey]);

  // Sunucuda duyurular için toplu "okundu yap" ucu yok — tekil `POST
  // /notifications/:id/view` var (bkz. lib/api.ts notificationAPI.markViewed).
  // Aynı id için üst üste isteği engelliyor: aksi hâlde art arda gelen
  // render'larda (aşağıdaki efekt + kaydırma aksiyonu) aynı id ikinci kez
  // uçuşa çıkabilir.
  const viewingAnnouncementIds = useRef<Set<string>>(new Set());
  const markAnnouncementViewed = useCallback(
    (id: string | number) => {
      const key = String(id);
      if (viewingAnnouncementIds.current.has(key)) return;
      viewingAnnouncementIds.current.add(key);
      notificationAPI
        .markViewed(id)
        .catch(() => {})
        .finally(() => viewingAnnouncementIds.current.delete(key));
      const now = new Date().toISOString();
      setAnnouncements((prev) =>
        prev.map((a) => (String(a.id) === key ? { ...a, is_viewed: true, viewed_at: a.viewed_at ?? now } : a))
      );
      // Kullanıcı elle "okunmadı" demişse o tercih baskın kalsın istemiyoruz:
      // "okundu" artık gerçek (sunucu) bir aksiyon, yerel geçersiz kılmayı temizliyor.
      prefs.markRead('announcement', id);
      invalidateAnnouncementsUnread();
    },
    [prefs.markRead, invalidateAnnouncementsUnread]
  );

  // Kullanıcı isteği: Duyurular sekmesine girilince listedeki görüntülenmemiş
  // duyurular otomatik okundu sayılmalı (Aktivite sekmesindeki "girince hepsi
  // okundu" deseniyle aynı — bkz. fetchActivity). `announcements` her
  // `markAnnouncementViewed` çağrısından sonra `is_viewed: true` ile
  // güncellendiği için bu efekt kendi kendini söndürüyor (bir sonraki
  // çalışmada `unviewed` boş çıkıyor), sonsuz döngü olmuyor.
  useEffect(() => {
    if (tab !== 'duyurular' || loadingAnnouncements) return;
    const unviewed = announcements.filter((a) => !a.is_viewed);
    unviewed.forEach((a) => markAnnouncementViewed(a.id));
  }, [tab, loadingAnnouncements, announcements, markAnnouncementViewed]);

  // Aktivite listesi sayfa sayfa çekiliyor (desen: FaqScreen). Eskiden tek
  // seferde `limit: 30` isteniyordu, yani 30'dan eski hiçbir bildirim ekranda
  // görünmüyordu.
  //
  // Ekrana girildiği anda bildirimler okundu sayılıyor (kullanıcı isteği).
  // Eskiden `markAllRead` çağrılıyordu ama YEREL satırların `read_at`'i eski
  // kaldığı için mavi noktalar ekranda duruyordu ve üstteki zil rozeti bir
  // sonraki açılışa kadar güncellenmiyordu. Artık üçü birlikte oluyor:
  // sunucu + yerel liste + rozet (react-query anahtarı). Bu yalnızca İLK
  // sayfada yapılıyor: sonraki sayfalar zaten okunmuş sayılan eski kayıtlar.
  const fetchActivity = useCallback(
    async (targetPage: number, reset = false) => {
      if (activityInFlight.current) return;
      activityInFlight.current = true;
      if (reset) setActivityLoading(true);
      else setActivityLoadingMore(true);
      try {
        const res = await userNotificationAPI.getAll({ page: targetPage, limit: ACTIVITY_PAGE_LIMIT });
        const rows = res.data.notifications || [];
        const now = new Date().toISOString();
        const mapped = rows.map((n: any) => ({ ...n, read_at: n.read_at ?? now }));
        setActivity((prev) => (reset ? mapped : [...prev, ...mapped]));
        setActivityPage(targetPage);
        // Uç toplam sayı döndürmüyor; dolu sayfadan az geldiyse son sayfadayız.
        setActivityHasMore(rows.length >= ACTIVITY_PAGE_LIMIT);
        if (reset) {
          setActivityLoaded(true);
          userNotificationAPI
            .markAllRead()
            .catch(() => {})
            .finally(() => markNotificationsRead());
        }
      } catch {
        // İlk sayfa patlarsa liste boşalıyor; "daha fazla" patlarsa eldeki
        // satırlar duruyor ve kullanıcı tekrar kaydırınca yeniden denenebiliyor.
        if (reset) setActivity([]);
      } finally {
        activityInFlight.current = false;
        setActivityLoading(false);
        setActivityLoadingMore(false);
      }
    },
    [markNotificationsRead]
  );

  useEffect(() => {
    if (tab !== 'aktivite' || activityLoaded) return;
    fetchActivity(1, true);
  }, [tab, activityLoaded, fetchActivity]);

  const handleActivityEndReached = useCallback(() => {
    // Liste boşken (ilk render / hata sonrası) ve son sayfa geldiğinde istek yok.
    if (!activityHasMore || activityLoading || activityLoadingMore) return;
    if (activity.length === 0) return;
    fetchActivity(activityPage + 1);
  }, [activityHasMore, activityLoading, activityLoadingMore, activity.length, activityPage, fetchActivity]);

  // Silinenler listeden düşüyor (cihazda saklanıyor, bkz. lib/notificationPrefs.ts).
  const visibleAnnouncements = announcements.filter((a) => !prefs.isHidden('announcement', a.id));
  const visibleActivity = activity.filter((a) => !prefs.isHidden('activity', a.id));

  // Silme artık sessiz değil: kısa süreli bir "Geri al" şeridi çıkıyor.
  // Arka arkaya iki silmede şerit SON silineni hedefliyor — yeni silme
  // öncekinin sayacını iptal edip süreyi baştan başlatıyor. Kuyruk yerine bunu
  // seçtik: üst üste binen şeritler tab çubuğunun üstünü kapatırdı, üstelik
  // geri alınmayan satır zaten listeden düşmüş oluyor.
  const handleDelete = useCallback(
    (id: string | number, kind: 'announcement' | 'activity') => {
      prefs.hide(kind, id);
      if (undoTimer.current) clearTimeout(undoTimer.current);
      setUndoTarget({ id: String(id), kind });
      undoTimer.current = setTimeout(() => {
        setUndoTarget(null);
        undoTimer.current = null;
      }, UNDO_TIMEOUT_MS);
    },
    [prefs.hide]
  );

  const handleUndo = useCallback(() => {
    if (!undoTarget) return;
    if (undoTimer.current) {
      clearTimeout(undoTimer.current);
      undoTimer.current = null;
    }
    prefs.unhide(undoTarget.kind, undoTarget.id);
    setUndoTarget(null);
  }, [undoTarget, prefs.unhide]);

  // Ekran kapanırken sayaç kalmasın: yoksa unmount sonrası setState olur.
  useEffect(
    () => () => {
      if (undoTimer.current) clearTimeout(undoTimer.current);
    },
    []
  );

  // `kind`: Duyurularda "Okundu" sunucuya (`markAnnouncementViewed`) gitmeli —
  // eskiden burada da `prefs.markRead` çağrılıyordu, ki bu yalnızca yerel
  // "okunmadı" GEÇERSİZ KILMASINI temizliyordu; sunucudaki `is_viewed` hâlâ
  // false kaldığı için kart "Yeni" görünmeye devam ediyordu ("okundu/okunmadı
  // kartı çalışmıyor" şikayeti). Aktivitede bu ayrıma gerek yok: o liste
  // zaten girişte tamamen okundu sayılıyor (bkz. fetchActivity).
  const rowActions = (id: string | number, isUnread: boolean, kind: 'announcement' | 'activity') => [
    {
      key: 'read',
      icon: MailOpen,
      label: isUnread ? 'Okundu' : 'Okunmadı',
      color: colors.accent,
      onPress: () => {
        if (!isUnread) {
          prefs.markUnread(kind, id);
          // `prefs` bu ekrana özel bir React state kopyası (bkz.
          // notificationPrefs.ts) — rozeti hesaplayan hook'lar (useUnreadAnnouncements /
          // useUnreadNotifications) ayrı birer örnek, bu yazmayı kendiliğinden
          // görmüyor. Türüne göre ilgili rozet sorgusunu elle tazeliyoruz ki
          // "okunmadı" yapınca sayı da artsın.
          if (kind === 'announcement') invalidateAnnouncementsUnread();
          else invalidateActivityUnread();
          return;
        }
        if (kind === 'announcement') return markAnnouncementViewed(id);
        prefs.markRead('activity', id);
        invalidateActivityUnread();
      },
    },
    { key: 'delete', icon: Trash2, label: 'Sil', color: colors.danger, onPress: () => handleDelete(id, kind) },
  ];

  const renderAnnouncement = useCallback<ListRenderItem<Announcement>>(
    ({ item }) => {
      // Yerel "okunmadı" tercihi + sunucudaki `is_viewed` — Aktivite
      // sekmesindeki hesabın aynısı; hem kaydırma aksiyonunun etiketi hem
      // karttaki rozet aynı değerden çıkıyor.
      const isUnread = prefs.isUnread('announcement', item.id) || !item.is_viewed;
      return (
        <SwipeActions actions={rowActions(item.id, isUnread, 'announcement')}>
          <AnnouncementCard notif={item} unread={isUnread} />
        </SwipeActions>
      );
    },
    [prefs.unread, rowActions]
  );

  const renderActivity = useCallback<ListRenderItem<any>>(
    ({ item }) => {
      const isUnread = prefs.isUnread('activity', item.id) || !item.read_at;
      return (
        <SwipeActions actions={rowActions(item.id, isUnread, 'activity')}>
          <ActivityCard notif={item} unread={isUnread} />
        </SwipeActions>
      );
    },
    [prefs.unread, rowActions]
  );

  return (
    <View className="flex-1 bg-ground">
      <View className="flex-row gap-2 p-3 pb-1">
        <Pressable
          className={`flex-row items-center gap-1.5 border border-brand rounded-[10px] px-3.5 py-2 ${tab === 'duyurular' ? 'bg-brand' : ''}`}
          onPress={() => setTab('duyurular')}
        >
          <Megaphone size={15} color={tab === 'duyurular' ? '#fff' : isDark ? '#5A9690' : '#2F5755'} />
          <Text className={`text-[13px] font-semibold ${tab === 'duyurular' ? 'text-white' : 'text-accent'}`}>Duyurular</Text>
        </Pressable>
        <Pressable
          className={`flex-row items-center gap-1.5 border border-brand rounded-[10px] px-3.5 py-2 ${tab === 'aktivite' ? 'bg-brand' : ''}`}
          onPress={() => setTab('aktivite')}
        >
          <Bell size={15} color={tab === 'aktivite' ? '#fff' : isDark ? '#5A9690' : '#2F5755'} />
          <Text className={`text-[13px] font-semibold ${tab === 'aktivite' ? 'text-white' : 'text-accent'}`}>Aktivite</Text>
        </Pressable>

        {/* Dişli bilerek sekme satırında, üst bardaki AppHeader'da değil:
            AppHeader her rotada ortak ve başlığı mutlak konumlu ortalanmış
            (px-20 payı) — dördüncü bir kontrol uzun Türkçe başlıklarla
            çakışırdı. */}
        <View className="flex-1" />
        <Pressable
          className="items-center justify-center px-2"
          onPress={() => setShowSettings(true)}
          hitSlop={8}
          accessibilityLabel="Bildirim ayarları"
        >
          <Settings size={20} color={colors.muted} />
        </Pressable>
      </View>

      {tab === 'duyurular' ? (
        <FlatList
          showsVerticalScrollIndicator={false}
          contentContainerClassName="p-3 pb-[150px] flex-grow gap-2.5"
          data={visibleAnnouncements}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderAnnouncement}
          // `removeClippedSubviews` BİLEREK YOK (Aktivite listesinde var):
          // bu listenin başlığında filtre çipleri duruyor ve bu prop'un
          // ekrandan çıkan/giren alt görünümlerdeki dokunmaları yutması bilinen
          // bir sorun — "Tümü basılmıyor" şikâyetinin olası paylarından biri.
          maxToRenderPerBatch={6}
          windowSize={7}
          initialNumToRender={6}
          ListHeaderComponent={
            // "Tümü" çipi kategori listesinden bağımsız her zaman render edilir:
            // kategoriler API'si boş/yavaş/hatalı dönse bile (retry kapalı)
            // kullanıcı filtreyi sıfırlayabilmeli. Sadece kategori çipleri
            // categories.length > 0 koşuluna bağlı kalır.
            <View className="mb-3">
              <View className="flex-row flex-wrap gap-2">
                <FilterChip label="Tümü" selected={activeCategory === ''} onPress={() => handleSelectCategory('')} />
                {categories.length > 0 &&
                  categories.map((cat) => (
                    <FilterChip
                      key={cat.id}
                      label={cat.name}
                      selected={activeCategory === cat.slug}
                      onPress={() => handleSelectCategory(cat.slug)}
                    />
                  ))}
              </View>
              {/* Liste DOLUYKEN de görünen yükleniyor göstergesi. Aşağıdaki
                  `ListEmptyComponent`'teki spinner yalnızca liste boşken
                  çiziliyor; zaten seçili olan "Tümü"ye basmak (ki `categoryReloadKey`
                  sayesinde gerçek bir yeniden çekme tetikliyor) o yüzden ekranda
                  hiçbir iz bırakmıyor ve kullanıcı "buton çalışmıyor" diye
                  algılıyordu. Artık her basış görünür bir karşılık veriyor. */}
              {loadingAnnouncements && visibleAnnouncements.length > 0 && (
                <ActivityIndicator style={{ marginTop: 10 }} color={colors.accent} />
              )}
            </View>
          }
          ListEmptyComponent={
            // Liste boşken: çark yerine satırın kendi şekli. Gecikme dolmadan
            // (hızlı bağlantı) hiçbir şey çizilmiyor — "hiç bildirim yok"
            // metni de veri gelmeden yanlışlıkla görünmesin diye ayrı dalda.
            showAnnouncementSkeleton ? (
              <NotificationRowsSkeleton />
            ) : (
              <Text className="text-center text-muted2 mt-6">Henüz bildirim yok.</Text>
            )
          }
        />
      ) : (
        <FlatList
          showsVerticalScrollIndicator={false}
          contentContainerClassName="p-3 pb-[150px] flex-grow gap-2.5"
          data={visibleActivity}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderActivity}
          removeClippedSubviews
          maxToRenderPerBatch={6}
          windowSize={7}
          initialNumToRender={6}
          onEndReached={handleActivityEndReached}
          // 0.4: liste sonuna gelmeden biraz önce tetiklensin ama piksel piksel
          // kaydırmada sürekli ateşlemesin (çift istek kapısı yine de ref'te).
          onEndReachedThreshold={0.4}
          ListFooterComponent={
            activityLoadingMore ? <ActivityIndicator style={{ marginTop: 12 }} color={colors.accent} /> : null
          }
          ListEmptyComponent={
            showActivitySkeleton ? (
              <NotificationRowsSkeleton />
            ) : (
              <Text className="text-center text-muted2 mt-6">Henüz aktivite bildirimi yok.</Text>
            )
          }
        />
      )}

      {/* Silme geri alma şeridi — tab çubuğunun hemen üstünde duruyor. */}
      {undoTarget !== null && (
        <View className="absolute left-3 right-3 bottom-[96px] flex-row items-center gap-3 bg-surface border border-line rounded-xl px-3.5 py-3">
          <Text className="flex-1 text-[13px] text-ink2">Bildirim silindi.</Text>
          <Pressable onPress={handleUndo} hitSlop={10}>
            <Text className="text-[13px] font-bold text-accent">Geri al</Text>
          </Pressable>
        </View>
      )}

      <NotificationSettingsSheet visible={showSettings} onClose={() => setShowSettings(false)} />
    </View>
  );
}
