import { useQuery, useQueryClient } from '@tanstack/react-query';
import { aktsAPI, badgeAPI, checklistAPI, departmentFollowAPI, faqAPI, scheduleAPI, suggestionAPI, userAPI } from '../../lib/api';
import type { Badge } from '../../components/BadgeChip';
import type { Checklist } from '../../types/checklist';
import type { Post } from '../../types/post';
import type { ScheduleCourse } from '../../utils/schedule';

// Profil'in "küçük" sekmelerinin (checklist / AKTS / program / takip / forum)
// ve rozetlerin veri katmanı.
//
// NEDEN react-query, NEDEN ÖNEMLİ:
//
// Bu beş liste eskiden ProfileScreen'in içinde ham `useState` olarak
// duruyordu. Sorun veri değil, verinin YERİ idi: 29 state tek bir 1632
// satırlık bileşende toplandığı için, "AKTS listesi geldi" gibi tamamen yerel
// bir olay ekranın TAMAMINI (yedi pager sayfası, başlık kartı, sekme şeridi)
// yeniden render ediyordu. Ölçüm bunu sayıyla gösterdi: JS thread blokajının
// %62'si Profil'de.
//
// Veriyi sekmelerin içine indirmenin önündeki tek gerçek engel şuydu: **sekme
// şeridindeki sayaçlar tıklamadan dolmak zorunda.** Bu daha önce bildirilmiş
// bir kullanıcı şikayeti ve tembel yükleme tam da bu yüzden bilerek geri
// alınmıştı. Veri sekmenin `useState`'inde yaşasaydı, sekmeye basılmadan
// sayacı kimse bilemezdi.
//
// react-query bu ikilemi çözüyor: aynı anahtarı hem şerit (sayaç için) hem
// sekme (liste için) çağırıyor, ikinci bir ağ isteği ATILMIYOR, ve veri
// geldiğinde yalnızca o anahtarı okuyan bileşenler render oluyor.
//
// `staleTime` 60sn: bunların hepsi kullanıcının KENDİ verisi, arkasından biri
// değiştirmiyor. Değiştiren taraf (silme/takipten çıkma/checklist kaydetme)
// zaten aşağıdaki `invalidate*` yardımcılarıyla anahtarı geçersiz kılıyor.
const LIST_STALE_MS = 60 * 1000;

export const MY_BADGES_KEY = ['profile', 'badges'] as const;
export const MY_CHECKLISTS_KEY = ['profile', 'checklists'] as const;
export const MY_AKTS_KEY = ['profile', 'akts'] as const;
export const MY_SCHEDULE_KEY = ['profile', 'schedule'] as const;
export const MY_FOLLOWS_KEY = ['profile', 'follows'] as const;
export const MY_FORUMS_KEY = ['profile', 'forums'] as const;

// Liste uçları (/akts, /users/:username/akts) sadece özet döndürüyor; dersler
// yalnızca aktsAPI.getById ile, hesaplayıcıya yüklerken çekiliyor.
export interface AktsCalc {
  id: string;
  title: string;
  gpa: number | null;
  semester_count: number;
  course_count: number;
  updated_at: string;
}

export interface Follow {
  faculty: string;
  department: string;
}

export interface ForumItem {
  key: string;
  kind: 'faq' | 'suggestion';
  targetId: number;
  created_at: string;
  title: string;
  body?: string;
}

// Hepsi aynı kalıbı izliyor. Hata durumunda `[]` dönüyoruz, `throw` etmiyoruz:
// ekranın "yükleniyor" ile "gerçekten boş" ayrımı `isPending` üzerinden
// yapılıyor ve bir uç çöktüğünde sekme sonsuza kadar spinner göstermemeli —
// ham state'li eski kodun `.catch(() => setX([]))` davranışı birebir bu.

export function useMyBadges() {
  return useQuery({
    queryKey: MY_BADGES_KEY,
    queryFn: async () => {
      try {
        const res = await badgeAPI.getMine();
        return (res.data.badges || []) as Badge[];
      } catch {
        return [] as Badge[];
      }
    },
    staleTime: LIST_STALE_MS,
  });
}

// PROFİLİN SAHİBİ. Kendi profili ile başkasının profili AYNI sekme
// bileşenleriyle çiziliyor (bkz. UserProfileScreen.tsx); fark yalnızca verinin
// nereden geldiği ve sahibe özel düğmelerin görünüp görünmediği.
//
// `me` mevcut "kendim" uçlarını ve MEVCUT anahtarları (`MY_*_KEY`) kullanıyor —
// iyimser güncellemeler ve invalidate'ler o anahtarlara yazıyor.
// `user` başkasının `/users/:username/...` uçlarını kullanıyor.
//
// Bileşenler `React.memo`'lu olduğu için `owner` referansı STABİL olmalı:
// kendi profili `ME_OWNER` sabitini, başkasınınki `useMemo` ile kurulanı veriyor.
export type ProfileOwner = { kind: 'me' } | { kind: 'user'; username: string; userId: number };
export const ME_OWNER: ProfileOwner = { kind: 'me' };

type ListKey = 'lists' | 'akts' | 'schedule' | 'follows' | 'saved';
const MY_KEYS: Record<Exclude<ListKey, 'saved'>, readonly unknown[]> = {
  lists: MY_CHECKLISTS_KEY,
  akts: MY_AKTS_KEY,
  schedule: MY_SCHEDULE_KEY,
  follows: MY_FOLLOWS_KEY,
};
const userKey = (username: string, key: ListKey | 'forums') => ['user-profile', username, key] as const;

export function profileForumsKey(owner: ProfileOwner, myUserId: string | number | undefined) {
  return owner.kind === 'me' ? [...MY_FORUMS_KEY, myUserId] : userKey(owner.username, 'forums');
}

