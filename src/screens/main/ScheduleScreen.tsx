import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  CalendarDays,
  ChevronDown,
  Copy,
  Download,
  FileText,
  Image as ImageIcon,
  MapPin,
  Plus,
  Share2,
  Trash2,
  X,
} from 'lucide-react-native';
import ViewShot, { captureRef } from 'react-native-view-shot';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as Clipboard from 'expo-clipboard';
import { vars } from 'nativewind';
import { scheduleAPI } from '../../lib/api';
import CourseFormModal from '../../components/schedule/CourseFormModal';
import { useTheme } from '../../context/ThemeContext';
import { LIGHT_VARS, THEME_COLORS } from '../../theme/palette';
import { Skeleton, SkeletonGroup } from '../../components/Skeleton';
import {
  DAY_NAMES,
  findConflictIds,
  getCourseColor,
  sanitizeCourse,
  toMinutes,
  type ScheduleCourse,
} from '../../utils/schedule';

const DAYS = [1, 2, 3, 4, 5, 6];
const SHARE_BASE = 'https://nottepe.com';

const SCHEDULE_KEY = ['schedule', 'mine'] as const;

interface ScheduleData {
  courses: ScheduleCourse[];
  shareId: string | null;
  shareEnabled: boolean;
}

const EMPTY_COURSES: ScheduleCourse[] = [];

// PDF'e gömülecek yakalamanın piksel genişliği — bkz. handleDownload'daki not.
const PDF_CAPTURE_WIDTH = 1240;

// DIŞA AKTARILAN GÖRSEL HER ZAMAN BEYAZ ZEMİNLİ (kullanıcı kararı): koyu temada
// çalışan bir programı yazdırmak ya da WhatsApp'ta paylaşmak okunmaz oluyor.
// Ekran ise temaya uymak zorunda — bu dosya uzun süre uymuyordu, çünkü ölü
// `dark:` sınıfları kullanıyordu (bkz. aşağıdaki nota).
//
// Çözüm: yakalama anında SADECE yakalanan alt ağaca açık tema değişkenleri
// basılıyor. Kökteki ThemeProvider ile birebir aynı mekanizma (`vars()`),
// dolayısıyla token kullanan her çocuk otomatik açık renklere düşüyor.
// Modül seviyesinde bir kez kuruluyor: her render'da yeniden üretilse
// yakalama alt ağacı boşuna yeniden çizilirdi.
const EXPORT_VARS = vars(LIGHT_VARS);

// Bayrağı açıp `captureRef`'i HEMEN çağırmak yanlış olurdu: bayrağın tetiklediği
// yeniden çizim henüz native tarafa inmemiş olur ve koyu tema yakalanır. İki
// kare bekliyoruz — biri React'in commit'i, biri native çizim için.
const nextTwoFrames = () =>
  new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));

