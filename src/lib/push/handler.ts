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
// `shouldSetBadge: false`: OS'un push payload'undaki tekil `badge` alanını
// doğrudan uygulaması isteniyordu, ama bu değer gönderim anındaki Aktivite
// VEYA Duyuru sayısını yansıtıyor — ikisinin toplamını değil. Aynı anda
// `usePushNotifications` (bkz. hooks/usePushNotifications.ts) Aktivite+Duyuru
// toplamını `setBadgeCountAsync` ile yazıyor; iki yazar aynı sayaca yarışınca
// hangisi son çalışırsa o kazanıyordu ("2 bildirim geldi, ikon 1 gösteriyor").
// Rozetin TEK kaynağı artık o birleşik efekt.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});
