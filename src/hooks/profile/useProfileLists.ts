import { useQuery, useQueryClient } from '@tanstack/react-query';
import { aktsAPI, badgeAPI, checklistAPI, departmentFollowAPI, faqAPI, scheduleAPI, suggestionAPI } from '../../lib/api';
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
  id: number;
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

export function useMyChecklists() {
  return useQuery({
    queryKey: MY_CHECKLISTS_KEY,
    queryFn: async () => {
      try {
        const res = await checklistAPI.getMine();
        return (res.data.checklists || []) as Checklist[];
      } catch {
        return [] as Checklist[];
      }
    },
    staleTime: LIST_STALE_MS,
  });
}

export function useMyAktsCalcs() {
  return useQuery({
    queryKey: MY_AKTS_KEY,
    queryFn: async () => {
      try {
        const res = await aktsAPI.getAll();
        return (res.data.calculations || []) as AktsCalc[];
      } catch {
        return [] as AktsCalc[];
      }
    },
    staleTime: LIST_STALE_MS,
  });
}

export function useMySchedule() {
  return useQuery({
    queryKey: MY_SCHEDULE_KEY,
    queryFn: async () => {
      try {
        const res = await scheduleAPI.getMine();
        return (res.data?.courses || []) as ScheduleCourse[];
      } catch {
        return [] as ScheduleCourse[];
      }
    },
    staleTime: LIST_STALE_MS,
  });
}

export function useMyFollows() {
  return useQuery({
    queryKey: MY_FOLLOWS_KEY,
    queryFn: async () => {
      try {
        const res = await departmentFollowAPI.getMine();
        return (res.data.follows || []) as Follow[];
      } catch {
        return [] as Follow[];
      }
    },
    staleTime: LIST_STALE_MS,
  });
}

// Forum etkinliği İKİ uçtan geliyor (SSS yorumları + öneriler) ve tek listede
// tarihe göre birleşiyor. `enabled: !!userId` — kullanıcı kimliği olmadan
// çağrılamıyor; eski koddaki `!user?.id` kontrolünün karşılığı.
export function useMyForumActivity(userId: string | number | undefined) {
  return useQuery({
    queryKey: [...MY_FORUMS_KEY, userId],
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

/**
 * Bir listeyi değiştiren akışlar (silme, takipten çıkma, checklist kaydetme)
 * için. Eski kodda bu, sentinel'i `null`'a çekip effect'i yeniden tetiklemekti;
 * karşılığı artık anahtarı geçersiz kılmak.
 */
export function useInvalidateProfileList() {
  const queryClient = useQueryClient();
  return (key: readonly unknown[]) => queryClient.invalidateQueries({ queryKey: key });
}