export default function ScheduleScreen() {
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const [modalCourse, setModalCourse] = useState<ScheduleCourse | 'new' | null>(null);
  const [sharing, setSharing] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [downloadOpen, setDownloadOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);
  // Yalnızca yakalama süresince true (bkz. EXPORT_VARS notu).
  const [exporting, setExporting] = useState(false);
  // Yakalama alt ağacındaki İKON renkleri için. `EXPORT_VARS` yalnızca token
  // (className) yoluyla gelen renkleri açığa çeviriyor; lucide ikonları rengi
  // prop olarak aldığı için onlara CSS değişkeni ulaşmıyor. Bu ikisini
  // birleştirmezsek yakalanan görselde yazılar açık, ikonlar koyu tema
  // renginde çıkar.
  const captureColors = exporting ? THEME_COLORS.light : colors;
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // react-native-view-shot `ViewShotRef` diye bir tip dışa vermiyor; ref
  // doğrudan default export edilen ViewShot bileşen sınıfının örneği.
  const shotRef = useRef<ViewShot>(null);

  // `staleTime: Infinity` BİLİNÇLİ VE BURADA ZORUNLU.
  //
  // Bu ekran bir okuma ekranı değil, bir DÜZENLEYİCİ: ders eklemek `persist`
  // ile önce cache'i yazıyor, sunucuya kaydı 500 ms sonra gidiyor. Arka planda
  // kendiliğinden çalışan bir tazeleme o aralığa denk gelirse kullanıcının
  // yeni eklediği dersi sunucunun eski hâliyle EZER. Programı düzenleyen tek
  // yer burası olduğu için otomatik tazelemeye zaten ihtiyaç yok; başka bir
  // cihazdan (web) yapılan değişiklik uygulama yeniden açıldığında geliyor.
  //
  // Kullanıcıya görünen kazanç: Araçlar → Program → geri → Program artık hiç
  // yükleme göstermiyor, ekran anında çiziliyor.
  const { data, isLoading, isError } = useQuery({
    queryKey: SCHEDULE_KEY,
    queryFn: async () => {
      const res = await scheduleAPI.getMine();
      const loaded = Array.isArray(res.data?.courses) ? res.data.courses.map(sanitizeCourse).filter(Boolean) : [];
      return {
        courses: loaded as ScheduleCourse[],
        shareId: (res.data?.shareId || null) as string | null,
        shareEnabled: !!res.data?.shareEnabled,
      };
    },
    staleTime: Infinity,
  });

  const courses = data?.courses ?? EMPTY_COURSES;
  const shareId = data?.shareId ?? null;
  const shareEnabled = data?.shareEnabled ?? false;

  useEffect(() => {
    if (isError) Alert.alert('Hata', 'Program yüklenemedi.');
  }, [isError]);

  // Cache'e kısmi yazma yardımcısı: aşağıdaki her yerde tekrar etmesin diye.
  const patchSchedule = useCallback(
    (fields: Partial<{ courses: ScheduleCourse[]; shareId: string | null; shareEnabled: boolean }>) => {
      queryClient.setQueryData(SCHEDULE_KEY, (prev: ScheduleData | undefined) =>
        prev ? { ...prev, ...fields } : prev
      );
    },
    [queryClient]
  );

  useEffect(
    () => () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      if (clearTimer.current) clearTimeout(clearTimer.current);
    },
    []
  );

  const conflictIds = useMemo(() => findConflictIds(courses), [courses]);
  const shareUrl = shareId ? `${SHARE_BASE}/program/paylasilan/${shareId}` : null;

  const persist = (next: ScheduleCourse[]) => {
    patchSchedule({ courses: next });
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        const res = await scheduleAPI.save(next);
        patchSchedule({ shareId: res.data?.shareId || null, shareEnabled: !!res.data?.shareEnabled });
      } catch {
        Alert.alert('Hata', 'Program sunucuya kaydedilemedi.');
      }
    }, 500);
  };

  const handleSaveCourse = (course: ScheduleCourse) => {
    const exists = courses.some((c) => c.id === course.id);
    const next = exists ? courses.map((c) => (c.id === course.id ? course : c)) : [...courses, course];
    persist(next);
  };

  const handleDeleteCourse = (id: string) => {
    persist(courses.filter((c) => c.id !== id));
  };

  const handleShare = async () => {
    setSharing(true);
    try {
      const res = await scheduleAPI.setShare(true);
      patchSchedule({ shareId: res.data?.shareId || null, shareEnabled: !!res.data?.shareEnabled });
      const url = res.data?.shareId ? `${SHARE_BASE}/program/paylasilan/${res.data.shareId}` : null;
      if (url) await Clipboard.setStringAsync(url);
    } catch {
      Alert.alert('Hata', 'Paylaşım linki oluşturulamadı.');
    } finally {
      setSharing(false);
    }
  };

  const handleStopShare = async () => {
    try {
      await scheduleAPI.setShare(false);
      patchSchedule({ shareEnabled: false });
    } catch {
      Alert.alert('Hata', 'İşlem başarısız.');
    }
  };

  const handleCopyLink = async () => {
    if (!shareUrl) return;
    await Clipboard.setStringAsync(shareUrl);
  };

  const handleClearAll = () => {
    if (!confirmClear) {
      setConfirmClear(true);
      if (clearTimer.current) clearTimeout(clearTimer.current);
      clearTimer.current = setTimeout(() => setConfirmClear(false), 4000);
      return;
    }
    if (clearTimer.current) clearTimeout(clearTimer.current);
    setConfirmClear(false);
    persist([]);
  };

  const handleDownload = async (format: 'png' | 'pdf') => {
    setDownloadOpen(false);
    if (!shotRef.current) return;
    setDownloading(true);
    // Yakalanan ağacı açık temaya zorluyoruz ve çizimin inmesini bekliyoruz;
    // yoksa koyu temada koyu bir PNG/PDF üretirdik (bkz. EXPORT_VARS notu).
    setExporting(true);
    await nextTwoFrames();
    try {
      if (format === 'png') {
        // `result` varsayılanı 'tmpfile' — görüntü diske yazılıp yolu dönüyor,
        // JS tarafına hiç geçmiyor. Burada çözünürlüğü sınırlamaya gerek yok.
        // (`quality` kaldırıldı: yalnızca jpg gibi kayıplı formatlarda geçerli,
        // png'de hiçbir etkisi yoktu.)
        const uri = await captureRef(shotRef, { format: 'png' });
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'Ders Programı (.png)' });
        }
      } else {
        // PDF yolu base64 KULLANMAK ZORUNDA: expo-print'in printToFileAsync'i
        // HTML içinde yerel `file://` görsellerini desteklemiyor (iOS'ta
        // WKWebView sınırı, dokümanda açıkça yazılı) — tek yol gömülü data URI.
        //
        // Bu da şu demek: görüntü aynı anda üç kopya hâlinde bellekte durur —
        // bitmap, base64 string ve HTML'in içindeki hâli. view-shot'ın kendi
        // dokümanı da bu yüzden "yalnızca küçük görüntülerde kullanın" diyor.
        // Yüksek yoğunluklu bir tablette tam çözünürlük yakalamak düşük RAM'li
        // cihazlarda çökmeye açık kapı bırakıyordu.
        //
        // `width` bunu cihaz yoğunluğundan BAĞIMSIZ olarak sınırlıyor: 1240 px
        // ≈ A4 genişliği @150 DPI, bir ders programı ızgarası için fazlasıyla
        // yeterli. Yükseklik verilmiyor — oran korunuyor.
        const base64 = await captureRef(shotRef, { format: 'png', width: PDF_CAPTURE_WIDTH, result: 'data-uri' });
        const { uri } = await Print.printToFileAsync({
          html: `<html><body style="margin:0"><img src="${base64}" style="width:100%" /></body></html>`,
        });
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Ders Programı (.pdf)' });
        }
      }
    } catch {
      Alert.alert('Hata', 'İndirme başarısız oldu.');
    } finally {
      setExporting(false);
      setDownloading(false);
    }
  };

  // İskelet, aşağıdaki gerçek yerleşimin aynısı: üstte dört eylem butonu,
  // altında gün kartları ve her satırda 12×40 renk çubuğu + ders adı + saat.
  //
  // Eskiden burada 5 sütunlu bir TAKVİM IZGARASI çiziliyordu — bu ekranda
  // ızgara diye bir şey hiç olmadı; veri gelince kullanıcı bambaşka bir sayfa
  // görüyordu. Butonlar sabit metin taşıdığı için iskelette de gerçek hâlleriyle
  // duruyor, yalnızca veriden gelen gün adı ve ders satırları gri.
  if (isLoading) {
    return (
      <SkeletonGroup>
        <View className="flex-1 bg-ground px-4 pt-6">
          <View className="flex-row flex-wrap gap-2 mb-3">
            <View className="flex-row items-center gap-2 bg-brand rounded-lg px-5 py-2.5">
              <Plus size={18} color="#fff" />
              <Text className="text-white text-sm font-medium">Ders Ekle</Text>
            </View>
            <View className="flex-row items-center gap-2 border border-accent rounded-lg px-4 py-2.5">
              <Share2 size={18} color={colors.accent} />
              <Text className="text-accent text-sm font-medium">Paylaş</Text>
            </View>
            <View className="flex-row items-center gap-2 border border-accent rounded-lg px-4 py-2.5">
              <Download size={18} color={colors.accent} />
              <Text className="text-accent text-sm font-medium">İndir</Text>
              <ChevronDown size={14} color={colors.accent} />
            </View>
            <View className="flex-row items-center gap-2 rounded-lg px-4 py-2.5 border border-danger-line">
              <Trash2 size={18} color={colors.danger} />
              <Text className="text-sm font-medium text-danger">Temizle</Text>
            </View>
          </View>

          {[
            { name: 98, rows: [60, 48] },
            { name: 64, rows: [54, 40] },
            { name: 90, rows: [58] },
            { name: 80, rows: [52] },
          ].map((day, i) => (
            <View key={i} className="bg-surface rounded-lg p-4 mt-4" style={SHADOW_MD}>
              <Skeleton width={day.name} height={16} />
              <View className="gap-2 mt-3">
                {day.rows.map((w, j) => (
                  <View key={j} className="flex-row items-center gap-3 rounded-lg p-3 border border-line-soft">
                    <Skeleton width={12} height={40} radius={100} />
                    <View className="flex-1 gap-1.5">
                      <Skeleton height={14} style={{ width: `${w}%` }} />
                      <Skeleton height={12} style={{ width: `${w - 14}%` }} />
                    </View>
                  </View>
                ))}
              </View>
            </View>
          ))}
        </View>
      </SkeletonGroup>
    );
  }

  return (
    // ⚠️ BU DOSYA UZUN SÜRE KOYU TEMAYA UYMUYORDU ve sebebi sinsiydi: ekranlar
    // içinde `dark:` varyantı kullanan TEK dosya buydu, ama o varyantların
    // dayandığı Tailwind girdileri (`primary`, `darkbgbutton`, `darktext`)
    // config'den kaldırılmıştı (bkz. tailwind.config.js'teki not). Yani bütün
    // `dark:` kuralları ÖLÜYDÜ — hata vermiyor, sadece hiçbir şey yapmıyordu ve
    // koyu temada açık tema renkleri öylece kalıyordu. Artık her renk token'dan
    // geliyor; `dark:` bu dosyada da hiç kullanılmıyor.
    <View className="flex-1 bg-ground">
      <ScrollView contentContainerClassName="px-4 pt-6 pb-[150px]">
        {/* Ekran içi "Ders Programı" başlığı ve alt yazısı kaldırıldı — üst bar
            zaten sayfa adını yazıyor. */}
        <View className="flex-row flex-wrap gap-2 mb-3">
          <Pressable className="flex-row items-center gap-2 bg-brand rounded-lg px-5 py-2.5" onPress={() => setModalCourse('new')}>
            <Plus size={18} color="#fff" />
            <Text className="text-white text-sm font-medium">Ders Ekle</Text>
          </Pressable>
          {courses.length > 0 && (
            <>
              {/* Çerçeveli butonlar `accent` kullanıyor (temayla açılıp
                  koyulaşıyor); dolgulu "Ders Ekle" ise `brand` sabitinde
                  kalıyor — üstünde her zaman beyaz yazı var, bkz.
                  tailwind.config.js'teki temadan bağımsız sabitler notu. */}
              <Pressable className="flex-row items-center gap-2 border border-accent rounded-lg px-4 py-2.5" onPress={handleShare} disabled={sharing}>
                <Share2 size={18} color={colors.accent} />
                <Text className="text-accent text-sm font-medium">{sharing ? '...' : 'Paylaş'}</Text>
              </Pressable>
              <Pressable
                className="flex-row items-center gap-2 border border-accent rounded-lg px-4 py-2.5"
                onPress={() => setDownloadOpen((v) => !v)}
                disabled={downloading}
              >
                <Download size={18} color={colors.accent} />
                <Text className="text-accent text-sm font-medium">{downloading ? 'İndiriliyor...' : 'İndir'}</Text>
                <ChevronDown size={14} color={colors.accent} style={{ transform: [{ rotate: downloadOpen ? '180deg' : '0deg' }] }} />
              </Pressable>
              <Pressable
                className={`flex-row items-center gap-2 rounded-lg px-4 py-2.5 border ${confirmClear ? 'bg-danger border-danger' : 'border-danger-line'}`}
                onPress={handleClearAll}
              >
                <Trash2 size={18} color={confirmClear ? '#fff' : colors.danger} />
                <Text className={`text-sm font-medium ${confirmClear ? 'text-white' : 'text-danger'}`}>
                  {confirmClear ? 'Emin misin?' : 'Temizle'}
                </Text>
              </Pressable>
            </>
          )}
        </View>

        {downloadOpen && (
          <View className="bg-surface rounded-xl border border-line py-1.5 mb-3 self-start" style={SHADOW_MD}>
            <Pressable className="flex-row items-center gap-2.5 px-4 py-2.5" onPress={() => handleDownload('png')}>
              <ImageIcon size={16} color={colors.ink2} />
              <Text className="text-sm text-ink2">PNG olarak indir</Text>
            </Pressable>
            <Pressable className="flex-row items-center gap-2.5 px-4 py-2.5" onPress={() => handleDownload('pdf')}>
              <FileText size={16} color={colors.ink2} />
              <Text className="text-sm text-ink2">PDF olarak indir</Text>
            </Pressable>
          </View>
        )}

        {shareEnabled && shareUrl && (
          <View className="flex-row items-center gap-2 bg-accent-soft border border-accent-line rounded-lg p-3 mb-4">
            <Share2 size={16} color={colors.accent} />
            <Text className="text-sm text-ink2">Program herkese açık:</Text>
            <Text className="flex-1 text-sm text-accent underline" numberOfLines={1} onPress={handleCopyLink}>
              {shareUrl}
            </Text>
            <Pressable onPress={handleCopyLink} hitSlop={8}>
              <Copy size={16} color={colors.muted} />
            </Pressable>
            <Pressable onPress={handleStopShare} hitSlop={8}>
              <X size={16} color={colors.muted} />
            </Pressable>
          </View>
        )}

        {conflictIds.size > 0 && (
          <View className="bg-danger-soft border border-danger-line rounded-lg p-3 mb-4">
            <Text className="text-sm text-danger">
              Programında çakışan dersler var — kırmızı çerçeveli bloklara göz at.
            </Text>
          </View>
        )}

        {courses.length === 0 ? (
          <View className="bg-surface rounded-lg p-12 items-center gap-4" style={SHADOW_MD}>
            <CalendarDays size={64} color={colors.muted2} />
            <Text className="text-muted text-lg text-center">Henüz ders eklemedin. "Ders Ekle" ile haftalık programını oluşturmaya başla.</Text>
            <Pressable className="flex-row items-center gap-2 bg-brand rounded-lg px-5 py-2.5" onPress={() => setModalCourse('new')}>
              <Text className="text-white text-sm font-medium">İlk Dersini Ekle</Text>
            </Pressable>
          </View>
        ) : (
          <>
            {/* Zemin yalnızca YAKALAMADA beyaz: ekranda saydam kalıyor ki
                sayfanın kendi zemini (`bg-ground`) görünsün. Eskiden burada
                sabit `#FFFFFF` vardı ve ızgara koyu temada da beyaz duruyordu —
                şikâyetin en görünür kısmı buydu. */}
            <ViewShot
              ref={shotRef}
              options={{ format: 'png', quality: 1 }}
              style={{ backgroundColor: exporting ? '#FFFFFF' : 'transparent' }}
            >
              {/* Açık tema değişkenleri SADECE bu alt ağaca ve SADECE yakalama
                  anında basılıyor (bkz. EXPORT_VARS). Aşağıdaki her şey token
                  kullandığı için ekranda temaya, çıktıda beyaza düşüyor. */}
              <View style={exporting ? EXPORT_VARS : undefined}>
              {DAYS.map((day) => {
                const dayCourses = courses
                  .filter((c) => c.day === day)
                  .sort((a, b) => toMinutes(a.start) - toMinutes(b.start));
                if (dayCourses.length === 0) return null;
                return (
                  <View key={day} className="bg-surface rounded-lg p-4 mt-4" style={SHADOW_MD}>
                    <Text className="text-base font-semibold text-ink mb-3">{DAY_NAMES[day]}</Text>
                    <View className="gap-2">
                      {dayCourses.map((c) => {
                        const color = getCourseColor(c.colorIdx);
                        const conflicted = conflictIds.has(c.id);
                        return (
                          <Pressable
                            key={c.id}
                            className={`flex-row items-center gap-3 rounded-lg p-3 ${conflicted ? 'border-2 border-danger bg-danger-soft' : 'border border-line-soft'}`}
                            onPress={() => setModalCourse(c)}
                          >
                            <View className="w-3 h-10 rounded-full" style={{ backgroundColor: color.hex }} />
                            <View className="flex-1">
                              <View className="flex-row items-center gap-1">
                                {conflicted && <AlertTriangle size={16} color={captureColors.danger} />}
                                <Text className="text-sm font-medium text-ink flex-shrink" numberOfLines={1}>
                                  {c.name}
                                </Text>
                              </View>
                              <View className="flex-row items-center gap-0.5 mt-1">
                                <Text className="text-xs text-muted">
                                  {c.start}–{c.end}
                                </Text>
                                {!!c.location && (
                                  <>
                                    <Text className="text-xs text-muted"> · </Text>
                                    <MapPin size={12} color={captureColors.muted} />
                                    <Text className="text-xs text-muted">{c.location}</Text>
                                  </>
                                )}
                              </View>
                            </View>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                );
              })}
              </View>
            </ViewShot>
            <Text className="text-xs text-muted2 mt-3">Düzenlemek veya silmek için derse tıkla.</Text>
          </>
        )}
      </ScrollView>

      {modalCourse && (
        <CourseFormModal
          initial={modalCourse === 'new' ? null : modalCourse}
          courses={courses}
          onSave={handleSaveCourse}
          onDelete={handleDeleteCourse}
          onClose={() => setModalCourse(null)}
        />
      )}
    </View>
  );
}

const SHADOW_MD = {
  shadowColor: '#000',
  shadowOpacity: 0.1,
  shadowRadius: 8,
  shadowOffset: { width: 0, height: 3 },
  elevation: 3,
};