export const userSavedPostsKey = (username: string) => userKey(username, 'saved');

export function profileListKey(owner: ProfileOwner, key: Exclude<ListKey, 'saved'>) {
  return owner.kind === 'me' ? MY_KEYS[key] : userKey(owner.username, key);
}

// Yukarıdaki "hata → `[]`" kuralı burada da geçerli. Başkasının gizlediği bölümde sunucu `{ hidden: true }` döndürüyor — dizi
// alanı yok, sonuç yine `[]` (sekme zaten gösterilmiyor).
function useOwnerList<T>(
  owner: ProfileOwner,
  key: Exclude<ListKey, 'saved'>,
  fetchMine: () => Promise<T[]>,
  fetchUser: (username: string) => Promise<T[]>
) {
  return useQuery({
    queryKey: profileListKey(owner, key),
    queryFn: async () => {
      try {
        return owner.kind === 'me' ? await fetchMine() : await fetchUser(owner.username);
      } catch {
        return [] as T[];
      }
    },
    staleTime: LIST_STALE_MS,
  });
}

export function useProfileChecklists(owner: ProfileOwner) {
  return useOwnerList<Checklist>(
    owner,
    'lists',
    async () => (await checklistAPI.getMine()).data.checklists || [],
    async (u) => (await userAPI.getChecklists(u)).data.checklists || []
  );
}

export function useProfileAktsCalcs(owner: ProfileOwner) {
  return useOwnerList<AktsCalc>(
    owner,
    'akts',
    async () => (await aktsAPI.getAll()).data.calculations || [],
    async (u) => (await userAPI.getAkts(u)).data.calculations || []
  );
}

export function useProfileSchedule(owner: ProfileOwner) {
  return useOwnerList<ScheduleCourse>(
    owner,
    'schedule',
    async () => (await scheduleAPI.getMine()).data?.courses || [],
    async (u) => (await userAPI.getSchedule(u)).data?.courses || []
  );
}

export function useProfileFollows(owner: ProfileOwner) {
  return useOwnerList<Follow>(
    owner,
    'follows',
    async () => (await departmentFollowAPI.getMine()).data.follows || [],
    async (u) => (await userAPI.getFollows(u)).data.follows || []
  );
}

// Başkasının "Kayıtlı" sekmesi. Kendi Kayıtlı'n sayfalı durum makinesini
// kullanıyor (bkz. usePostsPagination.ts); bu uç sayfasız, tüm listeyi döndürüyor.
export function useUserSavedPosts(username: string, enabled: boolean) {
  return useQuery({
    queryKey: userSavedPostsKey(username),
    enabled,
    queryFn: async () => {
      try {
        return ((await userAPI.getSavedPosts(username)).data.posts || []) as Post[];
      } catch {
        return [] as Post[];
      }
    },
    staleTime: LIST_STALE_MS,
  });
}

// Forum etkinliği İKİ uçtan geliyor (SSS yorumları + öneriler) ve tek listede
// tarihe göre birleşiyor. `enabled: !!userId` — kullanıcı kimliği olmadan
// çağrılamıyor. Kendi profilinde anahtar eskisi gibi `[...MY_FORUMS_KEY, id]`.
export function useProfileForumActivity(owner: ProfileOwner, myUserId: string | number | undefined) {
  const userId = owner.kind === 'me' ? myUserId : owner.userId;
  return useQuery({
    queryKey: profileForumsKey(owner, myUserId),
    enabled: !!userId,
    queryFn: async () => {
      const [faqRes, sugRes] = await Promise.all([
        faqAPI.getUserActivity(userId!).catch(() => ({ data: { activity: [] } })),
        suggestionAPI.getUserActivity(userId!).catch(() => ({ data: { activity: [] } })),
      ]);
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
      return [...faqItems, ...sugItems].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    },
    staleTime: LIST_STALE_MS,
  });
}

// --- Sekme sayaçları ---------------------------------------------------------
// "Sekme sayaçları tıklamadan dolmalı" kuralı eskiden dört listenin TAMAMINI
// açılışta çekerek sağlanıyordu (forum hiç sayılmıyordu). Artık sunucu yedi
// sayıyı tek sorguda veriyor (`/users/:username/profile-counts`); listeler
// yalnızca sekme görülünce çekiliyor. Gizlenen bölümün anahtarı yanıtta yok.
//
// Uç yoksa (eski sunucu) ya da hata verirse `{}` — sayaç, sekme listesi
// yüklenince beliriyor (eski davranış).
export type ProfileCounts = Partial<Record<'posts' | 'saved' | 'lists' | 'akts' | 'schedule' | 'follows' | 'forums', number>>;
export const PROFILE_COUNTS_KEY = ['profile-counts'] as const;

export function useProfileCounts(username: string | undefined) {
  return useQuery({
    queryKey: [...PROFILE_COUNTS_KEY, username],
    enabled: !!username,
    queryFn: async () => {
      try {
        return ((await userAPI.getProfileCounts(username!)).data.counts || {}) as ProfileCounts;
      } catch {
        return {} as ProfileCounts;
      }
    },
    staleTime: LIST_STALE_MS,
  });
}

/**
 * Bir listeyi değiştiren akışlar (silme, takipten çıkma, checklist kaydetme)
 * için. Eski kodda bu, sentinel'i `null`'a çekip effect'i yeniden tetiklemekti;
 * karşılığı artık anahtarı geçersiz kılmak.
 */
export function useInvalidateProfileList() {
  const queryClient = useQueryClient();
  return (key: readonly unknown[]) => {
    queryClient.invalidateQueries({ queryKey: key });
    queryClient.invalidateQueries({ queryKey: PROFILE_COUNTS_KEY });
  };
}
