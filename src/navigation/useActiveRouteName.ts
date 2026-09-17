import { useNavigationState, type NavigationState, type PartialState } from '@react-navigation/native';

type AnyState = NavigationState | PartialState<NavigationState> | undefined;

// En derindeki odaklı route'un adı. React Navigation iç içe navigator'ların
// durumunu üst navigator'ın route nesnesinde (`route.state`) taşıdığı için
// (kütüphanenin kendi `getFocusedRouteNameFromRoute`'unun dayandığı davranış),
// üstten aşağı inerek gerçek ekranı bulabiliyoruz. AppHeader başlığı buna
// bakıyor: `MainTabs` değil, o an açık olan sekme/ekran yazsın diye.
export interface ActiveRoute {
  name: string;
  params?: Record<string, unknown>;
}

export function getActiveRoute(state: AnyState): ActiveRoute | undefined {
  if (!state || !state.routes?.length) return undefined;
  const route = state.routes[state.index ?? state.routes.length - 1];
  if (!route) return undefined;
  if (route.state) return getActiveRoute(route.state as AnyState) ?? { name: route.name, params: route.params as any };
  return { name: route.name, params: route.params as Record<string, unknown> | undefined };
}

export function getActiveRouteName(state: AnyState): string | undefined {
  return getActiveRoute(state)?.name;
}

export function useActiveRouteName(): string | undefined {
  return useNavigationState(getActiveRouteName);
}

// Başlık bazı ekranlarda route ADINDAN değil PARAMETRESİNDEN geliyor (ör. bir
// başkasının profilinde "Profil" değil kullanıcı adı yazıyor). Bunun için
// route'un TAMAMINI döndüren bir `useActiveRoute()` vardı; KALDIRILDI.
//
// ⚠️ SEBEBİ ÖNEMLİ, geri eklenmesin: `useNavigationState` her navigasyon
// commit'inde `Object.is(son değer, selector(state))` karşılaştırıyor
// (useNavigationState.tsx ~53) ve eşit değilse `forceUpdate()` çağırıyor.
// `getActiveRoute` her çağrıda YENİ BİR NESNE döndürdüğü için bu karşılaştırma
// HİÇBİR ZAMAN tutmuyordu: mount'lu her `AppHeader`, rota gerçekten değişmese
// bile her navigasyon commit'inde zorla yeniden render oluyordu. Bar hem
// `MainTabsScreen`'de kalıcı hem push edilen her ekranda ayrıca duruyor, yani
// bedel her gezinmede birden fazla kez ödeniyordu.
//
// Çözüm, seçiciyi İLKEL değer döndürmeye zorlamak — o zaman `Object.is`
// çalışıyor ve değer değişmedikçe render olmuyor. Route'un tamamı yerine
// ihtiyaç duyulan tek parametre okunuyor.
export function useActiveRouteParam(key: string): string | undefined {
  return useNavigationState((state) => {
    const value = getActiveRoute(state)?.params?.[key];
    return typeof value === 'string' ? value : undefined;
  });
}
