import { minutesToTime, toMinutes } from '../utils/schedule';

export type Ego130DayKey = 'weekday' | 'saturday' | 'sunday';

export interface Ego130Departure {
  time: string;
  note?: string;
}

export interface Ego130Schedule {
  key: Ego130DayKey;
  label: string;
  departures: Ego130Departure[];
}

// Format: "HH:MM" ya da not varsa "HH:MM|NOT". Kaynak: EGO Genel Müdürlüğü'nün
// 130 BEYTEPE METRO İSTASYONU hattı "Servis Başlangıç Saati" tablosu (EGO
// uygulaması ekran görüntüleri, 26.09.2026). Not metinleri EGO'nunkiyle aynı;
// ekrandaki işaretler bu metinlerden kelime aramasıyla çıkıyor (bkz.
// Ego130ScheduleScreen `markersFor`).
//
// Ekran görüntüsünde yıldızlı olup notu kesik kalan seferler (hafta içi
// 07:00–07:12 arası altı sefer, Pazar 15:45) NOTSUZ yazıldı — tahmin
// edilmedi, yalnızca görselde okunan bilgi var.
const parseList = (raw: string, key: Ego130DayKey, label: string): Ego130Schedule => ({
  key,
  label,
  departures: raw
    .trim()
    .split(',')
    .map((entry) => {
      const [time, note] = entry.trim().split('|');
      return note ? { time, note } : { time };
    }),
});

const WEEKDAY_RAW = `
00:10,00:40,01:25,06:35|KÖPRÜDEN,06:36|DURAKTAN BAŞLAR,06:40|KÖPRÜDEN,06:41|DURAKTAN BAŞLAR,
06:45|KÖPRÜDEN BAŞLAR,06:46|DURAKTAN BAŞLAR,06:50|KÖPRÜDEN BAŞLAR,06:51|DURAKTAN BAŞLAR,
06:55|KÖPRÜDEN BAŞLAR,06:56|DURAKTAN BAŞLAR,07:00,07:02,07:03,07:06,07:09,07:12,
07:14|ÜCRETSİZ-KONSERV.,07:15|KÖPRÜDEN BAŞLAR,07:18|KÖPRÜDEN BAŞLAR,07:21|KÖPRÜDEN BAŞLAR,
07:24|KÖPRÜDEN BAŞLAR,07:27|KÖPRÜDEN BAŞLAR,07:30|KÖPRÜDEN BAŞLAR,07:33|KÖPRÜDEN BAŞLAR,
07:36|KÖPRÜDEN BAŞLAR,07:39|KÖPRÜDEN BAŞLAR,07:42|KÖPRÜDEN BAŞLAR,07:44|ÜCRETSİZ-KONSERV.,
07:45|KÖPRÜDEN BAŞLAR,07:48|KÖPRÜDEN BAŞLAR,07:51|KÖPRÜDEN BAŞLAR,07:54|KÖPRÜDEN BAŞLAR,
07:57|KÖPRÜDEN BAŞLAR,08:00|KÖPRÜDEN BAŞLAR,08:03|KÖPRÜDEN BAŞLAR,08:06|KÖPRÜDEN BAŞLAR,
08:09|KÖPRÜDEN BAŞLAR,08:12|KÖPRÜDEN BAŞLAR,08:15|KÖPRÜDEN BAŞLAR,08:18|KÖPRÜDEN BAŞLAR,
08:21|KÖPRÜDEN BAŞLAR,08:24|KÖPRÜDEN BAŞLAR,08:27|KÖPRÜDEN BAŞLAR,08:30|KÖPRÜDEN BAŞLAR,
08:33|KÖPRÜDEN BAŞLAR,08:36|KÖPRÜDEN BAŞLAR,08:39|KÖPRÜDEN BAŞLAR,08:42|KÖPRÜDEN BAŞLAR,
08:45|KÖPRÜDEN BAŞLAR,08:48|KÖPRÜDEN BAŞLAR,08:50|ÜCRETSİZ-KONSERV.,08:51|KÖPRÜDEN BAŞLAR,
08:54|KÖPRÜDEN BAŞLAR,08:57|KÖPRÜDEN BAŞLAR,09:00|KÖPRÜDEN BAŞLAR,09:03|KÖPRÜDEN BAŞLAR,
09:06|KÖPRÜDEN BAŞLAR,09:09|KÖPRÜDEN BAŞLAR,09:12|KÖPRÜDEN BAŞLAR,09:15|KÖPRÜDEN BAŞLAR,
09:18|KÖPRÜDEN BAŞLAR,09:21|KÖPRÜDEN BAŞLAR,09:24|KÖPRÜDEN BAŞLAR,09:27|KÖPRÜDEN BAŞLAR,
09:30|KÖPRÜDEN BAŞLAR,09:33|KÖPRÜDEN BAŞLAR,09:36|KÖPRÜDEN BAŞLAR,09:39|KÖPRÜDEN BAŞLAR,
09:42|KÖPRÜDEN BAŞLAR,09:45|KÖPRÜDEN BAŞLAR,09:48|KÖPRÜDEN BAŞLAR,09:50,09:51|KÖPRÜDEN BAŞLAR,
09:54|KÖPRÜDEN BAŞLAR,09:55|ÜCRETSİZ,09:56,09:57|KÖPRÜDEN BAŞLAR,10:00|KÖPRÜDEN BAŞLAR,10:02,
10:08,10:14,10:20,10:26,10:32,10:38,10:44,10:50,10:55|ÜCRETSİZ,10:56,11:02,11:08,11:14,11:20,
11:26,11:32,11:38,11:44,11:50,11:55|ÜCRETSİZ,11:56,12:02,12:08,12:11,12:14,12:17,12:20,12:23,
12:25|ÜCRETSİZ-KONSERV.,12:26,12:29,12:32,12:35,12:38,12:41,12:44,12:47,12:50,12:53,12:56,12:59,
13:02,13:05,13:08,13:11,13:14,13:17,13:20,13:23,13:25|ÜCRETSİZ-KONSERV.,13:26,13:29,13:32,13:35,
13:38,13:41,13:44,13:47,13:50,13:53,13:56,13:59,14:02,14:05,14:08,14:11,14:14,14:15|ÜCRETSİZ,
14:17,14:20,14:23,14:26,14:29,14:32,14:35,14:38,14:41,14:44,14:47,14:50,14:53,14:56,14:59,
15:00|ÜCRETSİZ,15:02,15:05,15:08,15:11,15:14,15:17,15:20,15:23,15:26,15:29,15:32,15:35,15:38,
15:41,15:44,15:47,15:50,15:53,15:56,15:59,16:00|ÜCRETSİZ,16:02,16:05,16:08,16:11,16:14,16:17,
16:20,16:23,16:25|ÜCRETSİZ-KONSERV.,16:26,16:29,16:32,16:35,16:38,16:41,16:44,16:47,16:50,16:53,
16:56,17:00,17:05,17:10,17:11|ÜCRETSİZ-KONSERV.,17:15,17:20,17:25,17:30,17:35,17:40,17:45,17:50,
17:55,18:00,18:05,18:10,18:11|ÜCRETSİZ-KONSERV.,18:15,18:20,18:25,18:30,18:35,18:40,18:45,18:50,
18:51|ÜCRETSİZ-KONSERV.,18:55,19:00,19:05,19:10,19:15,19:20,19:25,19:30,19:31|ÜCRETSİZ,19:38,
19:46,19:54,20:02,20:10,20:18,20:26,20:34,20:42,20:50,20:58,21:06,21:14,21:22,21:30,21:38,21:46,
21:54,22:02,22:10,22:18,22:26,22:34,22:42,22:50,22:58,23:06,23:14,23:22,
23:30|23:30 - 23:40 KÖPRÜDEN
`;

