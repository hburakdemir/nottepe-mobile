export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
  VerifyEmail: { email: string };
  ForgotPassword: undefined;
  ResetPassword: { email: string };
};

export interface NoteRequestSummary {
  id: number;
  faculty: string;
  department: string;
  course_name: string;
}

// Web'de Layout.jsx her rotayı (Ana Sayfa dahil, Ekle dahil) aynı Navbar+
// MobileTabBar ile sarmalıyor — burada da tek düz stack, AppHeader/WaveTabBar
// her ekranda AppShell üzerinden sabit kalıyor (bkz. RootNavigator.tsx).
// Ayrı bir Tab.Navigator yok artık.
export type RootStackParamList = {
  Home: undefined;
  Departments: undefined;
  Tools: undefined;
  AddPost: { noteRequest?: NoteRequestSummary } | undefined;
  PostDetail: { postId: number };
  DepartmentDetail: { faculty: string; department: string };
  SavedPosts: undefined;
  UserProfile: { username: string };
  Checklists: { slug?: string } | undefined;
  AktsCalculator: { loadId?: number } | undefined;
  Schedule: undefined;
  NoteRequests: undefined;
  Faq: undefined;
  FaqDetail: { id: number };
  Suggestions: undefined;
  SuggestionDetail: { id: number };
  CafeteriaMenu: undefined;
  Leaderboard: undefined;
  Help: undefined;
  // Web'de "/notifications" ve "/duyurular" aynı NotificationsPage'i farklı
  // initialTab ile açıyor (bkz. App.jsx) — mobilde de tek ekran, iki giriş noktası.
  Notifications: { initialTab?: 'duyurular' | 'aktivite' } | undefined;
  // Menüdeki "Notlarım" / "Kaydettiğim Notlarım" kısayolları Profile'ı ilgili
  // sekmeyle açıyor (bkz. ProfileScreen.tsx TABS, MenuDrawerContent.tsx).
  Profile: { initialTab?: 'posts' | 'saved' } | undefined;
};

// RootStackParamList'i saran tek gözlü Drawer.Navigator — menü artık ayrı bir
// stack route değil, gerçek bir çekmece (bkz. RootNavigator.tsx, PushableStack.tsx).
export type RootDrawerParamList = {
  Main: undefined;
};
