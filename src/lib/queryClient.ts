import { QueryClient } from '@tanstack/react-query';

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
      refetchOnWindowFocus: false,
    },
  },
});