const SATURDAY_RAW = `
00:10,00:40,01:25,06:35|KÖPRÜDEN,06:41,06:45|KÖPRÜDEN-ÜCRETSİZ,06:46,06:50|KÖPRÜDEN,06:51,
07:05|KÖPRÜDEN,07:15|KÖPRÜDEN-ÜCRETSİZ,07:20|KÖPRÜDEN,07:35|KÖPRÜDEN,07:45|KÖPRÜDEN-ÜCRETSİZ,
07:50|KÖPRÜDEN,08:05|KÖPRÜDEN,08:20|KÖPRÜDEN,08:25|KÖPRÜDEN-ÜCRETSİZ,08:30|KÖPRÜDEN,
08:40|KÖPRÜDEN,08:50|KÖPRÜDEN,09:00,09:10,09:15|ÜCRETSİZ-KONSERV.,09:20,09:30,09:40,09:50,10:00,
10:05|ÜCRETSİZ,10:10,10:20,10:30,10:40,10:45|ÜCRETSİZ,10:50,11:00,11:10,11:20,11:30,
11:35|ÜCRETSİZ,11:40,11:50,12:00,12:10,12:20,12:25|ÜCRETSİZ-KONSERV.,12:30,12:40,12:50,13:00,
13:10,13:15|ÜCRETSİZ,13:20,13:30,13:40,13:50,14:00,14:05|ÜCRETSİZ,14:10,14:20,14:30,14:40,14:50,
15:00,15:05|ÜCRETSİZ,15:10,15:20,15:30,15:40,15:45|ÜCRETSİZ,15:50,16:00,16:10,16:20,16:30,
16:35|ÜCRETSİZ,16:40,16:50,17:00,17:10,17:15|ÜCRETSİZ-KONSERV.,17:20,17:30,17:40,17:50,18:00,
18:10,18:15|ÜCRETSİZ-KONSERV.,18:20,18:30,18:40,18:50,19:00,19:05|ÜCRETSİZ-KONSERV.,19:10,19:20,
19:30,19:40,19:50,20:00,20:10,20:20,20:30,20:40,20:50,21:00,21:10,21:20,21:30,21:40,21:50,22:00,
22:10,22:20,22:30,22:40,22:50,23:00,23:10,23:20,23:30|23:30 - 23:40 KÖPRÜDEN
`;

