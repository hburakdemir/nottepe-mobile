// Üst barın ortasındaki sayfa başlığı (bkz. AppHeader.tsx). Daha önce başlık
// bilinçli olarak yoktu; kullanıcı isteği üzerine geri geldi — ama tek satırlık
// AppHeader'ın İÇİNDE, ikinci bir native başlık satırı açmadan.
export const ROUTE_TITLES: Record<string, string> = {
  Home: 'Ana Sayfa',
  Departments: 'Fakülteler',
  Tools: 'Araçlar',
  CafeteriaMenu: 'Yemek Listesi',
  Profile: 'Profil',
  AddPost: 'Not Ekle',
  PostDetail: 'Gönderi',
  DepartmentDetail: 'Bölüm',
  SavedPosts: 'Kaydettiklerim',
  UserProfile: 'Profil',
  Checklists: 'Checklistler',
  AktsCalculator: 'AKTS / GANO',
  Schedule: 'Ders Programı',
  NoteRequests: 'Not İstekleri',
  Faq: 'Sizin Sorularınız',
  FaqDetail: 'Soru',
  Suggestions: 'Öneriler',
  SuggestionDetail: 'Öneri',
  Ego130Schedule: '130 Ring Saatleri',
  Leaderboard: 'Liderlik Tablosu',
  Help: 'Yardım',
  Notifications: 'Bildirimler',
  // Görüntüleyici kendi başlığını çiziyor (AppHeader orada yok), ama
  // `useActiveRouteName`'i tüketen başka yerler boş başlıkla karşılaşmasın.
  FileViewer: 'Dosya',
};

export function routeTitle(routeName?: string): string {
  if (!routeName) return '';
  return ROUTE_TITLES[routeName] ?? '';
}
