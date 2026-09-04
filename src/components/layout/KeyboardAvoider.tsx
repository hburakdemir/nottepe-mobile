import React from 'react';
import { KeyboardAvoidingView, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

// Klavye açıldığında hiçbir sayfa yukarı itilmiyordu. Sebep: Expo SDK 54'te
// Android edge-to-edge zorunlu; bu modda pencere artık `adjustResize` ile
// KÜÇÜLMÜYOR (sistem klavye yüksekliğini yalnızca WindowInsets olarak
// bildiriyor), dolayısıyla manifest'teki adjustResize tek başına bir şey
// yapmıyor. Auth ekranlarındaki KeyboardAvoidingView'lar da
// `behavior={ios ? 'padding' : undefined}` kullandığı için Android'de hiçbir
// davranışa bağlı değildi.
//
// `behavior="padding"` her iki platformda da doğru: RN'in KeyboardAvoidingView'ı
// klavye çerçevesini EKRAN koordinatlarında ölçüp kendi alt kenarıyla
// karşılaştırıyor. Pencere gerçekten küçülen bir ortamda çalışırsak (ör.
// edge-to-edge'siz bir derleme) bu fark zaten 0 çıkıyor ve ikinci kez
// itmiyor — yani çift telafi riski yok.
export default function KeyboardAvoider({
  children,
  style,
  keyboardVerticalOffset,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  keyboardVerticalOffset?: number;
}) {
  return (
    <KeyboardAvoidingView behavior="padding" keyboardVerticalOffset={keyboardVerticalOffset} style={[styles.fill, style]}>
      {children}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
