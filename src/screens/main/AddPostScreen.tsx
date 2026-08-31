import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import * as DocumentPicker from 'expo-document-picker';
import { AlertCircle, CheckCircle, FileText, Upload, X } from 'lucide-react-native';
import { postsAPI } from '../../lib/api';
import { faculties, departments } from '../../data/departments';
import type { MainTabParamList } from '../../navigation/types';

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
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <View style={styles.modalSheet}>
          <Text style={styles.modalTitle}>{title}</Text>
          <FlatList
            data={options}
            keyExtractor={(item) => item}
            style={{ maxHeight: 420 }}
            renderItem={({ item }) => (
              <Pressable
                style={styles.modalOption}
                onPress={() => {
                  onSelect(item);
                  onClose();
                }}
              >
                <Text style={styles.modalOptionText}>{item}</Text>
              </Pressable>
            )}
          />
        </View>
      </Pressable>
    </Modal>
  );
}

export default function AddPostScreen() {
  const navigation = useNavigation<BottomTabNavigationProp<MainTabParamList>>();

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [link, setLink] = useState('');
  const [faculty, setFaculty] = useState('');
  const [department, setDepartment] = useState('');
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
        navigation.navigate('Home');
      }, 1200);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Not paylaşılırken bir hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Not Paylaş</Text>

      {!!error && (
        <View style={styles.alertError}>
          <AlertCircle size={16} color="#b91c1c" />
          <Text style={styles.alertErrorText}>{error}</Text>
        </View>
      )}
      {success && (
        <View style={styles.alertSuccess}>
          <CheckCircle size={16} color="#15803d" />
          <Text style={styles.alertSuccessText}>Not başarıyla paylaşıldı!</Text>
        </View>
      )}

      <View style={styles.field}>
        <Text style={styles.label}>Başlık *</Text>
        <TextInput
          style={styles.input}
          value={title}
          onChangeText={setTitle}
          placeholder="Örn: Matematik 101 Final Soruları"
          placeholderTextColor="#9ca3af"
        />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Açıklama *</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={content}
          onChangeText={setContent}
          placeholder="Notlar hakkında kısa bir açıklama yazın..."
          placeholderTextColor="#9ca3af"
          multiline
        />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Link</Text>
        <TextInput
          style={styles.input}
          value={link}
          onChangeText={setLink}
          placeholder="Ders notu link ise (ex: https://...)"
          placeholderTextColor="#9ca3af"
          autoCapitalize="none"
          keyboardType="url"
        />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Fakülte *</Text>
        <Pressable style={styles.selectBox} onPress={() => setFacultyModalOpen(true)}>
          <Text style={faculty ? styles.selectText : styles.selectPlaceholder}>
            {faculty || 'Fakülte Seçin'}
          </Text>
        </Pressable>
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Bölüm *</Text>
        <Pressable
          style={[styles.selectBox, !faculty && styles.selectBoxDisabled]}
          onPress={() => faculty && setDepartmentModalOpen(true)}
        >
          <Text style={department ? styles.selectText : styles.selectPlaceholder}>
            {department || 'Bölüm Seçin'}
          </Text>
        </Pressable>
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Dosya Yükle (Opsiyonel, Max 5, her biri 10MB)</Text>
        <Pressable style={styles.uploadBox} onPress={handlePickFiles}>
          <Upload size={28} color="#9ca3af" />
          <Text style={styles.uploadText}>Dosya seçin</Text>
          <Text style={styles.uploadHint}>PDF, DOC, PPT, JPG (max. 10MB her biri)</Text>
        </Pressable>
        {files.length > 0 && (
          <View style={{ marginTop: 10, gap: 8 }}>
            {files.map((file, index) => (
              <View key={index} style={styles.fileRow}>
                <FileText size={15} color="#15803d" />
                <Text style={styles.fileName} numberOfLines={1}>
                  {file.name}
                </Text>
                <Pressable onPress={() => removeFile(index)} hitSlop={8}>
                  <X size={16} color="#dc2626" />
                </Pressable>
              </View>
            ))}
          </View>
        )}
      </View>

      <Pressable
        style={[styles.submitBtn, loading && { opacity: 0.6 }]}
        onPress={handleSubmit}
        disabled={loading}
      >
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>Paylaş</Text>}
      </Pressable>

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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 16, paddingBottom: 60, gap: 4 },
  title: { fontSize: 24, fontWeight: '700', color: '#111827', marginBottom: 12 },
  alertError: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
  },
  alertErrorText: { color: '#b91c1c', fontSize: 13, flex: 1 },
  alertSuccess: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
  },
  alertSuccessText: { color: '#15803d', fontSize: 13, flex: 1 },
  field: { marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#111827',
  },
  textArea: { minHeight: 90, textAlignVertical: 'top' },
  selectBox: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  selectBoxDisabled: { opacity: 0.5 },
  selectText: { fontSize: 14, color: '#111827' },
  selectPlaceholder: { fontSize: 14, color: '#9ca3af' },
  uploadBox: {
    borderWidth: 2,
    borderColor: '#d1d5db',
    borderStyle: 'dashed',
    borderRadius: 12,
    paddingVertical: 24,
    alignItems: 'center',
    gap: 4,
  },
  uploadText: { fontSize: 13.5, color: '#15803d', fontWeight: '600', marginTop: 4 },
  uploadHint: { fontSize: 11.5, color: '#9ca3af' },
  fileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#f0fdf4',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  fileName: { flex: 1, fontSize: 12.5, color: '#15803d' },
  submitBtn: {
    backgroundColor: '#2F5755',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  submitText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingTop: 16,
    paddingBottom: 24,
    maxHeight: '70%',
  },
  modalTitle: { fontSize: 16, fontWeight: '700', color: '#111827', paddingHorizontal: 18, marginBottom: 8 },
  modalOption: { paddingHorizontal: 18, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  modalOptionText: { fontSize: 14.5, color: '#374151' },
});
