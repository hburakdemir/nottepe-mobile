import type { NavigatorScreenParams } from '@react-navigation/native';

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

// WaveTabBar'ın 5 sekmesi ARTIK gerçek bir Tab.Navigator (bkz. MainTabsScreen.tsx).
// Daha önce bunlar da düz stack route'larıydı ve sekme değişimi
// `StackActions.replace` ile yapılıyordu — her geçişte ekran baştan mount olup
// bütün veriyi yeniden çekiyordu ("sayfa refresh oluyor"). Tab.Navigator
// sekmeleri mount'lu tuttuğu için geçiş artık kayarak ve veriyi tazelemeden
// oluyor; tab bar da sahnelerin KARDEŞİ olarak çizildiğinden geçiş boyunca
// yerinde sabit kalıyor.
export type MainTabParamList = {
  Home: undefined;
  Departments: undefined;
  Tools: undefined;
  CafeteriaMenu: undefined;
  // Menüdeki "Notlarım" / "Kaydettiğim Notlarım" kısayolları Profil'i ilgili
  // sekmeyle açıyor (bkz. ProfileScreen.tsx TABS, MenuDrawerContent.tsx).
  Profile: { initialTab?: 'posts' | 'saved' } | undefined;
};

// Sekmeler artık burada değil, `MainTabs` altında. Sekme adlarına gitmek için
// `navigateApp` yardımcısını kullan (bkz. navigateApp.ts) — düz
// `navigate('Home')` bilerek tip hatası veriyor.
export type RootStackParamList = {
  MainTabs: NavigatorScreenParams<MainTabParamList> | undefined;
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
  Ego130Schedule: undefined;
  Leaderboard: undefined;
  Help: undefined;
  // Web'de "/notifications" ve "/duyurular" aynı NotificationsPage'i farklı
  // initialTab ile açıyor (bkz. App.jsx) — mobilde de tek ekran, iki giriş noktası.
  Notifications: { initialTab?: 'duyurular' | 'aktivite' } | undefined;
};

// RootStackParamList'i saran tek gözlü Drawer.Navigator — menü artık ayrı bir
// stack route değil, gerçek bir çekmece (bkz. RootNavigator.tsx, PushableStack.tsx).
export type RootDrawerParamList = {
  Main: undefined;
};
