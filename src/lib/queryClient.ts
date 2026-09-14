import { AppState, Platform } from 'react-native';
import { QueryClient, focusManager } from '@tanstack/react-query';

// react-query'nin "pencere odağa geldi" algılaması TARAYICI içindir:
// `window.addEventListener('visibilitychange')` dinler. React Native'de öyle
// bir olay yok, dolayısıyla `refetchOnWindowFocus: true` yazan her sorgu
// SESSİZCE hiçbir şey yapmıyordu (bkz. useUnreadNotifications ve
// useUnreadAnnouncements — ikisi de bunu açık istemişti, ikisi de çalışmıyordu:
// rozetler yalnızca 5 dakikalık poll ile tazeleniyordu).
//
// Resmi çözüm, odak kaynağını AppState'e bağlamak (TanStack RN rehberi).
// Web'de dokunmuyoruz: orada kendi varsayılanı zaten doğru çalışıyor.
if (Platform.OS !== 'web') {
  focusManager.setEventListener((handleFocus) => {
    const sub = AppState.addEventListener('change', (state) => handleFocus(state === 'active'));
    return () => sub.remove();
  });
}

// Tekil örnek: App.tsx'teki QueryClientProvider VE AuthContext (çıkışta cache
// temizlemek için) aynı örneğe ihtiyaç duyuyor. Öncesinde yalnız App.tsx'te
// modül seviyesinde tanımlıydı ve dışa açılmıyordu — çıkışta hiçbir yerden
// erişilemediği için hesap değişince eski hesabın verisi (avatar dahil) bir
// süre ekranda kalıyordu (bkz. AuthContext.tsx clearSession).
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      // Varsayılan KAPALI ve öyle kalmalı: yukarıdaki focusManager bağlandıktan
      // sonra bu `true` olsaydı, uygulama her öne geldiğinde TÜM sorgular aynı
      // anda yeniden istek atardı — donmanın en kırılgan olduğu an tam da o.
      // Açık isteyen tek tek açıyor (şu an yalnız iki okunmamış-sayacı).
      refetchOnWindowFocus: false,
    },
  },
});
