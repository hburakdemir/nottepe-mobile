import React from 'react';
import { Alert, Pressable, Share, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  clearDiagnostics,
  formatReport,
  getEntries,
  subscribeDiagnostics,
} from '../lib/diagnostics';

// GEÇİCİ TEŞHİS ROZETİ — iş bitince `diagnostics.ts` ile birlikte silinecek.
//
// Ölçümün ne işe yaradığı diagnostics.ts'in başında yazılı. Buradaki tek karar
// sonuca NASIL ulaşılacağı: cihaz USB ile bağlanamıyor, testçiler de uzakta.
// Bu yüzden rozet hem son ölçümü ekranda gösteriyor (anında geri bildirim) hem
// de dokununca tüm listeyi paylaşım menüsüne veriyor — testçi WhatsApp'tan
// metin olarak yollayabiliyor, ekran görüntüsü zorunluluğu yok.
export default function DiagnosticsBadge() {
  const insets = useSafeAreaInsets();
  const entries = React.useSyncExternalStore(subscribeDiagnostics, getEntries);

  const worst = entries.length > 0 ? Math.max(...entries.map((e) => e.blockedMs)) : 0;
  const last = entries[0];

  const handlePress = React.useCallback(() => {
    Share.share({ message: formatReport() }).catch(() => {});
  }, []);

  const handleLongPress = React.useCallback(() => {
    Alert.alert('Teşhis kayıtları', 'Tüm ölçümler silinsin mi?', [
      { text: 'Vazgeç', style: 'cancel' },
      { text: 'Sil', style: 'destructive', onPress: () => clearDiagnostics() },
    ]);
  }, []);

  return (
    <View
      pointerEvents="box-none"
      style={{ position: 'absolute', top: insets.top + 4, right: 8 }}
      // Rozet tam da "yalnızca yerleşim için var" profilinde olduğu için
      // Fabric'in view flattening'ine yem olabilir; ölçüm aracının kendisi
      // dokunuş alamamakla uğraşmasın.
      collapsable={false}
    >
      <Pressable
        onPress={handlePress}
        onLongPress={handleLongPress}
        style={{
          backgroundColor: last ? 'rgba(180,30,30,0.88)' : 'rgba(0,0,0,0.55)',
          paddingHorizontal: 8,
          paddingVertical: 4,
          borderRadius: 8,
        }}
      >
        <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>
          {last ? `${last.blockedMs}ms` : 'ölçüm yok'}
        </Text>
        {entries.length > 0 && (
          <Text style={{ color: '#fff', fontSize: 8, opacity: 0.85 }}>
            {entries.length} kayıt · en kötü {worst}ms
          </Text>
        )}
      </Pressable>
    </View>
  );
}
