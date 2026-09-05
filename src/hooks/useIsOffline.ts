import { useNetworkState } from 'expo-network';

// `isConnected` cihazın aktif bir ağ arayüzüne (wifi/hücresel) sahip olup
// olmadığını söylüyor — `isInternetReachable` ilk okumada genelde `undefined`
// olduğu için (henüz doğrulanmadı) onu bekletmek soğuk açılışta gereksiz bir
// "çevrimdışı" yanlış pozitifine yol açıyordu. Sadece `isConnected === false`
// kesin bir sinyal.
export function useIsOffline(): boolean {
  const { isConnected } = useNetworkState();
  return isConnected === false;
}
