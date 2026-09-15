import { useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  aktsAPI,
  badgeAPI,
  checklistAPI,
  departmentFollowAPI,
  faqAPI,
  scheduleAPI,
  suggestionAPI,
  userAPI,
} from '../../lib/api';
import type { Badge } from '../../components/BadgeChip';
import type { Checklist } from '../../types/checklist';
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
// --- `username` PARAMETRESİ ---------------------------------------------
//
// Aynı sekmeler artık başka bir kullanıcının profilinde de basılıyor (tek
// şablon, bkz. components/profile/ProfileTemplate.tsx). Alternatif — veriyi
// şablona yukarı taşımak — prop sözleşmesini basitleştirirdi ama yukarıda
// gerekçesi yazılı hatayı geri getirirdi. Parametrik hook'un maliyeti tek bir
// `username` string'i, onu da `ProfileScope` context'i emiyor: sekmeler
// ekstra prop almıyor.
//
// `username` verilmemişse kaynak oturum sahibinin kendi uçları
// (`checklistAPI.getMine()` vb.), verilmişse herkese açık uçlar
// (`userAPI.getChecklists(username)` vb.).
const LIST_STALE_MS = 60 * 1000;
// Başkasının profili daha uzun taze sayılıyor: kendi verin değil, arkasından
// sen değiştirmiyorsun ve bu ekrana bir mutasyon bağlı değil.
const USER_LIST_STALE_MS = 5 * 60 * 1000;

export type ProfileList = 'badges' | 'checklists' | 'akts' | 'schedule' | 'follows';

/**
 * Anahtar şeması: `['profile', <username | 'me'>, <liste>]`.
 *
 * `['profile', ...]` öneki bilerek korundu — mevcut `invalidateQueries`
 * çağrıları (ör. çıkışta tüm profil verisinin atılması) bu önekle çalışıyor.
 */
export const profileListKey = (username: string | undefined, list: ProfileList) =>
  ['profile', username ?? 'me', list] as const;

// Kendi profilinin anahtarları. Mutasyonlar (silme / takipten çıkma /
// checklist kaydetme) YALNIZCA kendi profilinde çalıştığı için `setQueryData`
// ve `invalidateQueries` çağrıları bunları kullanıyor.
export const MY_BADGES_KEY = profileListKey(undefined, 'badges');
export const MY_CHECKLISTS_KEY = profileListKey(undefined, 'checklists');
export const MY_AKTS_KEY = profileListKey(undefined, 'akts');
export const MY_SCHEDULE_KEY = profileListKey(undefined, 'schedule');
export const MY_FOLLOWS_KEY = profileListKey(undefined, 'follows');

// Forum etkinliği `username` DEĞİL kullanıcı KİMLİĞİ ile anahtarlanıyor: uç
// her iki modda aynı (`getUserActivity(id)`), ayrı bir "herkese açık" karşılığı
// yok. O yüzden bu anahtar mod bilmiyor.
export const MY_FORUMS_KEY = ['profile', 'forums'] as const;

