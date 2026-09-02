// Uygulama genelindeki tek font tanımı. Değiştirmek için sadece bu satırı
// güncelle, tüm ekranlardaki Text/TextInput otomatik güncellenir (bkz.
// applyGlobalFont.ts). Inter/Roboto/Noto Sans karşılaştırması sonrası önce
// Inter seçilmişti, sonra kalıcı seçim Sora'ya değişti — App.tsx sadece bu
// ailenin ağırlıklarını yüklüyor.
//
// undefined verirsen platformun sistem fontuna (Android: Roboto, iOS: San
// Francisco) döner. Başka bir Google Font denemek istersen: önce
// `npx expo install @expo-google-fonts/<isim>` ile kur, App.tsx'teki
// useSoraFonts çağrısını o ailenin ağırlıklarıyla değiştir, sonra buraya adını yaz.
export const APP_FONT_FAMILY: string | undefined = 'Sora_400Regular';
