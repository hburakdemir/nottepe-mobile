import 'react-native-gesture-handler';
import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './src/context/AuthContext';
import { SavedPostsProvider } from './src/context/SavedPostContext';
import { NetworkProvider } from './src/context/NetworkContext';
import OfflineBanner from './src/components/OfflineBanner';
import RootNavigator from './src/navigation/RootNavigator';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // İnternet yokken başarısız isteği sonsuza kadar yeniden denemesin;
      // axios'un timeout'u (bkz. src/lib/api.ts) zaten isteği düşürüyor,
      // burada da az sayıda denemeden sonra isError'a düşsün.
      retry: 2,
    },
  },
});

export default function App() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <NetworkProvider>
          <AuthProvider>
            <SavedPostsProvider>
              <NavigationContainer>
                <RootNavigator />
                <OfflineBanner />
                <StatusBar style="auto" />
              </NavigationContainer>
            </SavedPostsProvider>
          </AuthProvider>
        </NetworkProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
