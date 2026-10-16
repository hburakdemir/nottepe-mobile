import { getFileUrl } from '../../lib/config';

// Kayıp Eşya sabitleri ve tipleri — sunucudaki controllers/lostItemController.js
// listeleriyle ve web'deki components/lostItems/lostItemMeta.js ile birebir aynı
// anahtarlar.

export type LostItemType = 'lost' | 'found';
export type ClaimStatus = 'pending' | 'accepted' | 'rejected';

export interface LostItem {
  id: number;
  user_id: number;
  type: LostItemType;
  title: string;
  description: string;
  location: string;
  /** Olayın günü ve saati. Saat eklenmeden önceki ilanlarda yalnız item_date var. */
  item_at: string | null;
  item_date: string | null;
  /** İlanı verenin iletişim bilgisi (telefon, Instagram vb.) — herkese açık. */
  contact: string;
  images: string[];
  verify_question: string | null;
  // Doğru şıkkın indeksi sunucudan hiç gelmez.
  verify_options: string[] | null;
  handed_over_place: string | null;
  handed_over_at: string | null;
  status: 'open' | 'resolved' | 'removed';
  created_at: string;
  owner_username: string;
  owner_full_name?: string | null;
  /** Yalnız ilan sahibine dolu. */
  pending_claim_count: number | null;
  my_claim_status: ClaimStatus | null;
  /** İzleyenin bu ilana başvurusu — mesajlaşma için. */
  my_claim_id?: number | null;
}

/** Başvuran ↔ ilan sahibi özel mesajı (sunucu: lost_item_messages). */
export interface LostItemMessage {
  id: number;
  claim_id: number;
  sender_id: number;
  body: string;
  read_at: string | null;
  created_at: string;
  sender_username?: string;
  sender_full_name?: string | null;
}

export interface LostItemClaim {
  id: number;
  claimant_id: number;
  claimant_username: string;
  claimant_full_name?: string | null;
  answer_text: string | null;
  answer_index: number | null;
  is_correct: boolean | null;
  /** Başvuranın iletişim bilgisi — yalnız ilan sahibi görüyor. */
  contact: string | null;
  status: ClaimStatus;
  created_at: string;
  message_count?: number;
  unread_message_count?: number;
}

export interface MyClaim {
  id: number;
  item_id: number;
  status: ClaimStatus;
  owner_note: string | null;
  created_at: string;
  item_type: LostItemType;
  item_title: string;
  item_images: string[];
  handed_over_place: string | null;
  handed_over_at: string | null;
  owner_username: string;
  item_contact: string | null;
  message_count?: number;
  unread_message_count?: number;
}

// "Bir yere teslim ettim" için öneriler — serbest metin de yazılabilir.
export const HANDOVER_PLACE_SUGGESTIONS = [
  'Kampüs Güvenlik Amirliği',
  'Bölüm Sekreterliği',
  'Kütüphane Danışma',
  'Yemekhane Girişi',
  'Fakülte Danışma',
];

export const TYPE_META: Record<LostItemType, { label: string; bg: string; text: string }> = {
  lost: { label: 'Kayıp', bg: '#fee2e2', text: '#b91c1c' },
  found: { label: 'Bulundu', bg: '#dcfce7', text: '#15803d' },
};

export const CLAIM_STATUS_META: Record<ClaimStatus, { label: string; bg: string; text: string }> = {
  pending: { label: 'Bekliyor', bg: '#fef3c7', text: '#b45309' },
  accepted: { label: 'Onaylandı', bg: '#dcfce7', text: '#15803d' },
  rejected: { label: 'Onaylanmadı', bg: '#e5e7eb', text: '#4b5563' },
};

export const lostItemImageUrl = (name: string) => getFileUrl(`lost-items/${name}`);

export const formatDay = (d: string) =>
  new Date(d).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });

export const formatDateTime = (d: string) =>
  new Date(d).toLocaleString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });

// İlanın "ne zaman"ı: saat varsa gün + saat, yoksa (eski ilanlar) yalnız gün.
export function itemWhen(item: Pick<LostItem, 'item_at' | 'item_date'>): string | null {
  if (item.item_at) return formatDateTime(item.item_at);
  if (item.item_date) return formatDay(item.item_date);
  return null;
}

const pad = (n: number) => String(n).padStart(2, '0');

export function currentTimeString(): string {
  const now = new Date();
  return `${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

// Tarih seçici için yeni native paket eklemiyoruz; ekranlar "Bugün / Dün / ..."
// çipleri + "SS:DD" saat kutusu sunuyor. Geçersiz saatte ya da gelecekte null.
export function dayTimeToIso(daysAgo: number, time: string): string | null {
  const m = /^(\d{1,2})[:.](\d{2})$/.exec(time.trim());
  if (!m || +m[1] > 23 || +m[2] > 59) return null;
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(+m[1], +m[2], 0, 0);
  if (d.getTime() > Date.now() + 60 * 1000) return null;
  return d.toISOString();
}

export const DAY_CHOICES = [
  { daysAgo: 0, label: 'Bugün' },
  { daysAgo: 1, label: 'Dün' },
  { daysAgo: 2, label: '2 gün önce' },
  { daysAgo: 3, label: '3 gün önce' },
];
