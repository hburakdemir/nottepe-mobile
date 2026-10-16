import type { Badge } from '../components/BadgeChip';

export interface Comment {
  id: number;
  post_id: number;
  user_id: number;
  username?: string;
  content?: string | null;
  rating?: number | null;
  role?: string;
  // v1 ya da v2 olabilir; her zaman toV2 ile okunur (bkz. avatar2/migrateV1.ts).
  avatar_config?: unknown;
  avatar_photo_path?: string | null;
  avatar_display_mode?: 'avatar' | 'photo' | 'both';
  created_at: string;
  updated_at?: string | null;
  deleted_at?: string | null;
  deleted_by?: number | null;
  deleted_by_username?: string | null;
  delete_reason?: string | null;
  badges?: Badge[];
}