export interface AktsCalc {
  id: number;
  title: string;
  gpa: number | null;
  updated_at: string;
  data: { semesters: { courses: unknown[] }[] };
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
//
// `enabled`: sayaçlar başkasının profilinde çekilmiyor (orada sayaç yok), o
// yüzden `useProfileCounts` bu kapıyı `false`'a çekebiliyor. Sekmelerin kendisi
// daima `true` geçiyor — sekme mount olduysa verisini istiyor demektir.

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

export function useProfileChecklists(username?: string, enabled = true) {
  return useQuery({
    queryKey: profileListKey(username, 'checklists'),
    enabled,
    queryFn: async () => {
      try {
        const res = username ? await userAPI.getChecklists(username) : await checklistAPI.getMine();
        return (res.data.checklists || []) as Checklist[];
      } catch {
        return [] as Checklist[];
      }
    },
    staleTime: username ? USER_LIST_STALE_MS : LIST_STALE_MS,
  });
}

export function useProfileAktsCalcs(username?: string, enabled = true) {
  return useQuery({
    queryKey: profileListKey(username, 'akts'),
    enabled,
    queryFn: async () => {
      try {
        const res = username ? await userAPI.getAkts(username) : await aktsAPI.getAll();
        return (res.data.calculations || []) as AktsCalc[];
      } catch {
        return [] as AktsCalc[];
      }
    },
    staleTime: username ? USER_LIST_STALE_MS : LIST_STALE_MS,
  });
}

export function useProfileSchedule(username?: string, enabled = true) {
  return useQuery({
    queryKey: profileListKey(username, 'schedule'),
    enabled,
    queryFn: async () => {
      try {
        const res = username ? await userAPI.getSchedule(username) : await scheduleAPI.getMine();
        return (res.data?.courses || []) as ScheduleCourse[];
      } catch {
        return [] as ScheduleCourse[];
      }
    },
    staleTime: username ? USER_LIST_STALE_MS : LIST_STALE_MS,
  });
}

export function useProfileFollows(username?: string, enabled = true) {
  return useQuery({
    queryKey: profileListKey(username, 'follows'),
    enabled,
    queryFn: async () => {
      try {
        const res = username ? await userAPI.getFollows(username) : await departmentFollowAPI.getMine();
        return (res.data.follows || []) as Follow[];
      } catch {
        return [] as Follow[];
      }
    },
    staleTime: username ? USER_LIST_STALE_MS : LIST_STALE_MS,
  });
}

// Forum etkinliği İKİ uçtan geliyor (SSS yorumları + öneriler) ve tek listede
// tarihe göre birleşiyor. `enabled: !!userId` — kullanıcı kimliği olmadan
// çağrılamıyor; eski koddaki `!user?.id` kontrolünün karşılığı. Kimlik
// başkasının profilinde başlık isteğinden SONRA geldiği için bu kapı orada da
// gerekli (yoksa iki istek boşa gider).
export function useProfileForumActivity(userId: string | number | undefined, enabled = true) {
  return useQuery({
    queryKey: [...MY_FORUMS_KEY, userId],
    enabled: enabled && !!userId,
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

/** Sekme şeridinin dört liste sayacı. */
export interface ProfileListCounts {
  lists: number | null;
  akts: number | null;
  schedule: number | null;
  follows: number | null;
}

/**
 * "Sekme sayaçları tıklamadan dolmalı" DEĞİŞMEZİNİN taşıyıcısı.
 *
 * Eskiden bu dört hook `TabStrip`'in içindeydi; artık şablonda, çünkü şerit
 * prop'laştırıldı. Kritik olan yer değişikliği değil, AYNI ANAHTARLAR:
 * sekmeler de aynı `profileListKey(undefined, ...)`'i okuduğu için sekmeye
 * basıldığında ikinci bir ağ isteği atılmıyor.
 *
 * `enabled: false` (başkasının profili) → dört sorgu hiç çalışmıyor; orada
 * sayaç gösterilmiyor, dolayısıyla veriye de gerek yok.
 */
export function useProfileCounts(enabled: boolean): ProfileListCounts {
  const { data: checklists } = useProfileChecklists(undefined, enabled);
  const { data: aktsCalcs } = useProfileAktsCalcs(undefined, enabled);
  const { data: schedule } = useProfileSchedule(undefined, enabled);
  const { data: follows } = useProfileFollows(undefined, enabled);

  // `useMemo` ŞART: `TabStrip` memo'lu ve `counts` nesnesini prop olarak
  // alıyor — her render'da yeni nesne üretilse memo hiç bail-out yapamazdı.
  return useMemo(
    () => ({
      lists: checklists?.length ?? null,
      akts: aktsCalcs?.length ?? null,
      schedule: schedule?.length ?? null,
      follows: follows?.length ?? null,
    }),
    [checklists, aktsCalcs, schedule, follows]
  );
}

/**
 * Bir listeyi değiştiren akışlar (silme, takipten çıkma, checklist kaydetme)
 * için. Eski kodda bu, sentinel'i `null`'a çekip effect'i yeniden tetiklemekti;
 * karşılığı artık anahtarı geçersiz kılmak.
 */
export function useInvalidateProfileList() {
  const queryClient = useQueryClient();
  return (key: readonly unknown[]) => queryClient.invalidateQueries({ queryKey: key });
}