const SUNDAY_RAW = `
00:10,00:40,01:25,06:35|KÖPRÜDEN,06:41,06:45|KÖPRÜDEN-ÜCRETSİZ,06:50|KÖPRÜDEN,06:51,
07:05|KÖPRÜDEN,07:15|KÖPRÜDEN-ÜCRETSİZ,07:20|KÖPRÜDEN,07:35|KÖPRÜDEN,07:45|KÖPRÜDEN-ÜCRETSİZ,
07:50|KÖPRÜDEN,08:05|KÖPRÜDEN,08:20|KÖPRÜDEN,08:25|KÖPRÜDEN-ÜCRETSİZ,08:35|KÖPRÜDEN,
08:50|KÖPRÜDEN,09:00,09:10,09:15|ÜCRETSİZ-KONSERV.,09:20,09:30,09:40,09:50,10:00,10:05|ÜCRETSİZ,
10:10,10:20,10:30,10:40,10:45|ÜCRETSİZ,10:50,11:00,11:10,11:20,11:30,11:35|ÜCRETSİZ,11:40,11:50,
12:00,12:10,12:20,12:25|ÜCRETSİZ-KONSERV.,12:30,12:40,12:50,13:00,13:10,13:15|ÜCRETSİZ,13:20,
13:30,13:40,13:50,14:00,14:05|ÜCRETSİZ,14:10,14:20,14:30,14:40,14:50,15:00,15:05|ÜCRETSİZ,15:10,
15:20,15:30,15:40,15:45,15:50,16:00,16:10,16:20,16:30,16:35|ÜCRETSİZ,16:40,16:50,17:00,17:10,
17:15|ÜCRETSİZ-KONSERV.,17:20,17:30,17:40,17:50,18:00,18:10,18:15|ÜCRETSİZ-KONSERV.,18:20,18:30,
18:40,18:50,19:00,19:05|ÜCRETSİZ-KONSERV.,19:10,19:20,19:30,19:40,19:50,20:00,20:10,20:20,20:30,
20:40,20:50,21:00,21:10,21:20,21:30,21:40,21:50,22:00,22:10,22:20,22:30,22:40,22:50,23:00,23:10,
23:20,23:30|23:30 - 23:40 KÖPRÜDEN
`;

export const EGO_130_SCHEDULES: Ego130Schedule[] = [
  parseList(WEEKDAY_RAW, 'weekday', 'Hafta İçi'),
  parseList(SATURDAY_RAW, 'saturday', 'Cumartesi'),
  parseList(SUNDAY_RAW, 'sunday', 'Pazar / Bayram'),
];

// Beytepe Metro ve Hukuk Fakültesi, AYNI 130 hattının iki durağı — eskiden
// burada Moovit'ten elle derlenmiş, kampüs listesinden bağımsız ikinci bir
// tarife vardı. Sayıları güne göre uyuşmuyordu (ör. Pazar'da kampüste 95,
// metroda yalnızca 62 sefer — son metro kaydı 16:51'de kesiliyordu), bu da
// hem "aynı hat için iki farklı sefer sayısı" görünümüne hem de akşamüstünden
// sonra Pazar günü "bugünkü seferler bitti" yanlış uyarısına yol açıyordu.
//
// Artık metro saatleri, kampüs (Hukuk Fakültesi) listesinden TÜRETİLİYOR:
// aynı sefer, metro durağına kampüsten ~7 dakika sonra varıyor (hafta içi
// verisinde iki liste bire bir aynı sayıda kayıt içeriyordu — ilk birkaç
// eşleşen kayıttan, 00:10→00:17, 00:40→00:47, 01:25→01:32, doğrulanan sabit
// fark). Böylece iki durak HER ZAMAN aynı sayıda seferi gösterir ve veri
// eksikliği kaynaklı "seferler bitti" hatası kendiliğinden ortadan kalkar.
const METRO_OFFSET_MINUTES = 7;

function deriveMetroSchedule(campus: Ego130Schedule): Ego130Schedule {
  return {
    key: campus.key,
    label: campus.label,
    departures: campus.departures.map((d) => ({
      time: minutesToTime(toMinutes(d.time) + METRO_OFFSET_MINUTES),
      note: d.note,
    })),
  };
}

export const EGO_130_METRO_SCHEDULES: Ego130Schedule[] = EGO_130_SCHEDULES.map(deriveMetroSchedule);

export const EGO_130_SOURCE_URL = 'https://www.ego.gov.tr/tr/hareketsaatleri?hat_no=130';
export const EGO_130_SOURCE_LABEL = 'EGO Genel Müdürlüğü';
