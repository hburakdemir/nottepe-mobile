import React, { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as DocumentPicker from 'expo-document-picker';
import { AlertCircle, CheckCircle, FileText, HeartHandshake, Upload, X } from 'lucide-react-native';
import { postsAPI } from '../../lib/api';
import { faculties, departments } from '../../data/departments';
import type { RootStackParamList } from '../../navigation/types';

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

function PickerModal({
  visible,
  title,
  options,
  onSelect,
  onClose,
}: {
  visible: boolean;
  title: string;
  options: string[];
  onSelect: (value: string) => void;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable className="flex-1 bg-black/40 justify-end" onPress={onClose}>
        <View className="bg-white rounded-t-2xl pt-4 pb-6 max-h-[70%]">
          <Text className="text-base font-bold text-gray-900 px-[18px] mb-2">{title}</Text>
          <FlatList
            data={options}
            keyExtractor={(item) => item}
            style={{ maxHeight: 420 }}
            renderItem={({ item }) => (
              <Pressable
                className="px-[18px] py-[13px] border-b border-gray-100"
                onPress={() => {
                  onSelect(item);
                  onClose();
                }}
              >
                <Text className="text-[14.5px] text-gray-700">{item}</Text>
              </Pressable>
            )}
          />
        </View>
      </Pressable>
    </Modal>
  );
}

export default function AddPostScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<any>();
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

  const departmentOptions = faculty ? departments[faculty] ?? [] : [];

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
        navigation.navigate('Profile');
      }, 2000);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Not paylaşılırken bir hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView className="flex-1 bg-primary" contentContainerClassName="px-4 py-8">
      <View className="bg-white rounded-lg p-8" style={SHADOW_MD}>
        <Text className="text-3xl font-bold text-gray-900 mb-6">Not Paylaş</Text>

        {!!noteRequest && (
          <View className="flex-row gap-2 bg-brand/10 border border-brand/30 rounded-lg p-4 mb-6">
            <HeartHandshake size={20} color="#2F5755" style={{ marginTop: 1 }} />
            <Text className="flex-1 text-sm text-brand leading-5">
              <Text style={{ fontWeight: '700' }}>"{noteRequest.course_name}"</Text> isteği için not yüklüyorsun. Notun
              onaylanınca istek otomatik olarak karşılanmış sayılır ve isteyen kullanıcıya haber verilir.
            </Text>
          </View>
        )}

        {!!error && (
          <View className="flex-row items-center gap-2 bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <AlertCircle size={20} color="#b91c1c" />
            <Text className="text-red-700 text-sm flex-1">{error}</Text>
          </View>
        )}
        {success && (
          <View className="flex-row items-center gap-2 bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
            <CheckCircle size={20} color="#15803d" />
            <Text className="text-green-700 text-sm flex-1">Not başarıyla paylaşıldı! Yönlendiriliyorsunuz...</Text>
          </View>
        )}

        <View className="mb-6">
        <Text className="text-sm font-medium text-gray-700 mb-2">Başlık *</Text>
        <TextInput
          className="border border-gray-300 rounded-lg px-4 py-2 text-base text-gray-900"
          value={title}
          onChangeText={setTitle}
          placeholder="Örn: Matematik 101 Final Soruları"
          placeholderTextColor="#9ca3af"
        />
      </View>

      <View className="mb-6">
        <Text className="text-sm font-medium text-gray-700 mb-2">Açıklama *</Text>
        <TextInput
          className="border border-gray-300 rounded-lg px-4 py-2 text-base text-gray-900 min-h-24"
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
        <Text className="text-sm font-normal text-gray-700 mb-2">Link</Text>
        <TextInput
          className="border border-gray-200 rounded px-2 py-2 text-base text-gray-900"
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
        <Pressable className="border border-gray-300 rounded-lg px-4 py-2 justify-center min-h-[40px]" onPress={() => setFacultyModalOpen(true)}>
          <Text className={`text-base ${faculty ? 'text-gray-900' : 'text-gray-400'}`}>
            {faculty || 'Fakülte Seçin'}
          </Text>
        </Pressable>
      </View>

      <View className="mb-6">
        <Text className="text-sm font-medium text-gray-700 mb-2">Bölüm *</Text>
        <Pressable
          className={`border border-gray-300 rounded-lg px-4 py-2 justify-center min-h-[40px] ${!faculty ? 'opacity-50' : ''}`}
          onPress={() => faculty && setDepartmentModalOpen(true)}
        >
          <Text className={`text-base ${department ? 'text-gray-900' : 'text-gray-400'}`}>
            {department || 'Bölüm Seçin'}
          </Text>
        </Pressable>
      </View>

      <View className="mb-6">
        <Text className="text-sm font-medium text-gray-700 mb-2">Dosya Yükle (Opsiyonel, Max 5, her biri 10MB)</Text>
        <Pressable className="border-2 border-gray-300 border-dashed rounded-lg pt-5 pb-6 px-6 items-center gap-1" onPress={handlePickFiles}>
          <Upload size={48} color="#9ca3af" />
          <Text className="text-sm text-green-600 font-medium mt-2">Dosya seçin</Text>
          <Text className="text-xs text-gray-500">PDF, DOC, PPT, JPG (max. 10MB her biri)</Text>
        </Pressable>
        {files.length > 0 && (
          <View className="mt-4 gap-2">
            {files.map((file, index) => (
              <View key={index} className="flex-row items-center justify-center gap-2">
                <FileText size={20} color="#16a34a" />
                <Text className="flex-shrink text-sm text-green-600" numberOfLines={1}>
                  {file.name}
                </Text>
                <Pressable onPress={() => removeFile(index)} hitSlop={8}>
                  <X size={16} color="#ef4444" />
                </Pressable>
              </View>
            ))}
            <Text className="text-xs text-gray-500 text-center mt-1">{files.length} dosya seçildi</Text>
          </View>
        )}
      </View>

      <View className="flex-row justify-end gap-4 mt-2">
        <Pressable onPress={() => navigation.goBack()} className="py-2 px-4 rounded-lg">
          <Text className="text-gray-800 text-base font-medium">İptal</Text>
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

      <PickerModal
        visible={facultyModalOpen}
        title="Fakülte Seçin"
        options={faculties}
        onClose={() => setFacultyModalOpen(false)}
        onSelect={(value) => {
          setFaculty(value);
          setDepartment('');
        }}
      />
      <PickerModal
        visible={departmentModalOpen}
        title="Bölüm Seçin"
        options={departmentOptions}
        onClose={() => setDepartmentModalOpen(false)}
        onSelect={setDepartment}
      />
    </ScrollView>
  );
}
