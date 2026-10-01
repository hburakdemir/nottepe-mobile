import type { CoachStep } from './CoachMarks';

// İlk kullanım rehberinin metinleri tek yerde. Kimlik (`tourId`) değişirse tur
// herkese yeniden gösterilir — metin düzeltmesinde kimliği DEĞİŞTİRME.

export const HOME_TOUR_ID = 'home';
export const HOME_TOUR: CoachStep[] = [
  {
    target: 'menu',
    title: 'Menü',
    text: 'Avatarına dokunarak menüyü aç: Not İstekleri, SSS, Öneriler, Ayarlar ve daha fazlası burada.',
  },
  {
    target: 'tab-profile',
    title: 'Profilin',
    text: 'Notların, kaydettiklerin, listelerin ve AKTS hesapların profilinde.',
  },
  {
    target: 'bell',
    title: 'Bildirimler',
    text: 'Notlarına gelen yorumlar, onaylar ve duyurular burada toplanıyor.',
  },
  {
    target: 'add',
    title: 'Not paylaş',
    text: 'Ders notunu yükleyip herkesle paylaşmak için buraya dokun.',
  },
];

export const NOTIFICATIONS_TOUR_ID = 'notifications';
export const NOTIFICATIONS_TOUR: CoachStep[] = [
  {
    target: 'notification-settings',
    title: 'Bildirim ayarları',
    text: 'Hangi bildirimleri alacağını ve hangi saatlerde sessiz kalacağını buradan ayarlayabilirsin.',
    mandatory: true,
  },
];

export const PROFILE_TOUR_ID = 'profile';
export const PROFILE_TOUR: CoachStep[] = [
  {
    target: 'profile-avatar',
    title: 'Avatarın',
    text: 'Paletle kendi avatarını tasarla ya da kamerayla fotoğraf yükle.',
  },
  {
    target: 'profile-edit',
    title: 'Profilini düzenle',
    text: 'Adını, bölümünü ve profil bilgilerini buradan güncelleyebilirsin.',
  },
];
