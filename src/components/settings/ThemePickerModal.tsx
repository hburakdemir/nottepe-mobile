import React, { useEffect, useState } from 'react';
import { useTheme, type ThemePreference } from '../../context/ThemeContext';
import OptionSheet from '../layout/OptionSheet';

const THEME_OPTIONS: { key: ThemePreference; label: string }[] = [
  { key: 'system', label: 'Sistem' },
  { key: 'light', label: 'Açık' },
  { key: 'dark', label: 'Koyu' },
];

// Uygulamadaki her "listeden seç" arayüzü gibi ortak OptionSheet'ten geliyor
// (bkz. components/layout/OptionSheet.tsx) — burada eskiden kendi kopyası vardı.
//
// Tema değişimi 30sn'de bire kilitli (bkz. ThemeContext.tsx). Eskiden kilit
// süresince her tıklamada AYNI Alert tekrar tekrar açılıyordu — kullanıcı
// bunu "geri sayım yapmıyor, sadece tıklayınca tekrar açılıyor" diye tarif
// etti. Artık kilitliyken diğer seçenekler soluk/devre dışı, başlığın altında
// GERÇEKTEN saniyede bir azalan bir not var (`setInterval` + `Date.now()`,
// panel açıkken çalışır).
export default function ThemePickerModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { themePreference, setThemePreference, themeChangeLockedUntil } = useTheme();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!visible) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [visible]);

  const remainingSec = Math.max(0, Math.ceil((themeChangeLockedUntil - now) / 1000));
  const locked = remainingSec > 0;

  return (
    <OptionSheet
      visible={visible}
      title="Temayı Ayarla"
      note={locked ? `Tekrar değiştirmek için ${remainingSec} saniye bekle.` : undefined}
      disabledValues={locked ? THEME_OPTIONS.filter((o) => o.key !== themePreference).map((o) => o.key) : undefined}
      options={THEME_OPTIONS.map((o) => ({ value: o.key, label: o.label }))}
      value={themePreference}
      searchable={false}
      onSelect={(v) => setThemePreference(v as ThemePreference)}
      onClose={onClose}
    />
  );
}
