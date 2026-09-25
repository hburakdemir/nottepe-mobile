import axios from 'axios';
import { API_URL } from './config';
import { getAccessToken, setAccessToken, clearAccessToken, getRefreshToken, clearRefreshToken } from './tokenStore';
import { emitSessionExpired } from './authEvents';

const ADMIN_POSTS_PAGE_LIMIT = 10;

/** `POST /user-notifications/devices` gövdesi. */
export interface PushDeviceRegistration {
  token: string;
  /** İleride bare FCM'e geçilirse şema göçü gerekmesin diye taşınıyor (plan 3.1). */
  provider: 'expo' | 'fcm';
  platform: 'android' | 'ios';
  app_version?: string;
  os_version?: string;
  device_name?: string;
  locale?: string;
}

/** `GET/PATCH /user-notifications/preferences` cevabı — ikisi de aynı tam gövdeyi döndürür. */
export interface PushPreferences {
  push_enabled: boolean;
  /** Yalnızca kullanıcının açıkça ayarladığı anahtarlar; eksikler `default`a düşer. */
  types: Record<string, boolean>;
  /** Günlük yemekhane menüsü bildiriminin saati (0-23, varsayılan 10). */
  cafeteria_notify_hour: number;
  /**
   * Hangi tiplerin var olduğunun TEK yetkili kaynağı — sıra, grup ve varsayılan dahil.
   * Yeni cron tipi eklemek = bir backend satırı, sıfır uygulama sürümü (plan 3.4).
   */
  available_types: PushTypeDescriptor[];
}

export interface PushTypeDescriptor {
  key: string;
  label: string;
  description?: string;
  group?: string;
  default: boolean;
}

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

const api = axios.create({
  baseURL: API_URL,
  // Eskiden timeout yoktu: bağlantı koptuğunda istek OS'nin kendi TCP
  // zaman aşımına (bazı cihazlarda 60-120 sn+) kadar askıda kalıyor, ekrandaki
  // spinner da o süre boyunca dönüyordu ("internet gittiğinde loading spinner
  // çok uzun dönüyor" şikâyeti). 12 sn sonra istek başarısız sayılır, react
  // query'nin (App.tsx) `retry: 1` ayarıyla birleşince ekran birkaç saniye
  // içinde hata/çevrimdışı durumuna düşer.
  timeout: 12000,
  headers: {
    'Content-Type': 'application/json',
    // Backend'e "cookie jar'ım yok, Bearer + refresh token akışı kullan" sinyali
    // (bkz. server/controllers/loginController.js login() dallanması).
    'X-Client-Type': 'mobile',
  },
});

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
  return code === 'ERR_CANCELED' || code === 'ECONNABORTED' || /abort|cancell?ed/i.test(msg);
}

async function clearSessionTokens() {
  await clearAccessToken();
  await clearRefreshToken();
}

