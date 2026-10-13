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
  category: string;
  campus: string;
  location: string;
  item_date: string | null;
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
}

export interface LostItemClaim {
  id: number;
  claimant_id: number;
  claimant_username: string;
  claimant_full_name?: string | null;
  answer_text: string | null;
  answer_index: number | null;
  is_correct: boolean | null;
  status: ClaimStatus;
  created_at: string;
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
}

export const LOST_ITEM_CATEGORIES = [
  { value: 'elektronik', label: 'Elektronik' },
  { value: 'kimlik_kart', label: 'Kimlik / Kart' },
  { value: 'cuzdan', label: 'Cüzdan' },
  { value: 'anahtar', label: 'Anahtar' },
  { value: 'canta', label: 'Çanta' },
  { value: 'giyim', label: 'Giyim' },
  { value: 'kitap_kirtasiye', label: 'Kitap / Kırtasiye' },
  { value: 'aksesuar', label: 'Aksesuar' },
  { value: 'diger', label: 'Diğer' },
] as const;

export const CATEGORY_LABELS: Record<string, string> = Object.fromEntries(
  LOST_ITEM_CATEGORIES.map((c) => [c.value, c.label])
);

export const LOST_ITEM_CAMPUSES = ['Beytepe', 'Sıhhiye', 'Diğer'] as const;

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

// Yerel tarih → 'YYYY-MM-DD' (sunucu item_date formatı). Tarih seçici için
// yeni native paket eklemiyoruz; ekranlar "Bugün / Dün / ..." çipleri sunuyor.
export function localDateString(daysAgo = 0): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export const DAY_CHOICES = [
  { daysAgo: 0, label: 'Bugün' },
  { daysAgo: 1, label: 'Dün' },
  { daysAgo: 2, label: '2 gün önce' },
  { daysAgo: 3, label: '3 gün önce' },
];
