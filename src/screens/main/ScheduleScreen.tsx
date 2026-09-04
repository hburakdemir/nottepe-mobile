import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from 'react-native';
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
import { scheduleAPI } from '../../lib/api';
import CourseFormModal from '../../components/schedule/CourseFormModal';
import { useTheme } from '../../context/ThemeContext';
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

export default function ScheduleScreen() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [courses, setCourses] = useState<ScheduleCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalCourse, setModalCourse] = useState<ScheduleCourse | 'new' | null>(null);
  const [shareId, setShareId] = useState<string | null>(null);
  const [shareEnabled, setShareEnabled] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [downloadOpen, setDownloadOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // react-native-view-shot `ViewShotRef` diye bir tip dışa vermiyor; ref
  // doğrudan default export edilen ViewShot bileşen sınıfının örneği.
  const shotRef = useRef<ViewShot>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await scheduleAPI.getMine();
        const loaded = Array.isArray(res.data?.courses)
          ? res.data.courses.map(sanitizeCourse).filter(Boolean)
          : [];
        setCourses(loaded as ScheduleCourse[]);
        setShareId(res.data?.shareId || null);
        setShareEnabled(!!res.data?.shareEnabled);
      } catch {
        Alert.alert('Hata', 'Program yüklenemedi.');
      } finally {
        setLoading(false);
      }
    })();
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      if (clearTimer.current) clearTimeout(clearTimer.current);
    };
  }, []);

  const conflictIds = useMemo(() => findConflictIds(courses), [courses]);
  const shareUrl = shareId ? `${SHARE_BASE}/program/paylasilan/${shareId}` : null;

  const persist = (next: ScheduleCourse[]) => {
    setCourses(next);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        const res = await scheduleAPI.save(next);
        setShareId(res.data?.shareId || null);
        setShareEnabled(!!res.data?.shareEnabled);
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
      setShareId(res.data?.shareId || null);
      setShareEnabled(!!res.data?.shareEnabled);
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
      setShareEnabled(false);
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
    try {
      if (format === 'png') {
        const uri = await captureRef(shotRef, { format: 'png', quality: 1 });
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'Ders Programı (.png)' });
        }
      } else {
        const base64 = await captureRef(shotRef, { format: 'png', quality: 1, result: 'data-uri' });
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
      setDownloading(false);
    }
  };

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" color="#2F5755" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-primary dark:bg-darkbgbutton">
      <ScrollView contentContainerClassName="px-4 py-6">
        {/* Ekran içi "Ders Programı" başlığı ve alt yazısı kaldırıldı — üst bar
            zaten sayfa adını yazıyor. */}
        <View className="flex-row flex-wrap gap-2 mb-3">
          <Pressable className="flex-row items-center gap-2 bg-brand rounded-lg px-5 py-2.5" onPress={() => setModalCourse('new')}>
            <Plus size={18} color="#fff" />
            <Text className="text-white text-sm font-medium">Ders Ekle</Text>
          </Pressable>
          {courses.length > 0 && (
            <>
              <Pressable className="flex-row items-center gap-2 border border-brand rounded-lg px-4 py-2.5" onPress={handleShare} disabled={sharing}>
                <Share2 size={18} color={isDark ? '#5A9690' : '#2F5755'} />
                <Text className="text-brand dark:text-brand-light text-sm font-medium">{sharing ? '...' : 'Paylaş'}</Text>
              </Pressable>
              <Pressable
                className="flex-row items-center gap-2 border border-brand rounded-lg px-4 py-2.5"
                onPress={() => setDownloadOpen((v) => !v)}
                disabled={downloading}
              >
                <Download size={18} color={isDark ? '#5A9690' : '#2F5755'} />
                <Text className="text-brand dark:text-brand-light text-sm font-medium">{downloading ? 'İndiriliyor...' : 'İndir'}</Text>
                <ChevronDown size={14} color={isDark ? '#5A9690' : '#2F5755'} style={{ transform: [{ rotate: downloadOpen ? '180deg' : '0deg' }] }} />
              </Pressable>
              <Pressable
                className={`flex-row items-center gap-2 rounded-lg px-4 py-2.5 border ${confirmClear ? 'bg-[#ef4444] border-[#ef4444]' : 'border-[#fca5a5]'}`}
                onPress={handleClearAll}
              >
                <Trash2 size={18} color={confirmClear ? '#fff' : '#ef4444'} />
                <Text className={`text-sm font-medium ${confirmClear ? 'text-white' : 'text-[#ef4444]'}`}>
                  {confirmClear ? 'Emin misin?' : 'Temizle'}
                </Text>
              </Pressable>
            </>
          )}
        </View>

        {downloadOpen && (
          <View className="bg-white dark:bg-darkbgbutton rounded-xl border border-gray-200 dark:border-gray-600 py-1.5 mb-3 self-start" style={SHADOW_MD}>
            <Pressable className="flex-row items-center gap-2.5 px-4 py-2.5" onPress={() => handleDownload('png')}>
              <ImageIcon size={16} color={isDark ? '#DFD0B8' : '#374151'} />
              <Text className="text-sm text-gray-700 dark:text-darktext">PNG olarak indir</Text>
            </Pressable>
            <Pressable className="flex-row items-center gap-2.5 px-4 py-2.5" onPress={() => handleDownload('pdf')}>
              <FileText size={16} color={isDark ? '#DFD0B8' : '#374151'} />
              <Text className="text-sm text-gray-700 dark:text-darktext">PDF olarak indir</Text>
            </Pressable>
          </View>
        )}

        {shareEnabled && shareUrl && (
          <View className="flex-row items-center gap-2 bg-brand/5 dark:bg-brand-light/10 border border-brand/30 dark:border-brand-light/30 rounded-lg p-3 mb-4">
            <Share2 size={16} color={isDark ? '#5A9690' : '#2F5755'} />
            <Text className="text-sm text-gray-600 dark:text-darktext">Program herkese açık:</Text>
            <Text className="flex-1 text-sm text-brand dark:text-brand-light underline" numberOfLines={1} onPress={handleCopyLink}>
              {shareUrl}
            </Text>
            <Pressable onPress={handleCopyLink} hitSlop={8}>
              <Copy size={16} color={isDark ? '#9ca3af' : '#6b7280'} />
            </Pressable>
            <Pressable onPress={handleStopShare} hitSlop={8}>
              <X size={16} color={isDark ? '#9ca3af' : '#6b7280'} />
            </Pressable>
          </View>
        )}

        {conflictIds.size > 0 && (
          <View className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
            <Text className="text-sm text-red-600">
              Programında çakışan dersler var — kırmızı çerçeveli bloklara göz at.
            </Text>
          </View>
        )}

        {courses.length === 0 ? (
          <View className="bg-white dark:bg-darkbgbutton rounded-lg p-12 items-center gap-4" style={SHADOW_MD}>
            <CalendarDays size={64} color={isDark ? '#6b7280' : '#9ca3af'} />
            <Text className="text-gray-500 dark:text-gray-400 text-lg text-center">Henüz ders eklemedin. "Ders Ekle" ile haftalık programını oluşturmaya başla.</Text>
            <Pressable className="flex-row items-center gap-2 bg-brand rounded-lg px-5 py-2.5" onPress={() => setModalCourse('new')}>
              <Text className="text-white text-sm font-medium">İlk Dersini Ekle</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <ViewShot ref={shotRef} options={{ format: 'png', quality: 1 }} style={{ backgroundColor: '#FFFFFF' }}>
              {DAYS.map((day) => {
                const dayCourses = courses
                  .filter((c) => c.day === day)
                  .sort((a, b) => toMinutes(a.start) - toMinutes(b.start));
                if (dayCourses.length === 0) return null;
                return (
                  <View key={day} className="bg-white rounded-lg p-4 mt-4" style={SHADOW_MD}>
                    <Text className="text-base font-semibold text-gray-900 mb-3">{DAY_NAMES[day]}</Text>
                    <View className="gap-2">
                      {dayCourses.map((c) => {
                        const color = getCourseColor(c.colorIdx);
                        const conflicted = conflictIds.has(c.id);
                        return (
                          <Pressable
                            key={c.id}
                            className={`flex-row items-center gap-3 rounded-lg p-3 ${conflicted ? 'border-2 border-[#ef4444] bg-red-50' : 'border border-gray-100'}`}
                            onPress={() => setModalCourse(c)}
                          >
                            <View className="w-3 h-10 rounded-full" style={{ backgroundColor: color.hex }} />
                            <View className="flex-1">
                              <View className="flex-row items-center gap-1">
                                {conflicted && <AlertTriangle size={16} color="#ef4444" />}
                                <Text className="text-sm font-medium text-gray-900 flex-shrink" numberOfLines={1}>
                                  {c.name}
                                </Text>
                              </View>
                              <View className="flex-row items-center gap-0.5 mt-1">
                                <Text className="text-xs text-gray-500">
                                  {c.start}–{c.end}
                                </Text>
                                {!!c.location && (
                                  <>
                                    <Text className="text-xs text-gray-500"> · </Text>
                                    <MapPin size={12} color="#6b7280" />
                                    <Text className="text-xs text-gray-500">{c.location}</Text>
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
            </ViewShot>
            <Text className="text-xs text-gray-400 dark:text-gray-500 mt-3">Düzenlemek veya silmek için derse tıkla.</Text>
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
