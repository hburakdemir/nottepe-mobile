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
  delete_reason?: string | null;
}