// Aynı anda birden çok istek 401 alırsa hepsi aynı refresh çağrısını paylaşsın
// diye tek bir in-flight promise'ta biriktiriliyor.
let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = await getRefreshToken();
  if (!refreshToken) return null;

  try {
    const response = await axios.post(`${API_URL}/auth/refresh`, { refreshToken });
    const newAccessToken: string | undefined = response.data?.accessToken;
    if (!newAccessToken) return null;
    await setAccessToken(newAccessToken);
    return newAccessToken;
  } catch {
    return null;
  }
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (isRequestAborted(error)) {
      return Promise.reject(error);
    }

    const status = error.response?.status;
    const url: string = error.config?.url || '';
    const isAuthEndpoint =
      url.includes('/auth/login') || url.includes('/auth/register') || url.includes('/auth/logout') || url.includes('/auth/refresh');

    if (status === 401 && !isAuthEndpoint && !error.config?._retried) {
      if (!refreshPromise) {
        refreshPromise = refreshAccessToken().finally(() => {
          refreshPromise = null;
        });
      }
      const newAccessToken = await refreshPromise;

      if (newAccessToken) {
        error.config._retried = true;
        error.config.headers = {
          ...error.config.headers,
          Authorization: `Bearer ${newAccessToken}`,
        };
        return api.request(error.config);
      }

      await clearSessionTokens();
      emitSessionExpired();
    }

    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  register: (userData: Record<string, unknown>) => api.post('/auth/register', userData),
  login: (credentials: { username: string; password: string }) => api.post('/auth/login', credentials),
  logout: async () => {
    const refreshToken = await getRefreshToken();
    return api.post('/auth/mobile-logout', { refreshToken });
  },
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
  // `page` verilmezse sunucu eski davranışı koruyor (tüm liste, çıplak dizi) —
  // web istemcisi hâlâ böyle çağırıyor. `page` verildiğinde cevap
  // `{ posts, total, page, limit }` zarfına giriyor.
  getMyPosts: (opts?: { page?: number; limit?: number }) =>
    api.get(`/posts/my-posts${opts?.page ? toQueryString({ page: opts.page, limit: opts.limit ?? 20 }) : ''}`),
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
  // getMyPosts ile aynı sözleşme: `page` yoksa çıplak dizi, varsa zarf.
  getSavedPosts: (opts?: { page?: number; limit?: number }) =>
    api.get(`/saved-posts/getPost${opts?.page ? toQueryString({ page: opts.page, limit: opts.limit ?? 20 }) : ''}`),
  // Sadece id listesi — SavedPostContext "bu post kayıtlı mı?" sorusu için
  // eskiden tüm kayıtlı notları indirip id'ye düşürüyordu.
  getSavedPostIds: () => api.get('/saved-posts/ids'),
  savePost: (postId: string | number) => api.post(`/saved-posts/savePost/${postId}`),
  unsavePost: (postId: string | number) => api.delete(`/saved-posts/unsavePost/${postId}`),
};

// Profile API
export const profileAPI = {
  updateProfile: (profileData: Record<string, unknown>) => api.put('/update-profile/profile', profileData),
};

// Admin API
export const adminAPI = {
  getAllUsers: ({ limit = 50, offset = 0, q = '' } = {}) => api.get(`/users?limit=${limit}&offset=${offset}&q=${encodeURIComponent(q)}`),
  updateUserRole: (userId: string | number, role: string) => api.patch(`/users/${userId}/role`, { role }),
  updateUserEmail: (userId: string | number, emailVerified: boolean) => api.patch(`/users/${userId}/email-verification`, { emailVerified }),
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
  banProfileView: (userId: string | number, banned: boolean, reason = '') => api.patch(`/users/${userId}/profile-ban`, { banned, reason }),
  getProfileBans: ({ page = 1, limit = 20 } = {}) => api.get(`/users/profile-bans${toQueryString({ page, limit })}`),
};

export const passwordApi = {
  forgotPassword: (email: string) => api.post('/password/forgot', { email }),
  resetPassword: (email: string, code: string, newPassword: string) => api.post('/password/reset', { email, code, newPassword }),
};

export const profileupdateAPI = {
  updateProfile: (data: Record<string, unknown>) => api.patch('/update/profile', data),
  deleteAccount: (reason: string) => api.delete('/users/me', { data: { reason } }),
};

