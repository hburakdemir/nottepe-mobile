import React from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import {
  KeyboardAvoidingView,
  KeyboardAwareScrollView,
  type KeyboardAwareScrollViewProps,
} from 'react-native-keyboard-controller';

// Klavye açıldığında hiçbir sayfa yukarı itilmiyordu. Sebep: Expo SDK 54'te
// Android edge-to-edge zorunlu; bu modda pencere artık `adjustResize` ile
// KÜÇÜLMÜYOR (sistem klavye yüksekliğini yalnızca WindowInsets olarak
// bildiriyor), dolayısıyla manifest'teki adjustResize tek başına bir şey
// yapmıyor.
//
// ÖNCEDEN burada RN'in kendi `KeyboardAvoidingView`'ı vardı ve iki ayrı sorunu
// birden yaşıyordu:
//   1. Android'de klavye çerçevesini ölçemediği için hiç itmiyordu.
//   2. İtse bile yalnızca KONTEYNERE dolgu ekliyor; odaklanan input'u görünür
//      alana KAYDIRMIYOR. Kullanıcı şikayeti ("yazı kutusu altta kalıyorsa
//      ekranı üste kaydırmalı") tam olarak ikinci maddeydi ve dolgu eklemek
//      onu hiçbir zaman çözmezdi — ikisi farklı iş.
//
// Artık ikisi de `react-native-keyboard-controller`'dan geliyor (Expo'nun
// resmi klavye rehberinin önerdiği paket, bkz. docs.expo.dev/guides/keyboard-handling).
// Klavye yüksekliğini WindowInsets'ten okuyor, animasyonu UI thread'inde
// sürüyor ve iki platformda da aynı davranıyor.
//
// ⚠️ `KeyboardProvider` App.tsx'te ağacın tepesinde olmak ZORUNDA — yoksa bu
// bileşenlerin ikisi de sessizce hiçbir şey yapmaz.
//
// ⚠️ `app.json`'a `softwareKeyboardLayoutMode: 'pan'` EKLEME. Expo'nun rehberi
// bunu bottom-tab kullananlara öneriyor ama o öneri, bu paketi KULLANMAYAN
// projeler için. `pan` manifest'e `adjustPan` yazar; bu paket ise klavye
// insets'ine göre çalışıyor, ikisi birbiriyle kavga eder. Tab bar'ın klavye
// açıkken gizlenmesi zaten WaveTabBar'ın kendi işi.

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

// Form/yorum ekranlarının `ScrollView`'ünün yerine geçiyor: odaklanan
// `TextInput`'u klavyenin üstüne KAYDIRIR. Düz `ScrollView` ile aynı prop'ları
// alıyor, o yüzden geçiş tek satır (import + etiket adı).
//
// `bottomOffset`: input ile klavyenin üst kenarı arasında bırakılan boşluk.
// 24 seçildi — imleç klavyeye yapışık durmuyor ama gereksiz yere de fazla
// kaydırmıyor. Tek yerden değiştirilebilsin diye burada sabit.
const DEFAULT_BOTTOM_OFFSET = 24;

//
// `ref` iletiliyor: kayıt ekranı hata olunca `scrollTo({ y: 0 })` ile başa
// dönüyor (bkz. RegisterScreen).
export const KeyboardAwareScroll = React.forwardRef<
  React.ElementRef<typeof KeyboardAwareScrollView>,
  KeyboardAwareScrollViewProps
>(function KeyboardAwareScroll({ children, bottomOffset = DEFAULT_BOTTOM_OFFSET, ...rest }, ref) {
  return (
    <KeyboardAwareScrollView ref={ref} bottomOffset={bottomOffset} {...rest}>
      {children}
    </KeyboardAwareScrollView>
  );
});

const styles = StyleSheet.create({ fill: { flex: 1 } });
