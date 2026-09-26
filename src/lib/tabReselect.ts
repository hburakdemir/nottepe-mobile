// Zaten seçili olan sekmeye tekrar basıldığında haber veriyor (authEvents.ts ile
// aynı desen). Tab bar Tab.Navigator'ın `tabBar` yuvasında DEĞİL, onun kardeşi
// olarak çizildiği için (bkz. MainTabsScreen.tsx) React Navigation'ın
// `tabPress` olayı ve `useScrollToTop` burada hiç tetiklenmiyor — o yüzden
// ayrı bir kanal.
type Listener = (routeName: string) => void;

const listeners = new Set<Listener>();

export function onTabReselect(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function emitTabReselect(routeName: string): void {
  listeners.forEach((listener) => listener(routeName));
}
