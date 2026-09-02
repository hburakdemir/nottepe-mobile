import type { NativeStackNavigationOptions } from '@react-navigation/native-stack';

// WaveTabBar, bir sekmeye dokunulduğunda navigate() çağırmadan HEMEN önce
// hedefin, o an aktif olan sekmeye göre solda mı sağda mı olduğunu buraya
// yazıyor. RootNavigator'daki 4 sekme ekranının `options` fonksiyonu her
// navigasyonda yeniden çalıştığı için, push animasyonu bu değere göre
// (sağdan/soldan) yönlendirilmiş oluyor — normal bir modül değişkeni yeterli,
// state/context'e gerek yok çünkü okunuşu her zaman senkron navigate()
// çağrısından hemen sonra gerçekleşiyor.
let direction: NativeStackNavigationOptions['animation'] = 'slide_from_right';

export function setTabAnimationDirection(next: 'slide_from_left' | 'slide_from_right'): void {
  direction = next;
}

export function getTabAnimationDirection(): NativeStackNavigationOptions['animation'] {
  return direction;
}
