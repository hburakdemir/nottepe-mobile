import type { Badge } from '../components/BadgeChip';
import type { AvatarConfig } from '../constants/avatarConfig';

export interface Comment {
  id: number;
  post_id: number;
  user_id: number;
  username?: string;
  content?: string | null;
  rating?: number | null;
  role?: string;
  avatar_config?: Partial<AvatarConfig> | null;
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
