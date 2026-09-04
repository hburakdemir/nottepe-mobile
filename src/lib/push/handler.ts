import * as Notifications from 'expo-notifications';

// Yan etkili modül: `index.ts`'ten, `registerRootComponent`'ten ÖNCE bir kez
// import ediliyor. Handler'ın React ağacından önce kurulması şart — uygulama
// ön plandayken gelen bir bildirim, handler henüz kurulmamışsa hiç gösterilmez.
//
// ⚠️ Eski `shouldShowAlert` alanı bu sürümde deprecated ve SESSİZCE yok
// sayılıyor. Yalnızca onu döndürmek ön plan banner'ını hiç göstermez, hata da
// vermez — "push bozuk" sanılan durumun bir numaralı sebebi. Kurulu tiplerde
// `shouldShowBanner` (üstten düşen banner) ve `shouldShowList` (bildirim
// merkezindeki satır) zorunlu alanlar.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});
