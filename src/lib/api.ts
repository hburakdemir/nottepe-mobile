import axios from 'axios';
import { API_URL } from './config';
import { getAccessToken, clearAccessToken } from './tokenStore';
import { emitSessionExpired } from './authEvents';

const ADMIN_POSTS_PAGE_LIMIT = 10;

const toQueryString = (params: Record<string, unknown> = {}) => {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      query.append(key, String(value));
    }
  });
  const serialized = query.toString();
  return serialized ? `?${serialized}` : '';
};

const REQUEST_TIMEOUT_MS = 15000;

const api = axios.create({
  baseURL: API_URL,
  timeout: REQUEST_TIMEOUT_MS,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Backend şu an accessToken'ı yalnızca httpOnly cookie'de tutuyor; mobil için
// Bearer header desteği eklenene kadar (bkz. PLAN.md Faz 0) bu interceptor
// SecureStore'da token varsa gönderir, yoksa sessizce atlar.
api.interceptors.request.use(async (requestConfig) => {
  const token = await getAccessToken();
  if (token) {
    requestConfig.headers.Authorization = `Bearer ${token}`;
  }
  return requestConfig;
});

function isRequestAborted(error: any) {
  const msg = error?.message || '';
  const code = error?.code || '';
  return (
    code === 'ERR_CANCELED' ||
    /abort|cancell?ed/i.test(msg)
  );
}

// İnternet yok ya da istek zaman aşımına uğradıysa (bkz. REQUEST_TIMEOUT_MS)
// axios bir response üretmez; ekranlar bu durumu sunucu hatasından ayırıp
// "bağlantı yok" mesajı gösterebilsin diye ayrı bir yardımcı fonksiyon.
export function isNetworkError(error: any) {
  const code = error?.code || '';
  return !error?.response && (code === 'ECONNABORTED' || code === 'ERR_NETWORK' || !!error?.request);
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (isRequestAborted(error)) {
      return Promise.reject(error);
    }

    const status = error.response?.status;
    const isAuthEndpoint =
      error.config?.url?.includes('/auth/login') ||
      error.config?.url?.includes('/auth/register') ||
      error.config?.url?.includes('/auth/logout');

    if (status === 401 && !isAuthEndpoint) {
      await clearAccessToken();
      emitSessionExpired();
    }

    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  register: (userData: Record<string, unknown>) => api.post('/auth/register', userData),
  login: (credentials: { username: string; password: string }) =>
    api.post('/auth/login', credentials),
  logout: () => api.post('/auth/logout'),
  verifyEmail: (email: string, code: string) => api.post('/auth/verify-email', { email, code }),
  resendCode: (email: string) => api.post('/auth/resend-code', { email }),
};

// Posts API
export const postsAPI = {
  getAllPosts: ({ page = 1, search = '', faculty = '', department = '' } = {}) => {
    const params = new URLSearchParams({ page: String(page) });
    if (search) params.append('search', search);
    if (faculty) params.append('faculty', faculty);
    if (department) params.append('department', department);
    return api.get(`/posts/getpost?${params.toString()}`);
  },
  getMyPosts: () => api.get('/posts/my-posts'),
  getById: (postId: string | number) => api.get(`/posts/${postId}`),
  getFaculties: () => api.get('/posts/faculties'),
  addPost: (formData: FormData) =>
    api.post('/posts/addpost', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  deletePost: (postId: string | number) => api.delete(`/posts/deletepost/${postId}`),
};

// Saved Posts API
export const savedPostsAPI = {
  getSavedPosts: () => api.get('/saved-posts/getPost'),
  savePost: (postId: string | number) => api.post(`/saved-posts/savePost/${postId}`),
  unsavePost: (postId: string | number) => api.delete(`/saved-posts/unsavePost/${postId}`),
};

// Profile API
export const profileAPI = {
  updateProfile: (profileData: Record<string, unknown>) =>
    api.put('/update-profile/profile', profileData),
};

// Admin API
export const adminAPI = {
  getAllUsers: ({ limit = 50, offset = 0, q = '' } = {}) =>
    api.get(`/users?limit=${limit}&offset=${offset}&q=${encodeURIComponent(q)}`),
  updateUserRole: (userId: string | number, role: string) =>
    api.patch(`/users/${userId}/role`, { role }),
  updateUserEmail: (userId: string | number, emailVerified: boolean) =>
    api.patch(`/users/${userId}/email-verification`, { emailVerified }),
  deleteUser: (userId: string | number) => api.delete(`/users/${userId}`),
  searchUsersLite: (q: string) => api.get(`/users/search${toQueryString({ q })}`),
  getPendingPosts: ({ page = 1, ...rest } = {}) =>
    api.get(`/posts/pending${toQueryString({ page, limit: ADMIN_POSTS_PAGE_LIMIT, ...rest })}`),
  approvePost: (postId: string | number) => api.patch(`/posts/${postId}/approve`, {}),
  turnPendedPost: (postId: string | number) => api.patch(`/posts/${postId}/pending`, {}),
  rejectPost: (postId: string | number) => api.patch(`/posts/${postId}/reject`, {}),
  deletePostAdmin: (postId: string | number) => api.delete(`/posts/${postId}/admin-delete`),
  getAllPostsWithStatus: ({ page = 1, ...rest } = {}) =>
    api.get(`/posts/all-status${toQueryString({ page, limit: ADMIN_POSTS_PAGE_LIMIT, ...rest })}`),
  getApprovedPosts: ({ page = 1, ...rest } = {}) =>
    api.get(`/posts/approved${toQueryString({ page, limit: ADMIN_POSTS_PAGE_LIMIT, ...rest })}`),
  getPostStatusCounts: () => api.get('/posts/admin/status-counts'),
  getDeletedPosts: ({ page = 1, ...rest } = {}) =>
    api.get(`/posts/admin/deleted${toQueryString({ page, limit: ADMIN_POSTS_PAGE_LIMIT, ...rest })}`),
  restorePost: (postId: string | number) => api.patch(`/posts/${postId}/restore`, {}),
};

// Kullanıcı profili
export const userAPI = {
  getProfile: (username: string) => api.get(`/users/${encodeURIComponent(username)}/profile`),
  getPosts: (username: string, { page = 1, limit = 12 } = {}) =>
    api.get(`/users/${encodeURIComponent(username)}/posts${toQueryString({ page, limit })}`),
  getChecklists: (username: string) => api.get(`/users/${encodeURIComponent(username)}/checklists`),
  getAkts: (username: string) => api.get(`/users/${encodeURIComponent(username)}/akts`),
  getSchedule: (username: string) => api.get(`/users/${encodeURIComponent(username)}/schedule`),
  getFollows: (username: string) => api.get(`/users/${encodeURIComponent(username)}/follows`),
  getSavedPosts: (username: string) => api.get(`/users/${encodeURIComponent(username)}/saved-posts`),
  banProfileView: (userId: string | number, banned: boolean, reason = '') =>
    api.patch(`/users/${userId}/profile-ban`, { banned, reason }),
  getProfileBans: ({ page = 1, limit = 20 } = {}) =>
    api.get(`/users/profile-bans${toQueryString({ page, limit })}`),
};

export const passwordApi = {
  forgotPassword: (email: string) => api.post('/password/forgot', { email }),
  resetPassword: (email: string, code: string, newPassword: string) =>
    api.post('/password/reset', { email, code, newPassword }),
};

export const profileupdateAPI = {
  updateProfile: (data: Record<string, unknown>) => api.patch('/update/profile', data),
  deleteAccount: (reason: string) => api.delete('/users/me', { data: { reason } }),
};

export const ratingAPI = {
  ratePost: (postId: string | number, rating: number) =>
    api.post('/rating/rate', { post_id: postId, rating }),
  getPostRating: (postId: string | number) => api.get(`/rating/getRate/${postId}`),
};

export const avatarAPI = {
  save: (config: Record<string, unknown>) => api.post('/avatar/save', { config }),
  get: () => api.get('/avatar/get'),
  getByUserId: (userId: string | number) => api.get(`/avatar/user/${userId}`),
  uploadPhoto: (file: { uri: string; name: string; type: string }) => {
    const fd = new FormData();
    fd.append('photo', file as unknown as Blob);
    return api.post('/avatar/photo', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  deletePhoto: () => api.delete('/avatar/photo'),
  setDisplayMode: (display_mode: string) => api.patch('/avatar/display-mode', { display_mode }),
};

export const notificationAPI = {
  getActive: (category = '') => {
    const params = category ? `?category=${encodeURIComponent(category)}` : '';
    return api.get(`/notifications/active${params}`);
  },
  getAll: (category = '') => {
    const params = category ? `?category=${encodeURIComponent(category)}` : '';
    return api.get(`/notifications/all${params}`);
  },
  markViewed: (id: string | number) => api.post(`/notifications/${id}/view`),
  getCategories: () => api.get('/notifications/categories'),
  createCategory: (data: Record<string, unknown>) => api.post('/notifications/categories', data),
  toggleCategory: (id: string | number, is_active: boolean) =>
    api.patch(`/notifications/categories/${id}/toggle`, { is_active }),
  create: (formData: FormData) =>
    api.post('/notifications', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  adminList: ({ page = 1, limit = 20 } = {}) =>
    api.get(`/notifications${toQueryString({ page, limit })}`),
  toggle: (id: string | number, is_active: boolean) =>
    api.patch(`/notifications/${id}/toggle`, { is_active }),
  delete: (id: string | number) => api.delete(`/notifications/${id}`),
  getViewers: (id: string | number, page = 1, limit = 20) =>
    api.get(`/notifications/${id}/viewers?page=${page}&limit=${limit}`),
  approve: (id: string | number) => api.patch(`/notifications/${id}/approve`),
  reject: (id: string | number) => api.patch(`/notifications/${id}/reject`),
};

export const userNotificationAPI = {
  getAll: ({ page = 1, limit = 20 } = {}) =>
    api.get(`/user-notifications${toQueryString({ page, limit })}`),
  getUnreadCount: () => api.get('/user-notifications/unread-count'),
  markAllRead: () => api.post('/user-notifications/mark-all-read'),
};

export const commentAPI = {
  getByPost: (postId: string | number, page = 1) =>
    api.get(`/comments/post/${postId}?page=${page}`),
  create: ({ post_id, content, rating }: { post_id: string | number; content?: string; rating?: number }) =>
    api.post('/comments', { post_id, content, rating }),
  delete: (commentId: string | number, delete_reason = '') =>
    api.delete(`/comments/${commentId}`, { data: { delete_reason } }),
  update: (commentId: string | number, { content, rating }: { content?: string; rating?: number }) =>
    api.patch(`/comments/${commentId}`, { content, rating }),
};

export const adminCommentAPI = {
  getAll: ({ page = 1, limit = 20, search = '' } = {}) =>
    api.get(`/comments/admin/all${toQueryString({ page, limit, search })}`),
  getByPost: (postId: string | number) => api.get(`/comments/admin/post/${postId}`),
  restore: (commentId: string | number) => api.put(`/comments/admin/${commentId}/restore`),
  delete: (commentId: string | number, delete_reason = '') =>
    api.delete(`/comments/${commentId}`, { data: { delete_reason } }),
};

export const aktsAPI = {
  getAll: () => api.get('/akts'),
  save: (data: Record<string, unknown>) => api.post('/akts', data),
  update: (id: string | number, data: Record<string, unknown>) => api.put(`/akts/${id}`, data),
  delete: (id: string | number) => api.delete(`/akts/${id}`),
  adminList: ({ page = 1, limit = 20, search = '' } = {}) =>
    api.get(`/akts/admin${toQueryString({ page, limit, search })}`),
};

export const checklistAPI = {
  getAll: () => api.get('/checklists'),
  getMine: () => api.get('/checklists/mine'),
  setItemState: (itemId: string | number, checked: boolean) =>
    api.put(`/checklists/items/${itemId}/state`, { checked }),
  create: (data: Record<string, unknown>) => api.post('/checklists', data),
  adminList: ({ page = 1, limit = 20, search = '', type = '' } = {}) =>
    api.get(`/checklists/admin${toQueryString({ page, limit, search, type })}`),
  updateApproval: (id: string | number, status: string) => api.patch(`/checklists/${id}/approval`, { status }),
  update: (id: string | number, data: Record<string, unknown>) => api.patch(`/checklists/${id}`, data),
  toggle: (id: string | number, is_active: boolean) => api.patch(`/checklists/${id}/toggle`, { is_active }),
  delete: (id: string | number) => api.delete(`/checklists/${id}`),
  addItem: (checklistId: string | number, data: Record<string, unknown>) =>
    api.post(`/checklists/${checklistId}/items`, data),
  updateItem: (itemId: string | number, data: Record<string, unknown>) =>
    api.patch(`/checklists/items/${itemId}`, data),
  deleteItem: (itemId: string | number) => api.delete(`/checklists/items/${itemId}`),
  reorderItems: (checklistId: string | number, orderedIds: Array<string | number>) =>
    api.patch(`/checklists/${checklistId}/items/reorder`, { orderedIds }),
  getCompleters: (id: string | number, page = 1, limit = 20) =>
    api.get(`/checklists/${id}/completers${toQueryString({ page, limit })}`),
};

export const menuAPI = {
  getToday: () => api.get('/menu/today'),
  getWeek: () => api.get('/menu/week'),
  getMonth: (year: number, month: number) => api.get(`/menu/month?year=${year}&month=${month}`),
  adminStatus: () => api.get('/menu/status'),
  adminScrape: (date = '') => api.post(`/menu/scrape${date ? `?date=${date}` : ''}`),
  adminScrapeWeek: () => api.post('/menu/scrape?range=week'),
  adminScrapeMonth: (year: number, month: number) =>
    api.post(`/menu/scrape?range=month&year=${year}&month=${month}`),
};

export const badgeAPI = {
  getMine: () => api.get('/badges/me'),
  getByUser: (userId: string | number) => api.get(`/badges/user/${userId}`),
  setVisibility: (badgeId: string | number, is_visible: boolean) =>
    api.patch(`/badges/mine/${badgeId}/visibility`, { is_visible }),
  adminList: ({ page = 1, limit = 20 } = {}) => api.get(`/badges${toQueryString({ page, limit })}`),
  create: (formData: FormData) =>
    api.post('/badges', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  update: (id: string | number, formData: FormData) =>
    api.patch(`/badges/${id}`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  toggle: (id: string | number, is_active: boolean) => api.patch(`/badges/${id}/toggle`, { is_active }),
  delete: (id: string | number) => api.delete(`/badges/${id}`),
  getRecipients: (id: string | number, page = 1, limit = 20) =>
    api.get(`/badges/${id}/recipients${toQueryString({ page, limit })}`),
  assign: (badgeId: string | number, userId: string | number) =>
    api.post(`/badges/${badgeId}/assign`, { userId }),
  revoke: (badgeId: string | number, userId: string | number) =>
    api.delete(`/badges/${badgeId}/assign/${userId}`),
  approve: (id: string | number) => api.patch(`/badges/${id}/approve`),
  reject: (id: string | number) => api.patch(`/badges/${id}/reject`),
  getAuditLog: (page = 1, limit = 30) => api.get(`/badges/audit-log${toQueryString({ page, limit })}`),
};

export const statsAPI = {
  getAdminStats: (range = '7d') => api.get(`/stats/admin${toQueryString({ range })}`),
};

export const leaderboardAPI = {
  get: (sort = 'streak') => api.get(`/leaderboard${toQueryString({ sort })}`),
};

export const feedbackAPI = {
  send: ({ name, email, message }: { name: string; email: string; message: string }) =>
    api.post('/feedback', { name, email, message }),
};

export const faqAPI = {
  getAll: ({ page = 1, limit = 20 } = {}) => api.get(`/faq${toQueryString({ page, limit })}`),
  getById: (id: string | number) => api.get(`/faq/${id}`),
  getComments: (id: string | number, page = 1, limit = 50) =>
    api.get(`/faq/${id}/comments${toQueryString({ page, limit })}`),
  addComment: (id: string | number, content: string, parentCommentId: string | number | null = null) =>
    api.post(`/faq/${id}/comments`, { content, parent_comment_id: parentCommentId }),
  deleteComment: (commentId: string | number, reason: string) =>
    api.delete(`/faq/comments/${commentId}`, { data: { reason } }),
  voteAnswer: (id: string | number, vote: number) => api.post(`/faq/${id}/vote`, { vote }),
  voteComment: (commentId: string | number, vote: number) => api.post(`/faq/comments/${commentId}/vote`, { vote }),
  askQuestion: (question: string) => api.post('/faq/ask', { question }),
  getUserActivity: (userId: string | number) => api.get(`/faq/activity/${userId}`),
  adminList: ({ page = 1, limit = 20 } = {}) => api.get(`/faq/admin/all${toQueryString({ page, limit })}`),
  create: (data: Record<string, unknown>) => api.post('/faq', data),
  update: (id: string | number, data: Record<string, unknown>) => api.patch(`/faq/${id}`, data),
  setActive: (id: string | number, is_active: boolean) => api.patch(`/faq/${id}/active`, { is_active }),
  setStatus: (id: string | number, status: string) => api.patch(`/faq/${id}/status`, { status }),
  delete: (id: string | number) => api.delete(`/faq/${id}`),
};

export const suggestionAPI = {
  getAll: ({ page = 1, limit = 20 } = {}) => api.get(`/suggestions${toQueryString({ page, limit })}`),
  getById: (id: string | number) => api.get(`/suggestions/${id}`),
  getComments: (id: string | number, page = 1, limit = 50) =>
    api.get(`/suggestions/${id}/comments${toQueryString({ page, limit })}`),
  addComment: (id: string | number, content: string, parentCommentId: string | number | null = null) =>
    api.post(`/suggestions/${id}/comments`, { content, parent_comment_id: parentCommentId }),
  deleteComment: (commentId: string | number, reason: string) =>
    api.delete(`/suggestions/comments/${commentId}`, { data: { reason } }),
  voteComment: (commentId: string | number, vote: number) =>
    api.post(`/suggestions/comments/${commentId}/vote`, { vote }),
  create: (content: string) => api.post('/suggestions', { content }),
  getUserActivity: (userId: string | number) => api.get(`/suggestions/activity/${userId}`),
  adminList: ({ page = 1, limit = 20 } = {}) => api.get(`/suggestions/admin/all${toQueryString({ page, limit })}`),
  markReviewed: (id: string | number, is_reviewed: boolean) =>
    api.patch(`/suggestions/${id}/reviewed`, { is_reviewed }),
  setActive: (id: string | number, is_active: boolean) => api.patch(`/suggestions/${id}/active`, { is_active }),
};

export const adAPI = {
  getActive: () => api.get('/ads/active'),
  adminList: ({ page = 1, limit = 20 } = {}) => api.get(`/ads${toQueryString({ page, limit })}`),
  create: (formData: FormData) =>
    api.post('/ads', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  update: (id: string | number, data: Record<string, unknown>) => api.patch(`/ads/${id}`, data),
  activate: (id: string | number) => api.patch(`/ads/${id}/activate`),
  deactivate: (id: string | number) => api.patch(`/ads/${id}/deactivate`),
  delete: (id: string | number) => api.delete(`/ads/${id}`),
  getLog: (id: string | number, page = 1, limit = 20) =>
    api.get(`/ads/${id}/log${toQueryString({ page, limit })}`),
};

export const departmentFollowAPI = {
  follow: (faculty: string, department: string) =>
    api.post('/department-follows', { faculty, department }),
  unfollow: (faculty: string, department: string) =>
    api.delete('/department-follows', { data: { faculty, department } }),
  getMine: () => api.get('/department-follows/mine'),
  getStatus: (faculty: string, department: string) =>
    api.get(`/department-follows/status${toQueryString({ faculty, department })}`),
};

export const noteRequestAPI = {
  getAll: ({ page = 1, limit = 10, faculty = '', department = '', status = 'open', sort = '' } = {}) =>
    api.get(`/note-requests${toQueryString({ page, limit, faculty, department, status, sort })}`),
  getMine: () => api.get('/note-requests/mine'),
  create: (data: Record<string, unknown>) => api.post('/note-requests', data),
  fulfill: (id: string | number, post_id: string | number) =>
    api.post(`/note-requests/${id}/fulfill`, { post_id }),
  support: (id: string | number) => api.post(`/note-requests/${id}/support`),
  unsupport: (id: string | number) => api.delete(`/note-requests/${id}/support`),
  reopen: (id: string | number) => api.post(`/note-requests/${id}/reopen`),
  close: (id: string | number) => api.patch(`/note-requests/${id}/close`),
  delete: (id: string | number) => api.delete(`/note-requests/${id}`),
};

export const scheduleAPI = {
  getMine: () => api.get('/schedule/me'),
  save: (courses: unknown[]) => api.put('/schedule/me', { courses }),
  setShare: (enabled: boolean) => api.post('/schedule/share', { enabled }),
  getPublic: (shareId: string) => api.get(`/schedule/public/${encodeURIComponent(shareId)}`),
  adminList: ({ page = 1, limit = 20, search = '' } = {}) =>
    api.get(`/schedule/admin${toQueryString({ page, limit, search })}`),
};

export const usefulnessSurveyAPI = {
  getStatus: () => api.get('/usefulness-survey/status'),
  submit: (isUseful: boolean) => api.post('/usefulness-survey', { isUseful }),
  getStats: () => api.get('/usefulness-survey/stats'),
  getResponses: ({ isUseful, page = 1, limit = 20 }: { isUseful?: boolean; page?: number; limit?: number } = {}) =>
    api.get(`/usefulness-survey/responses${toQueryString({ isUseful, page, limit })}`),
};

export const onboardingGateAPI = {
  complete: ({ faculty, department, kvkkConsent }: { faculty: string; department: string; kvkkConsent: boolean }) =>
    api.post('/onboarding', { faculty, department, kvkkConsent }),
};

export const transcriptAPI = {
  upload: (file: { uri: string; name: string; type: string }) => {
    const formData = new FormData();
    formData.append('transcript', file as unknown as Blob);
    return api.post('/transcripts', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  adminList: ({ page = 1, limit = 20 } = {}) => api.get(`/transcripts/admin${toQueryString({ page, limit })}`),
  downloadUrl: (id: string | number) => `${API_URL}/transcripts/admin/${id}/download`,
};

export default api;
