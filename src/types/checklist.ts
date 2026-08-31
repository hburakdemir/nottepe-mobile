export interface ChecklistItem {
  id: number;
  content: string;
  sort_order: number;
  checked: boolean;
  is_active?: boolean;
}

export interface Checklist {
  id: number;
  title: string;
  slug: string;
  description: string | null;
  sort_order?: number;
  list_type: 'admin' | 'user';
  approval_status: 'approved' | 'pending' | 'rejected';
  created_by: number;
  created_at: string;
  items: ChecklistItem[];
  completion?: {
    completedCount: number;
    items: { id: number; content: string; checkedCount: number }[];
  };
}

export const isWithinEditWindow = (checklist: Checklist) =>
  !!checklist.created_at && Date.now() - new Date(checklist.created_at).getTime() < 60 * 60 * 1000;
