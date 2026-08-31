import type { Badge } from '../components/BadgeChip';

export interface Comment {
  id: number;
  post_id: number;
  user_id: number;
  username?: string;
  content?: string | null;
  rating?: number | null;
  role?: string;
  created_at: string;
  updated_at?: string | null;
  deleted_at?: string | null;
  deleted_by?: number | null;
  deleted_by_username?: string | null;
  delete_reason?: string | null;
  badges?: Badge[];
}
