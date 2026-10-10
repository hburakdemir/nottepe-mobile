import { useCallback, useRef, useState } from 'react';

// Aşağı çekerek yenileme. Spinner YALNIZCA elle çekince dönüyor — react-query'nin
// `isRefetching`'ine bağlanırsa odak/aralık tazelemelerinde de beliriyor
// (bkz. HomeScreen: "her dönüşte üstte loading dönüyor" şikâyeti).
export function usePullRefresh(refresh: () => unknown) {
  const [refreshing, setRefreshing] = useState(false);
  const fn = useRef(refresh);
  fn.current = refresh;
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await fn.current();
    } catch {
      // Hata ekranın kendi durumunda (StateView vb.) görünüyor.
    } finally {
      setRefreshing(false);
    }
  }, []);
  return { refreshing, onRefresh };
}
