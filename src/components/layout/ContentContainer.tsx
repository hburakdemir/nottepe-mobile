import React from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { useMetrics } from '../../theme/metrics';

interface Props {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

// Telefonda tam genişlik, tablette/iPad'de içeriği ortalayıp yatayda sınırlı
// tutar — aksi hâlde tek sütunlu akışlar (gönderi listesi, profil, form
// modalları) geniş ekranda kenardan kenara uzayıp okunmaz hâle geliyordu
// (kullanıcı isteği: "tablet ve ipad appleri için TÜM HER YER responsive
// olmalı"). Tek kullanım yeri AppShell.tsx — push'lanan her ekranın içeriği
// buradan geçiyor; ek bir yere sarmalamak GEREKMİYOR.
export default function ContentContainer({ children, style }: Props) {
  const { contentMaxWidth } = useMetrics();

  return (
    <View style={[{ flex: 1, width: '100%', maxWidth: contentMaxWidth, alignSelf: 'center' }, style]}>{children}</View>
  );
}
