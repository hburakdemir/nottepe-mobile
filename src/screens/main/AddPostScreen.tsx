import React, { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as DocumentPicker from 'expo-document-picker';
import { AlertCircle, CheckCircle, FileText, HeartHandshake, Upload, X } from 'lucide-react-native';
import { postsAPI } from '../../lib/api';
import { faculties, departments } from '../../data/departments';
import { useTheme } from '../../context/ThemeContext';
import { goToTab } from '../../navigation/navigateApp';
import OptionSheet from '../../components/layout/OptionSheet';
import type { RootStackParamList } from '../../navigation/types';
import { KeyboardAwareScroll } from '../../components/layout/KeyboardAvoider';

const MAX_FILES = 5;
const MAX_SIZE = 10 * 1024 * 1024;
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'image/jpeg',
  'image/png',
];

interface PickedFile {
  uri: string;
  name: string;
  mimeType: string;
  size: number;
}

const SHADOW_MD = {
  shadowColor: '#000',
  shadowOpacity: 0.1,
  shadowRadius: 8,
  shadowOffset: { width: 0, height: 3 },
  elevation: 3,
};
export default function AddPostScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<any>();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const noteRequest = (route.params as RootStackParamList['AddPost'])?.noteRequest;

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [link, setLink] = useState('');
  const [faculty, setFaculty] = useState(noteRequest?.faculty || '');
  const [department, setDepartment] = useState(noteRequest?.department || '');
  const [files, setFiles] = useState<PickedFile[]>([]);

  const [facultyModalOpen, setFacultyModalOpen] = useState(false);
  const [departmentModalOpen, setDepartmentModalOpen] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const departmentOptions = faculty ? (departments[faculty] ?? []) : [];

  const handlePickFiles = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ALLOWED_MIME_TYPES,
      multiple: true,
      copyToCacheDirectory: true,
    });
    if (result.canceled) return;

    const picked = result.assets ?? [];
    if (files.length + picked.length > MAX_FILES) {
      setError(`Maksimum ${MAX_FILES} dosya yükleyebilirsiniz`);
      return;
    }
    const oversized = picked.some((f) => (f.size ?? 0) > MAX_SIZE);
    if (oversized) {
      setError("Her dosya 10MB'dan küçük olmalıdır");
      return;
    }

    setFiles((prev) => [
      ...prev,
      ...picked.map((f) => ({
        uri: f.uri,
        name: f.name,
        mimeType: f.mimeType || 'application/octet-stream',
        size: f.size ?? 0,
      })),
    ]);
    setError('');
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!title.trim() || !content.trim() || !faculty || !department) {
      setError('Lütfen tüm alanları doldurun');
      return;
    }
    setError('');
    setSuccess(false);
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('title', title.trim());
      formData.append('content', content.trim());
      formData.append('link', link.trim());
      formData.append('faculty', faculty);
      formData.append('department', department);
      if (noteRequest?.id) {
        formData.append('note_request_id', String(noteRequest.id));
      }
      files.forEach((file) => {
        formData.append('files', {
          uri: file.uri,
          name: file.name,
          type: file.mimeType,
        } as any);
      });

      await postsAPI.addPost(formData);
      setSuccess(true);
      setTitle('');
      setContent('');
      setLink('');
      setFaculty('');
      setDepartment('');
      setFiles([]);
      setTimeout(() => {
        setSuccess(false);
        goToTab(navigation, 'Profile');
      }, 2000);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Not paylaşılırken bir hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAwareScroll showsVerticalScrollIndicator={false} className="flex-1 bg-ground" contentContainerClassName="px-4 pt-8 pb-[150px]" keyboardShouldPersistTaps="handled">
      <View className="bg-surface rounded-lg p-8" style={SHADOW_MD}>
        <Text className="text-3xl font-extrabold text-ink mb-6">Not Paylaş</Text>

        {!!noteRequest && (
          <View className="flex-row gap-2 bg-accent-soft border border-accent-line rounded-lg p-4 mb-6">
            <HeartHandshake size={20} color={isDark ? '#5A9690' : '#2F5755'} style={{ marginTop: 1 }} />
            <Text className="flex-1 text-sm text-accent leading-5">
              <Text style={{ fontWeight: '700' }}>"{noteRequest.course_name}"</Text> isteği için not yüklüyorsun. Notun onaylanınca istek
              otomatik olarak karşılanmış sayılır ve isteyen kullanıcıya haber verilir.
            </Text>
          </View>
        )}

        {!!error && (
          <View className="flex-row items-center gap-2 bg-danger-soft border border-danger-line rounded-lg p-4 mb-6">
            <AlertCircle size={20} color={isDark ? '#f87171' : '#b91c1c'} />
            <Text className="text-danger text-sm flex-1">{error}</Text>
          </View>
        )}
        {success && (
          <View className="flex-row items-center gap-2 bg-success-soft border border-success-line rounded-lg p-4 mb-6">
            <CheckCircle size={20} color={isDark ? '#4ade80' : '#15803d'} />
            <Text className="text-success text-sm flex-1">Not başarıyla paylaşıldı! Yönlendiriliyorsunuz...</Text>
          </View>
        )}

        <View className="mb-6">
          <Text className="text-sm font-medium text-ink2 mb-2">Başlık *</Text>
          <TextInput
            className="border border-line rounded-lg px-4 py-2 text-base text-ink"
            value={title}
            onChangeText={setTitle}
            placeholder="Örn: Matematik 101 Final Soruları"
            placeholderTextColor="#9ca3af"
          />
        </View>

        <View className="mb-6">
          <Text className="text-sm font-medium text-ink2 mb-2">Açıklama *</Text>
          <TextInput
            className="border border-line rounded-lg px-4 py-2 text-base text-ink min-h-24"
            style={{ textAlignVertical: 'top' }}
            value={content}
            onChangeText={setContent}
            placeholder="Notlar hakkında kısa bir açıklama yazın..."
            placeholderTextColor="#9ca3af"
            multiline
          />
        </View>

        {/* Web kaynağında Link alanı .input-field yerine ayrı, tutarsız class'larla
 yazılmış (soluk border, küçük radius, az padding) — birebir aynı görünmesi
 için burada da bilerek farklı. */}
        <View className="mb-6">
          <Text className="text-sm font-normal text-ink2 mb-2">Link</Text>
          <TextInput
            className="border border-line rounded px-2 py-2 text-base text-ink"
            value={link}
            onChangeText={setLink}
            placeholder="Ders notu link ise (ex: https://...)"
            placeholderTextColor="#9ca3af"
            autoCapitalize="none"
            keyboardType="url"
          />
        </View>

        <View className="mb-6">
          <Text className="text-sm font-medium text-gray-700 mb-2">Fakülte *</Text>
          <Pressable
            className="border border-line rounded-lg px-4 py-2 justify-center min-h-[40px]"
            onPress={() => setFacultyModalOpen(true)}
          >
            <Text className={`text-base ${faculty ? 'text-ink' : 'text-muted2'}`}>{faculty || 'Fakülte Seçin'}</Text>
          </Pressable>
        </View>

        <View className="mb-6">
          <Text className="text-sm font-medium text-ink2 mb-2">Bölüm *</Text>
          <Pressable
            className={`border border-line rounded-lg px-4 py-2 justify-center min-h-[40px] ${!faculty ? 'opacity-50' : ''}`}
            onPress={() => faculty && setDepartmentModalOpen(true)}
          >
            <Text className={`text-base ${department ? 'text-ink' : 'text-muted2'}`}>{department || 'Bölüm Seçin'}</Text>
          </Pressable>
        </View>

        <View className="mb-6">
          <Text className="text-sm font-medium text-ink2 mb-2">Dosya Yükle (Opsiyonel, Max 5, her biri 10MB)</Text>
          <Pressable className="border-2 border-line border-dashed rounded-lg pt-5 pb-6 px-6 items-center gap-1" onPress={handlePickFiles}>
            <Upload size={48} color={isDark ? '#6b7280' : '#9ca3af'} />
            <Text className="text-sm text-success font-medium mt-2">Dosya seçin</Text>
            <Text className="text-xs text-muted">PDF, DOC, PPT, JPG (max. 10MB her biri)</Text>
          </Pressable>
          {files.length > 0 && (
            <View className="mt-4 gap-2">
              {files.map((file, index) => (
                <View key={index} className="flex-row items-center justify-center gap-2">
                  <FileText size={20} color={isDark ? '#4ade80' : '#16a34a'} />
                  <Text className="flex-shrink text-sm text-success" numberOfLines={1}>
                    {file.name}
                  </Text>
                  <Pressable onPress={() => removeFile(index)} hitSlop={8}>
                    <X size={16} color={isDark ? '#f87171' : '#ef4444'} />
                  </Pressable>
                </View>
              ))}
              <Text className="text-xs text-muted text-center mt-1">{files.length} dosya seçildi</Text>
            </View>
          )}
        </View>

        <View className="flex-row justify-end gap-4 mt-2">
          <Pressable onPress={() => navigation.goBack()} className="py-2 px-4 rounded-lg">
            <Text className="text-ink2 text-base font-medium">İptal</Text>
          </Pressable>
          <Pressable
            className={`bg-brand rounded-lg py-2 px-4 items-center justify-center min-w-[84px] ${loading ? 'opacity-50' : ''}`}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? <ActivityIndicator color="#fff" /> : <Text className="text-white text-base font-medium">Paylaş</Text>}
          </Pressable>
        </View>
      </View>

      <OptionSheet
        visible={facultyModalOpen}
        title="Fakülte seç"
        options={faculties}
        value={faculty}
        onClose={() => setFacultyModalOpen(false)}
        onSelect={(value) => {
          setFaculty(value);
          setDepartment('');
        }}
      />
      <OptionSheet
        visible={departmentModalOpen}
        title="Bölüm seç"
        options={departmentOptions}
        value={department}
        onClose={() => setDepartmentModalOpen(false)}
        onSelect={setDepartment}
      />
    </KeyboardAwareScroll>
  );
}
