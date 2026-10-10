import type { Badge } from '../components/BadgeChip';

export interface Post {
  id: number;
  post_id?: number;
  title: string;
  content: string;
  link?: string | null;
  faculty: string;
  department: string;
  // Anonim notta sahibi OLMAYANA ikisi de null geliyor (admin/mod dahil).
  // Sahibine `user_id` dolu, `username` null — `isOwner` kontrolü çalışıyor.
  username: string | null;
  full_name?: string | null;
  user_id: number | null;
  /** Not bazlı anonimlik; sahibi notun ⋯ → Düzenle menüsünden değiştiriyor. */
  is_anonymous?: boolean;
  /** Gönderi detayında: izleyen bu gönderinin sahibini engellemiş mi (sunucu). */
  is_blocked_by_me?: boolean;
  created_at: string;
  file_urls?: string[];
  status?: 'approved' | 'pending' | 'rejected';
  avg_rating?: number | string;
  rating_count?: number;
  comment_count?: number;
  badges?: Badge[];
  // Yazarın avatarı liste sorgusuyla birlikte geliyor (backend
  // models/postModel.js — avatars tablosuna LEFT JOIN), ayrı istek gerekmiyor.
  avatar_config?: Record<string, unknown> | null;
  avatar_photo_path?: string | null;
  avatar_display_mode?: 'avatar' | 'photo' | 'both' | null;
  // Fotoğraflı avatar yalnızca admin/moderatör yazarlarda gösteriliyor
  // (bkz. buildPostAuthorAvatar). Backend bu alanı dönmezse herkes çizim
  // avatarla görünür — bilinçli güvenli varsayılan.
  user_role?: string | null;
}
