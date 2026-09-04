import AsyncStorage from '@react-native-async-storage/async-storage';
import { TAB_ROUTE_NAMES, type AppRouteName } from '../../navigation/navigateApp';
import { navigateWhenReady } from '../../navigation/navigationRef';
import type { RootStackParamList } from '../../navigation/types';

// Bildirim gövdesindeki `data.target = {screen, params}` hedefi SUNUCU
// belirliyor — yeni bir bildirim tipi eklemek istemci sürümü gerektirmesin diye
// (bkz. plan 3.4). Bunun bedeli: gelen `screen` adı güvenilmez girdi. Doğrulanmamış
// bir adı `navigate()`'e vermek en iyi ihtimalle çökme, en kötüsünde erişilmemesi
// gereken bir ekrana açılış demek. Bu yüzden ad, aşağıdaki BEYAZ LİSTEden geçmeden
// kullanılmıyor; listede olmayan hedef sessizce düşürülüyor (yalnızca log'lanıyor).

const ROOT_ROUTE_NAMES = [
  'MainTabs',
  'AddPost',
  'PostDetail',
  'DepartmentDetail',
  'SavedPosts',
  'UserProfile',
  'Checklists',
  'AktsCalculator',
  'Schedule',
  'NoteRequests',
  'Faq',
  'FaqDetail',
  'Suggestions',
  'SuggestionDetail',
  'Ego130Schedule',
  'Leaderboard',
  'Help',
  'Notifications',
] as const satisfies readonly (keyof RootStackParamList)[];

// Liste `RootStackParamList` ile senkron kalsın: types.ts'e yeni bir route
// eklenip buraya eklenmezse aşağıdaki satır derleme hatası verir. Sessizce
// "hedef bulunamadı" diye düşen bir bildirimi hata ayıklamak çok daha pahalı.
type MissingFromWhitelist = Exclude<keyof RootStackParamList, (typeof ROOT_ROUTE_NAMES)[number]>;
const _whitelistIsExhaustive: MissingFromWhitelist extends never ? true : never = true;
void _whitelistIsExhaustive;

const ALLOWED_SCREENS: ReadonlySet<string> = new Set<string>([...ROOT_ROUTE_NAMES, ...TAB_ROUTE_NAMES]);

export interface PushTarget {
  screen: AppRouteName;
  params?: Record<string, unknown>;
}

/**
 * Bildirim `data`'sından hedefi çıkarır; geçersizse `null`.
 * Bilinçli olarak fırlatmıyor — bozuk bir payload yüzünden bildirim dokunuşunun
 * uygulamayı çökertmesi kabul edilebilir değil.
 */
export function parsePushTarget(data: unknown): PushTarget | null {
  if (!data || typeof data !== 'object') return null;
  const target = (data as { target?: unknown }).target;
  if (!target || typeof target !== 'object') return null;

  const screen = (target as { screen?: unknown }).screen;
  if (typeof screen !== 'string' || !ALLOWED_SCREENS.has(screen)) {
    if (__DEV__) console.warn('[push] Beyaz listede olmayan hedef düşürüldü:', screen);
    return null;
  }

  const rawParams = (target as { params?: unknown }).params;
  const params = rawParams && typeof rawParams === 'object' && !Array.isArray(rawParams)
    ? (rawParams as Record<string, unknown>)
    : undefined;

  return { screen: screen as AppRouteName, params };
}

export function openPushTarget(target: PushTarget): void {
  navigateWhenReady(target.screen, target.params);
}

// --- Çıkışken dokunulan bildirimin hedefi ---
//
// Kullanıcı çıkış yapmışken bildirime dokunursa hedef route ağaçta HİÇ yok
// (RootNavigator o dalda AuthNavigator'ı çiziyor) — `navigate` fırlatır. Hedefi
// diske yazıp girişten sonra boşaltıyoruz; aksi hâlde kullanıcı giriş yapar ve
// neden bildirime tıkladığını unutmuş şekilde ana sayfada kalır.
const PENDING_TARGET_KEY = 'nottepe_pending_push_target';

export async function savePendingPushTarget(target: PushTarget): Promise<void> {
  try {
    await AsyncStorage.setItem(PENDING_TARGET_KEY, JSON.stringify(target));
  } catch {
    /* hedefi saklayamamak bildirim akışını bozmamalı */
  }
}

/** Okur ve SİLER — bekleyen hedef yalnızca bir kez tüketilmeli. */
export async function takePendingPushTarget(): Promise<PushTarget | null> {
  try {
    const raw = await AsyncStorage.getItem(PENDING_TARGET_KEY);
    if (!raw) return null;
    await AsyncStorage.removeItem(PENDING_TARGET_KEY);
    // Diskte bekleyen hedef de doğrulamadan geçiyor: yazıldığı sürümde geçerli
    // olan bir route adı, güncellenmiş uygulamada kaldırılmış olabilir.
    return parsePushTarget({ target: JSON.parse(raw) });
  } catch {
    return null;
  }
}
