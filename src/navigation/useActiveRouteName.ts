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
// başkasının profilinde "Profil" değil kullanıcı adı yazıyor) — bu yüzden
// AppHeader adı değil route'un tamamını okuyor.
export function useActiveRoute(): ActiveRoute | undefined {
  return useNavigationState(getActiveRoute);
}
