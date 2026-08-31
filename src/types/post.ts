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
  created_at: string;
  file_urls?: string[];
  status?: 'approved' | 'pending' | 'rejected';
  avg_rating?: number | string;
  rating_count?: number;
  comment_count?: number;
}
