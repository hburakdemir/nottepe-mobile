import { Platform } from 'react-native';
import type { NativeStackNavigationOptions } from '@react-navigation/native-stack';

// iOS'ta native-stack geçiş animasyonu `default` OLMAK ZORUNDA.
//
// Eskiden her iki navigator da `animation: 'slide_from_right'` kullanıyordu ve
// bu, iOS'ta SOL KENARI tamamen bozuyordu — üç ayrı şikâyetin ("kaydırarak geri
// gelemiyorum", "geri butonuna basılmıyor", "duyurulardaki Tümü çipine
// basılmıyor") tek ortak kök nedeni buydu. react-native-screens kaynağındaki
// zincir:
//
//  1. RNSScreenStackAnimator.mm `isCustomAnimation:` → `default` ve `flip`
//     DIŞINDAKİ her animasyona `YES` diyor; `slide_from_right` özel sayılıyor.
//  2. Özel olduğu için `animationControllerForOperation:` UIKit'e kendi
//     animatörünü veriyor (RNSScreenStack.mm ~947).
//  3. `customAnimationOnSwipe` (JS'te `animationMatchesGesture`) varsayılan
//     `false` olduğundan RNScreens KENDİ kenar tanıyıcısını
//     `gestureRecognizerShouldBegin`'de kapatıyor (~1003); geriye yalnız
//     UIKit'in yerleşik pop tanıyıcısı kalıyor.
//  4. Ama UIKit o özel animatörü interaktif sürecek denetleyiciyi sorduğunda
//     (`interactionControllerForAnimationController:`, ~1110) elde `nil` var —
//     onu yalnızca (3)'te kapatılan jest üretebiliyordu.
//
// Sonuç: kenar jesti başlıyor, sürecek geçiş yok, ekran parmağı takip etmiyor.
// Dahası aynı kod yolu jest başlarken `cancelTouchesInParent` çağırıyor
// (~975) — yani PUSH EDİLMİŞ HER EKRANDA sol kenara yakın her Pressable,
// parmak birkaç piksel kaysa dokunuşunu kaybediyordu.
//
// `default` ile `isCustomAnimation:` `NO` dönüyor, özel animatör hiç devreye
// girmiyor ve tüm etkileşimi UIKit kendi native push/pop'uyla yürütüyor.
// GÖRSEL KAYIP YOK: iOS'un varsayılan push animasyonu zaten sağdan kaymadır.
//
// Android'de bu sorun yok (dokunma dağıtımı farklı), bu yüzden oradaki görünüm
// birebir korunuyor.
export const STACK_ANIMATION: NativeStackNavigationOptions['animation'] = Platform.OS === 'ios' ? 'default' : 'slide_from_right';
