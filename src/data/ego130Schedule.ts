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

// Format: "HH:MM" ya da not varsa "HH:MM|NOT". Kaynak: otobussaatleri.net
// (130 Beytepe Metro - Hacettepe Kampüsü ring hattı), resmi EGO verisi
// değildir — bkz. Ego130ScheduleScreen.tsx üstündeki uyarı.
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
00:10,00:40,01:25,06:35|KÖPRÜDEN,06:36|DURAKTAN BAŞLAR,06:41|DURAKTAN,06:46|DURAKTAN BAŞLAR,
06:50|KÖPRÜDEN,06:55|DURAKTAN BAŞLAR,07:05|KÖPRÜDEN,07:15|ÜCRETSİZ-KONSERV.,07:20|KÖPRÜDEN,
07:35|KÖPRÜDEN,07:45|ÜCRETSİZ-KONSERV.,07:50|KÖPRÜDEN,08:05|KÖPRÜDEN,08:20|KÖPRÜDEN,
08:35|KÖPRÜDEN,08:45|ÜCRETSİZ-KONSERV.,08:50|KÖPRÜDEN,08:55,09:05|KÖPRÜDEN,09:10,09:25,09:40,
09:50|ÜCRETSİZ,09:55,10:10,10:25,10:40,10:50|ÜCRETSİZ,10:55,11:10,11:25,11:40,11:50|ÜCRETSİZ,
11:55,12:10,12:20|ÜCRETSİZ-KONSERV.,12:25,12:40,12:55,13:10,13:20|ÜCRETSİZ-KONSERV.,13:25,
13:40,13:55,14:10,14:15|ÜCRETSİZ,14:25,14:40,14:55,15:00|ÜCRETSİZ,15:10,15:25,15:40,15:55,
16:00|ÜCRETSİZ,16:10,16:20|ÜCRETSİZ-KONSERV.,16:25,16:40,16:55,17:10,17:11|ÜCRETSİZ-KONSERV.,
17:25,17:40,17:55,18:10,18:11|ÜCRETSİZ-KONSERV.,18:25,18:40,18:55,19:00|ÜCRETSİZ-KONSERV.,
19:10,19:25,19:31|ÜCRETSİZ,19:40,19:55,20:05|ÜCRETSİZ,20:10,20:25,20:40,20:55,21:10,21:25,
21:40,21:55,22:10,22:25,22:40,22:55,23:10,23:25,23:30
`;

const SATURDAY_RAW = `
00:10,00:40,01:25,06:35|KÖPRÜDEN,06:36|DURAKTAN BAŞLAR,06:45|KÖPRÜDEN-ÜCRETSİZ,
06:46|DURAKTAN BAŞLAR,06:50|KÖPRÜDEN,06:55|DURAKTAN BAŞLAR,07:05|KÖPRÜDEN,
07:15|KÖPRÜDEN-ÜCRETSİZ,07:20|KÖPRÜDEN,07:35|KÖPRÜDEN,07:45|KÖPRÜDEN-ÜCRETSİZ,07:50|KÖPRÜDEN,
08:05|KÖPRÜDEN,08:20|KÖPRÜDEN,08:25|KÖPRÜDEN-ÜCRETSİZ,08:35|KÖPRÜDEN,08:50|KÖPRÜDEN,
08:55|DURAKTAN BAŞLAR,09:05|KÖPRÜDEN,09:10,09:15|ÜCRETSİZ-KONSERV.,09:25,09:40,09:55,
10:05|ÜCRETSİZ,10:10,10:25,10:40,10:45|ÜCRETSİZ,10:55,11:10,11:25,11:35|ÜCRETSİZ,11:40,11:55,
12:10,12:25,12:30|ÜCRETSİZ-KONSERV.,12:40,12:55,13:10,13:15|ÜCRETSİZ,13:25,13:40,13:55,
14:05|ÜCRETSİZ,14:10,14:25,14:40,14:55,15:05|ÜCRETSİZ,15:10,15:25,15:40,15:45|ÜCRETSİZ,15:55,
16:10,16:25,16:35|ÜCRETSİZ,16:40,16:55,17:10,17:15|ÜCRETSİZ-KONSERV.,17:25,17:40,17:55,18:10,
18:15|ÜCRETSİZ-KONSERV.,18:25,18:40,18:55,19:05|ÜCRETSİZ-KONSERV.,19:10,19:25,19:35,19:40,
19:55,20:05,20:10,20:25,20:40,20:55,21:10,21:25,21:40,21:55,22:10,22:25,22:40,22:55,23:10,
23:25,23:30,23:40|KÖPRÜDEN
`;

const SUNDAY_RAW = `
00:10,00:40,01:25,06:35|KÖPRÜDEN,06:36|DURAKTAN BAŞLAR,06:45|KÖPRÜDEN-ÜCRETSİZ,
06:46|DURAKTAN BAŞLAR,06:50|KÖPRÜDEN,07:05|KÖPRÜDEN,07:15|KÖPRÜDEN-ÜCRETSİZ,07:20|KÖPRÜDEN,
07:35|KÖPRÜDEN,07:45|KÖPRÜDEN-ÜCRETSİZ,07:50|KÖPRÜDEN,08:05|KÖPRÜDEN,08:20|KÖPRÜDEN,
08:25|KÖPRÜDEN-ÜCRETSİZ,08:35|KÖPRÜDEN,08:50|KÖPRÜDEN,08:55|DURAKTAN BAŞLAR,09:05|KÖPRÜDEN,
09:10,09:15|ÜCRETSİZ-KONSERV.,09:25,09:40,09:55,10:05|ÜCRETSİZ,10:10,10:25,10:40,10:45|ÜCRETSİZ,
10:55,11:10,11:25,11:35|ÜCRETSİZ,11:40,11:55,12:10,12:25,12:30|ÜCRETSİZ-KONSERV.,12:40,12:55,
13:10,13:15|ÜCRETSİZ,13:25,13:40,13:55,14:05|ÜCRETSİZ,14:10,14:25,14:40,14:55,15:05|ÜCRETSİZ,
15:10,15:25,15:40,15:45|ÜCRETSİZ,15:55,16:10,16:25,16:35|ÜCRETSİZ,16:40,16:55,17:10,
17:15|ÜCRETSİZ-KONSERV.,17:25,17:40,17:55,18:10,18:15|ÜCRETSİZ-KONSERV.,18:25,18:40,18:55,
19:05|ÜCRETSİZ-KONSERV.,19:10,19:25,19:40,19:55,20:05|ÜCRETSİZ,20:10,20:25,20:40,20:55,21:10,
21:25,21:40,21:55,22:10,22:25,22:40,22:55,23:10,23:25,23:30,23:40|KÖPRÜDEN
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

export const EGO_130_SOURCE_URL = 'https://otobussaatleri.net/130-beytepe-metro-otobus-saatleri/';
export const EGO_130_SOURCE_LABEL = 'otobussaatleri.net';
