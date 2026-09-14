import { useEffect, useState } from 'react';

// Kullanıcı isteği: "internet hızı yeterliyse loading spinner ya da skeleton
// olmamalı asla." `isLoading` DOĞRUDAN iskeleti tetiklemiyor — veri bu kadar
// sürede (`delayMs`) gelirse iskelet HİÇ ekrana girmiyor, yalnızca yükleme
// gerçekten bu süreden UZUN sürerse gösteriliyor.
//
// Sebep: 150-200ms'lik bir yüklemede iskelet gösterip hemen kaldırmak,
// gösterMEMEKTEN daha kötü bir his veriyor — göz "bir şey değişti" diye
// yakalıyor ama içerik henüz okunmadan kayboluyor, bu da tam olarak
// testçilerin "iğrenç" dediği türden bir kırpışma. Hızlı bağlantıda kullanıcı
// hiçbir yükleme durumu görmemeli; yavaş bağlantıda ise gecikme kullanıcının
// fark edeceği eşiğin (~200ms) altında kaldığı için "geç kalan" bir his
// vermiyor.
//
// 200ms seçildi: insan gözü ~100ms'nin altını "anında" algılıyor, ~300ms
// üstünü "bekleme" olarak kodluyor; ikisi arasında güvenli bir orta nokta.
const DEFAULT_DELAY_MS = 200;

export function useDelayedLoading(isLoading: boolean, delayMs: number = DEFAULT_DELAY_MS): boolean {
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (!isLoading) {
      // Veri geldi (ya da hiç gelmemiş, henüz istek yok) — iskelet varsa
      // hemen insin, "içerik göründü ama arkada bir iskelet takılı kaldı"
      // diye bir durum olmasın.
      setShown(false);
      return;
    }
    const id = setTimeout(() => setShown(true), delayMs);
    return () => clearTimeout(id);
  }, [isLoading, delayMs]);

  return shown;
}