export const ratingAPI = {
  ratePost: (postId: string | number, rating: number) => api.post('/rating/rate', { post_id: postId, rating }),
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
  // Rozet sayısı için — `getActive` gibi tam duyuru gövdesini (başlık/içerik/
  // medya/oluşturan bilgisi) değil, tek bir sayı döner.
  getActiveUnreadCount: (category = '', hiddenIds: Array<string | number> = []) =>
    api.get(`/notifications/active/unread-count${toQueryString({ category, hidden: hiddenIds.join(',') })}`),
  getAll: (category = '') => {
    const params = category ? `?category=${encodeURIComponent(category)}` : '';
    return api.get(`/notifications/all${params}`);
  },
  markViewed: (id: string | number) => api.post(`/notifications/${id}/view`),
  getCategories: () => api.get('/notifications/categories'),
  createCategory: (data: Record<string, unknown>) => api.post('/notifications/categories', data),
  toggleCategory: (id: string | number, is_active: boolean) => api.patch(`/notifications/categories/${id}/toggle`, { is_active }),
  create: (formData: FormData) =>
    api.post('/notifications', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  adminList: ({ page = 1, limit = 20 } = {}) => api.get(`/notifications${toQueryString({ page, limit })}`),
  toggle: (id: string | number, is_active: boolean) => api.patch(`/notifications/${id}/toggle`, { is_active }),
  delete: (id: string | number) => api.delete(`/notifications/${id}`),
  getViewers: (id: string | number, page = 1, limit = 20) => api.get(`/notifications/${id}/viewers?page=${page}&limit=${limit}`),
  approve: (id: string | number) => api.patch(`/notifications/${id}/approve`),
  reject: (id: string | number) => api.patch(`/notifications/${id}/reject`),
};

export const userNotificationAPI = {
  getAll: ({ page = 1, limit = 20 } = {}) => api.get(`/user-notifications${toQueryString({ page, limit })}`),
  getUnreadCount: () => api.get('/user-notifications/unread-count'),
  markAllRead: () => api.post('/user-notifications/mark-all-read'),

  // --- Push ---
  // Token üzerinde idempotent upsert: aynı token başka bir kullanıcıya bağlıysa
  // sunucu YENİDEN ATAR (ortak cihazda önceki sahip bildirim almaya devam etmesin).
  registerDevice: (payload: PushDeviceRegistration) => api.post('/user-notifications/devices', payload),
  // DELETE-with-body değil: bazı proxy'ler gövdeyi sessizce düşürüyor.
  unregisterDevice: (token: string) => api.post('/user-notifications/devices/unregister', { token }),

  getPushPreferences: () => api.get('/user-notifications/preferences'),
  // `types` sunucuda shallow-merge edilir; gönderilmeyen anahtarlar korunur.
  // Cevap GET ile aynı tam gövde — istemci refetch'siz cache'i ezebilsin.
  updatePushPreferences: (payload: {
    push_enabled?: boolean;
    types?: Record<string, boolean>;
    cafeteria_notify_hour?: number;
  }) => api.patch('/user-notifications/preferences', payload),
};

export const commentAPI = {
  getByPost: (postId: string | number, page = 1) => api.get(`/comments/post/${postId}?page=${page}`),
  create: ({ post_id, content, rating }: { post_id: string | number; content?: string; rating?: number }) =>
    api.post('/comments', { post_id, content, rating }),
  delete: (commentId: string | number, delete_reason = '') => api.delete(`/comments/${commentId}`, { data: { delete_reason } }),
  update: (commentId: string | number, { content, rating }: { content?: string; rating?: number }) =>
    api.patch(`/comments/${commentId}`, { content, rating }),
};

export const adminCommentAPI = {
  getAll: ({ page = 1, limit = 20, search = '' } = {}) => api.get(`/comments/admin/all${toQueryString({ page, limit, search })}`),
  getByPost: (postId: string | number) => api.get(`/comments/admin/post/${postId}`),
  restore: (commentId: string | number) => api.put(`/comments/admin/${commentId}/restore`),
  delete: (commentId: string | number, delete_reason = '') => api.delete(`/comments/${commentId}`, { data: { delete_reason } }),
};

export const aktsAPI = {
  getAll: () => api.get('/akts'),
  getById: (id: string | number) => api.get(`/akts/${id}`),
  save: (data: Record<string, unknown>) => api.post('/akts', data),
  update: (id: string | number, data: Record<string, unknown>) => api.put(`/akts/${id}`, data),
  delete: (id: string | number) => api.delete(`/akts/${id}`),
  adminList: ({ page = 1, limit = 20, search = '' } = {}) => api.get(`/akts/admin${toQueryString({ page, limit, search })}`),
};

export const checklistAPI = {
  getAll: () => api.get('/checklists'),
  getMine: () => api.get('/checklists/mine'),
  setItemState: (itemId: string | number, checked: boolean) => api.put(`/checklists/items/${itemId}/state`, { checked }),
  create: (data: Record<string, unknown>) => api.post('/checklists', data),
  adminList: ({ page = 1, limit = 20, search = '', type = '' } = {}) =>
    api.get(`/checklists/admin${toQueryString({ page, limit, search, type })}`),
  updateApproval: (id: string | number, status: string) => api.patch(`/checklists/${id}/approval`, { status }),
  update: (id: string | number, data: Record<string, unknown>) => api.patch(`/checklists/${id}`, data),
  toggle: (id: string | number, is_active: boolean) => api.patch(`/checklists/${id}/toggle`, { is_active }),
  delete: (id: string | number) => api.delete(`/checklists/${id}`),
  addItem: (checklistId: string | number, data: Record<string, unknown>) => api.post(`/checklists/${checklistId}/items`, data),
  updateItem: (itemId: string | number, data: Record<string, unknown>) => api.patch(`/checklists/items/${itemId}`, data),
  deleteItem: (itemId: string | number) => api.delete(`/checklists/items/${itemId}`),
  reorderItems: (checklistId: string | number, orderedIds: Array<string | number>) =>
    api.patch(`/checklists/${checklistId}/items/reorder`, { orderedIds }),
  getCompleters: (id: string | number, page = 1, limit = 20) => api.get(`/checklists/${id}/completers${toQueryString({ page, limit })}`),
};

export const menuAPI = {
  getToday: () => api.get('/menu/today'),
  getWeek: () => api.get('/menu/week'),
  getMonth: (year: number, month: number) => api.get(`/menu/month?year=${year}&month=${month}`),
  adminStatus: () => api.get('/menu/status'),
  adminScrape: (date = '') => api.post(`/menu/scrape${date ? `?date=${date}` : ''}`),
  adminScrapeWeek: () => api.post('/menu/scrape?range=week'),
  adminScrapeMonth: (year: number, month: number) => api.post(`/menu/scrape?range=month&year=${year}&month=${month}`),
};

export const badgeAPI = {
  getMine: () => api.get('/badges/me'),
  getByUser: (userId: string | number) => api.get(`/badges/user/${userId}`),
  setVisibility: (badgeId: string | number, is_visible: boolean) => api.patch(`/badges/mine/${badgeId}/visibility`, { is_visible }),
  adminList: ({ page = 1, limit = 20 } = {}) => api.get(`/badges${toQueryString({ page, limit })}`),
  create: (formData: FormData) => api.post('/badges', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  update: (id: string | number, formData: FormData) =>
    api.patch(`/badges/${id}`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  toggle: (id: string | number, is_active: boolean) => api.patch(`/badges/${id}/toggle`, { is_active }),
  delete: (id: string | number) => api.delete(`/badges/${id}`),
  getRecipients: (id: string | number, page = 1, limit = 20) => api.get(`/badges/${id}/recipients${toQueryString({ page, limit })}`),
  assign: (badgeId: string | number, userId: string | number) => api.post(`/badges/${badgeId}/assign`, { userId }),
  revoke: (badgeId: string | number, userId: string | number) => api.delete(`/badges/${badgeId}/assign/${userId}`),
  approve: (id: string | number) => api.patch(`/badges/${id}/approve`),
  reject: (id: string | number) => api.patch(`/badges/${id}/reject`),
  getAuditLog: (page = 1, limit = 30) => api.get(`/badges/audit-log${toQueryString({ page, limit })}`),
};

export const statsAPI = {
  getAdminStats: (range = '7d') => api.get(`/stats/admin${toQueryString({ range })}`),
  // Menü çekmecesindeki sayaçlar — eskiden üç ayrı tam liste indirilip
  // yalnızca `.length` okunuyordu (bkz. MenuDrawerContent).
  getMine: () => api.get('/stats/me'),
};

export const leaderboardAPI = {
  get: (sort = 'streak') => api.get(`/leaderboard${toQueryString({ sort })}`),
};

export const feedbackAPI = {
  send: ({ name, email, message }: { name: string; email: string; message: string }) => api.post('/feedback', { name, email, message }),
};

export const faqAPI = {
  getAll: ({ page = 1, limit = 20 } = {}) => api.get(`/faq${toQueryString({ page, limit })}`),
  getById: (id: string | number) => api.get(`/faq/${id}`),
  getComments: (id: string | number, page = 1, limit = 50) => api.get(`/faq/${id}/comments${toQueryString({ page, limit })}`),
  addComment: (id: string | number, content: string, parentCommentId: string | number | null = null) =>
    api.post(`/faq/${id}/comments`, { content, parent_comment_id: parentCommentId }),
  deleteComment: (commentId: string | number, reason: string) => api.delete(`/faq/comments/${commentId}`, { data: { reason } }),
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
  getComments: (id: string | number, page = 1, limit = 50) => api.get(`/suggestions/${id}/comments${toQueryString({ page, limit })}`),
  addComment: (id: string | number, content: string, parentCommentId: string | number | null = null) =>
    api.post(`/suggestions/${id}/comments`, { content, parent_comment_id: parentCommentId }),
  deleteComment: (commentId: string | number, reason: string) => api.delete(`/suggestions/comments/${commentId}`, { data: { reason } }),
  voteComment: (commentId: string | number, vote: number) => api.post(`/suggestions/comments/${commentId}/vote`, { vote }),
  create: (content: string) => api.post('/suggestions', { content }),
  getUserActivity: (userId: string | number) => api.get(`/suggestions/activity/${userId}`),
  adminList: ({ page = 1, limit = 20 } = {}) => api.get(`/suggestions/admin/all${toQueryString({ page, limit })}`),
  markReviewed: (id: string | number, is_reviewed: boolean) => api.patch(`/suggestions/${id}/reviewed`, { is_reviewed }),
  setActive: (id: string | number, is_active: boolean) => api.patch(`/suggestions/${id}/active`, { is_active }),
};

export const adAPI = {
  getActive: () => api.get('/ads/active'),
  adminList: ({ page = 1, limit = 20 } = {}) => api.get(`/ads${toQueryString({ page, limit })}`),
  create: (formData: FormData) => api.post('/ads', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  update: (id: string | number, data: Record<string, unknown>) => api.patch(`/ads/${id}`, data),
  activate: (id: string | number) => api.patch(`/ads/${id}/activate`),
  deactivate: (id: string | number) => api.patch(`/ads/${id}/deactivate`),
  delete: (id: string | number) => api.delete(`/ads/${id}`),
  getLog: (id: string | number, page = 1, limit = 20) => api.get(`/ads/${id}/log${toQueryString({ page, limit })}`),
};

export const departmentFollowAPI = {
  follow: (faculty: string, department: string) => api.post('/department-follows', { faculty, department }),
  unfollow: (faculty: string, department: string) => api.delete('/department-follows', { data: { faculty, department } }),
  getMine: () => api.get('/department-follows/mine'),
  getStatus: (faculty: string, department: string) => api.get(`/department-follows/status${toQueryString({ faculty, department })}`),
};

export const noteRequestAPI = {
  getAll: ({ page = 1, limit = 10, faculty = '', department = '', status = 'open', sort = '' } = {}) =>
    api.get(`/note-requests${toQueryString({ page, limit, faculty, department, status, sort })}`),
  getMine: () => api.get('/note-requests/mine'),
  create: (data: Record<string, unknown>) => api.post('/note-requests', data),
  fulfill: (id: string | number, post_id: string | number) => api.post(`/note-requests/${id}/fulfill`, { post_id }),
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
  adminList: ({ page = 1, limit = 20, search = '' } = {}) => api.get(`/schedule/admin${toQueryString({ page, limit, search })}`),
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
