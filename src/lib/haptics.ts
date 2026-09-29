// Dokunsal geri bildirim (titreşim) — tek giriş noktası.
//
// Modül TEMBEL yükleniyor: expo-haptics native bir modül ve onu içermeyen eski
// bir dev client / APK'da `import` anında hata fırlatır. Böyle bir derlemede
// titreşim sessizce yok sayılıyor, uygulama çalışmaya devam ediyor.
//
// Ölçülü kullanım: yalnızca kullanıcının bir şeyi "yaptığı" anlar (kaydet,
// oy, gönderim başarısı, kaydırma eşiği, sekme değişimi). Liste kaydırma ve
// sıradan gezinme titreşmez.
type HapticsModule = typeof import('expo-haptics');

let mod: HapticsModule | null | undefined;
function haptics(): HapticsModule | null {
  if (mod === undefined) {
    try {
      mod = require('expo-haptics') as HapticsModule;
    } catch {
      mod = null;
    }
  }
  return mod;
}

function run(fn: (h: HapticsModule) => Promise<void>) {
  const h = haptics();
  if (!h) return;
  try {
    fn(h).catch(() => {});
  } catch {
    // native modül yok / desteklenmiyor
  }
}

/** Seçim değişimi: sekme, anahtar (Switch), oy, küçük dokunuşlar. */
export const tap = () => run((h) => h.selectionAsync());

/** Hafif darbe: kaydet/kaydı kaldır, takip et, kaydırma eşiğini geçme. */
export const impact = () => run((h) => h.impactAsync(h.ImpactFeedbackStyle.Light));

/** Belirgin darbe: tam kaydırmada işlemin tamamlanması. */
export const impactMedium = () => run((h) => h.impactAsync(h.ImpactFeedbackStyle.Medium));

/** Başarı: form gönderildi / kaydedildi. */
export const success = () => run((h) => h.notificationAsync(h.NotificationFeedbackType.Success));

/** Uyarı: silme gibi yıkıcı işlem gerçekleşti. */
export const warn = () => run((h) => h.notificationAsync(h.NotificationFeedbackType.Warning));
