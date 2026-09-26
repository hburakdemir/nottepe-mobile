import type { Badge } from '../components/BadgeChip';

export interface Post {
  id: number;
  post_id?: number;
  title: string;
  content: string;
  link?: string | null;
  faculty: string;
  department: string;
  username: string;
  full_name?: string;
  user_id: number;
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
