import React, { useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { Ban, Check, ImagePlus, PackageSearch, Plus, Trash2, X } from 'lucide-react-native';
import { lostItemAPI } from '../../lib/api';
import { useTheme } from '../../context/ThemeContext';
import KeyboardAvoider from '../layout/KeyboardAvoider';
import OptionSheet from '../layout/OptionSheet';
import { success } from '../../lib/haptics';
import {
  CATEGORY_LABELS,
  DAY_CHOICES,
  LOST_ITEM_CAMPUSES,
  LOST_ITEM_CATEGORIES,
  localDateString,
  type LostItemType,
} from './lostItemMeta';

const MAX_IMAGES = 3;
const MAX_OPTIONS = 5;

type QuestionMode = 'none' | 'text' | 'choice';

interface Props {
  initialType: LostItemType;
  onClose: () => void;
  onCreated: () => void;
}

// Yeni ilan. İletişim bilgisi alanı bilerek yok — iletişim başvuru + bildirim
// üzerinden yürür. "Buldum" ilanına opsiyonel doğrulama sorusu eklenebilir.
// Görseller ham gider; WebP dönüşümü sunucuda (sharp).
export default function CreateLostItemModal({ initialType, onClose, onCreated }: Props) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const brand = isDark ? '#5A9690' : '#2F5755';
  const muted = isDark ? '#9ca3af' : '#6b7280';

  const [type, setType] = useState<LostItemType>(initialType);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [campus, setCampus] = useState<string>('Beytepe');
  const [location, setLocation] = useState('');
  const [daysAgo, setDaysAgo] = useState<number | null>(0);
  const [images, setImages] = useState<ImagePicker.ImagePickerAsset[]>([]);

  const [questionMode, setQuestionMode] = useState<QuestionMode>('none');
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState<string[]>(['', '']);
  const [answerIndex, setAnswerIndex] = useState<number | null>(null);

  const [ack, setAck] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showCategory, setShowCategory] = useState(false);
  const [showCampus, setShowCampus] = useState(false);

  const pickImages = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('İzin gerekli', 'Fotoğraf seçmek için galeri izni vermelisin.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: MAX_IMAGES - images.length,
      // quality < 1 → iOS'ta HEIC yerine JPEG'e sıkıştırılır; sunucu HEIC kabul etmiyor.
      quality: 0.8,
    });
    if (result.canceled) return;
    setImages((prev) => [...prev, ...result.assets].slice(0, MAX_IMAGES));
  };

  const setOption = (i: number, v: string) => setOptions((prev) => prev.map((o, j) => (j === i ? v : o)));
  const removeOption = (i: number) => {
    setOptions((prev) => prev.filter((_, j) => j !== i));
    setAnswerIndex((prev) => (prev === i ? null : prev !== null && prev > i ? prev - 1 : prev));
  };

  const handleSubmit = async () => {
    if (!title.trim() || !category) {
      Alert.alert('Eksik bilgi', 'Başlık ve kategori zorunlu');
      return;
    }
    const withQuestion = type === 'found' && questionMode !== 'none';
    if (withQuestion && !question.trim()) {
      Alert.alert('Eksik bilgi', "Doğrulama sorusunu yaz ya da 'Soru yok'u seç");
      return;
    }
    if (withQuestion && questionMode === 'choice') {
      if (options.some((o) => !o.trim())) {
        Alert.alert('Eksik bilgi', 'Boş şık bırakma');
        return;
      }
      if (answerIndex === null) {
        Alert.alert('Eksik bilgi', 'Doğru şıkkı işaretle');
        return;
      }
    }
    if (!ack) {
      Alert.alert('Onay gerekli', 'İlanın ticari amaçlı olmadığını onayla');
      return;
    }

    const fd = new FormData();
    fd.append('type', type);
    fd.append('title', title.trim());
    fd.append('description', description.trim());
    fd.append('category', category);
    fd.append('campus', campus);
    fd.append('location', location.trim());
    if (daysAgo !== null) fd.append('item_date', localDateString(daysAgo));
    fd.append('non_commercial_ack', 'true');
    if (withQuestion) {
      fd.append('verify_question', question.trim());
      if (questionMode === 'choice') {
        fd.append('verify_options', JSON.stringify(options.map((o) => o.trim())));
        fd.append('verify_answer_index', String(answerIndex));
      }
    }
    images.forEach((img, i) => {
      const mime = img.mimeType || 'image/jpeg';
      const ext = mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg';
      fd.append('images', { uri: img.uri, name: `foto-${i + 1}.${ext}`, type: mime } as any);
    });

    setSaving(true);
    try {
      await lostItemAPI.create(fd);
      success();
      onCreated();
      onClose();
    } catch (err: any) {
      Alert.alert('Hata', err.response?.data?.message || 'İlan oluşturulamadı');
    } finally {
      setSaving(false);
    }
  };

  const segment = (active: boolean) => [styles.segment, active && { backgroundColor: '#2F5755', borderColor: '#2F5755' }];

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoider>
        <View style={styles.overlay}>
          <View className="bg-surface" style={styles.sheet}>
            <View style={styles.headerRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <PackageSearch size={20} color={brand} />
                <Text className="text-ink" style={styles.title}>
                  Kayıp Eşya İlanı
                </Text>
              </View>
              <Pressable onPress={onClose} hitSlop={8}>
                <X size={20} color={muted} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ marginTop: 14 }} keyboardShouldPersistTaps="handled">
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {(['lost', 'found'] as const).map((t) => (
                  <Pressable key={t} className="border-line" style={segment(type === t)} onPress={() => setType(t)}>
                    <Text className={type === t ? '' : 'text-muted'} style={[styles.segmentText, type === t && { color: '#fff' }]}>
                      {t === 'lost' ? 'Kaybettim' : 'Buldum'}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Text className="text-ink" style={styles.label}>
                Başlık *
              </Text>
              <TextInput
                className="text-ink border-line"
                style={styles.input}
                value={title}
                onChangeText={setTitle}
                maxLength={120}
                placeholder={type === 'found' ? 'Örn: Siyah kablosuz kulaklık' : 'Örn: Mavi öğrenci kartı kılıfı'}
                placeholderTextColor="#9ca3af"
              />

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text className="text-ink" style={styles.label}>
                    Kategori *
                  </Text>
                  <Pressable className="border-line" style={styles.selectBox} onPress={() => setShowCategory(true)}>
                    <Text className={category ? 'text-ink' : 'text-muted'} style={styles.selectText} numberOfLines={1}>
                      {category ? CATEGORY_LABELS[category] : 'Seç'}
                    </Text>
                  </Pressable>
                </View>
                <View style={{ flex: 1 }}>
                  <Text className="text-ink" style={styles.label}>
                    Kampüs *
                  </Text>
                  <Pressable className="border-line" style={styles.selectBox} onPress={() => setShowCampus(true)}>
                    <Text className="text-ink" style={styles.selectText}>
                      {campus}
                    </Text>
                  </Pressable>
                </View>
              </View>

              <Text className="text-ink" style={styles.label}>
                {type === 'found' ? 'Bulunduğu yer' : 'Kaybolduğu yer'}
              </Text>
              <TextInput
                className="text-ink border-line"
                style={styles.input}
                value={location}
                onChangeText={setLocation}
                maxLength={150}
                placeholder="Örn: MM Amfisi"
                placeholderTextColor="#9ca3af"
              />

              <Text className="text-ink" style={styles.label}>
                Ne zaman?
              </Text>
              <View style={styles.chipWrap}>
                {[...DAY_CHOICES, { daysAgo: null, label: 'Hatırlamıyorum' }].map((c) => {
                  const active = daysAgo === c.daysAgo;
                  return (
                    <Pressable
                      key={c.label}
                      className={active ? 'bg-brand' : 'bg-inset'}
                      style={styles.dayChip}
                      onPress={() => setDaysAgo(c.daysAgo)}
                    >
                      <Text className={active ? '' : 'text-muted'} style={[styles.dayChipText, active && { color: '#fff' }]}>
                        {c.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text className="text-ink" style={styles.label}>
                Açıklama
              </Text>
              <TextInput
                className="text-ink border-line"
                style={[styles.input, styles.textArea]}
                value={description}
                onChangeText={setDescription}
                maxLength={1000}
                multiline
                placeholder={
                  type === 'found'
                    ? 'Ayırt edici detayları yazma — sahibini doğrulamak için saklayabilirsin.'
                    : 'Rengi, markası, ayırt edici özellikleri...'
                }
                placeholderTextColor="#9ca3af"
              />

              <Text className="text-ink" style={styles.label}>
                Fotoğraf (en fazla {MAX_IMAGES})
              </Text>
              <View style={styles.chipWrap}>
                {images.map((img, i) => (
                  <View key={img.uri} style={styles.thumb}>
                    <Image source={{ uri: img.uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
                    <Pressable
                      style={styles.thumbRemove}
                      hitSlop={6}
                      onPress={() => setImages((prev) => prev.filter((_, j) => j !== i))}
                    >
                      <X size={12} color="#fff" />
                    </Pressable>
                  </View>
                ))}
                {images.length < MAX_IMAGES && (
                  <Pressable className="border-line" style={[styles.thumb, styles.thumbAdd]} onPress={pickImages}>
                    <ImagePlus size={22} color={muted} />
                    <Text className="text-muted" style={{ fontSize: 10, marginTop: 2 }}>
                      Ekle
                    </Text>
                  </Pressable>
                )}
              </View>
              {type === 'found' && (
                <Text className="text-muted2" style={styles.hint}>
                  Kart/kimlik gibi kişisel bilgi içeren eşyalarda bilgileri görünmeyecek şekilde çek.
                </Text>
              )}

              {type === 'found' && (
                <View className="border-line" style={styles.questionBox}>
                  <Text className="text-ink" style={{ fontSize: 14, fontWeight: '600' }}>
                    Doğrulama sorusu (isteğe bağlı)
                  </Text>
                  <Text className="text-muted2" style={styles.hint}>
                    "Bu benim" diyen kişiye sorulur, cevabını sadece sen görürsün.
                  </Text>
                  <View className="bg-inset" style={styles.modeRow}>
                    {(
                      [
                        { value: 'none', label: 'Soru yok' },
                        { value: 'text', label: 'Açık uçlu' },
                        { value: 'choice', label: 'Şıklı' },
                      ] as const
                    ).map((m) => {
                      const active = questionMode === m.value;
                      return (
                        <Pressable
                          key={m.value}
                          className={active ? 'bg-surface' : ''}
                          style={styles.modeBtn}
                          onPress={() => setQuestionMode(m.value)}
                        >
                          <Text className={active ? 'text-accent' : 'text-muted'} style={{ fontSize: 12, fontWeight: '600' }}>
                            {m.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>

                  {questionMode !== 'none' && (
                    <TextInput
                      className="text-ink border-line"
                      style={[styles.input, { marginTop: 10 }]}
                      value={question}
                      onChangeText={setQuestion}
                      maxLength={200}
                      placeholder="Örn: Kılıfın içinde ne var?"
                      placeholderTextColor="#9ca3af"
                    />
                  )}

                  {questionMode === 'choice' && (
                    <View style={{ marginTop: 8, gap: 8 }}>
                      {options.map((opt, i) => {
                        const correct = answerIndex === i;
                        return (
                          <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <Pressable
                              onPress={() => setAnswerIndex(i)}
                              hitSlop={6}
                              style={[styles.radio, { borderColor: correct ? '#16a34a' : muted }, correct && { backgroundColor: '#16a34a' }]}
                              accessibilityLabel="Doğru şık"
                            >
                              {correct && <Check size={12} color="#fff" />}
                            </Pressable>
                            <TextInput
                              className="text-ink border-line"
                              style={[styles.input, { flex: 1 }]}
                              value={opt}
                              onChangeText={(v) => setOption(i, v)}
                              maxLength={80}
                              placeholder={`${i + 1}. şık`}
                              placeholderTextColor="#9ca3af"
                            />
                            {options.length > 2 && (
                              <Pressable onPress={() => removeOption(i)} hitSlop={6}>
                                <Trash2 size={16} color={muted} />
                              </Pressable>
                            )}
                          </View>
                        );
                      })}
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        {options.length < MAX_OPTIONS ? (
                          <Pressable
                            style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
                            onPress={() => setOptions((prev) => [...prev, ''])}
                          >
                            <Plus size={14} color={brand} />
                            <Text className="text-accent" style={{ fontSize: 12, fontWeight: '600' }}>
                              Şık ekle
                            </Text>
                          </Pressable>
                        ) : (
                          <View />
                        )}
                        <Text className="text-muted2" style={{ fontSize: 11 }}>
                          Doğru şıkkı soldan işaretle
                        </Text>
                      </View>
                    </View>
                  )}
                </View>
              )}

              <Pressable style={styles.ackRow} onPress={() => setAck((v) => !v)}>
                <View style={[styles.checkbox, { borderColor: ack ? '#2F5755' : muted }, ack && { backgroundColor: '#2F5755' }]}>
                  {ack && <Check size={12} color="#fff" />}
                </View>
                <Ban size={14} color="#ef4444" style={{ marginTop: 2 }} />
                <Text className="text-ink" style={{ fontSize: 13, flex: 1, lineHeight: 18 }}>
                  Bu ilan ticari amaçlı değil; satış, ödül/ücret talebi veya reklam içermiyor.
                </Text>
              </Pressable>
            </ScrollView>

            <Pressable style={[styles.submitBtn, saving && { opacity: 0.6 }]} onPress={handleSubmit} disabled={saving}>
              <Text style={styles.submitBtnText}>{saving ? 'Yayınlanıyor...' : 'İlanı Yayınla'}</Text>
            </Pressable>
          </View>
        </View>

        <OptionSheet
          visible={showCategory}
          title="Kategori"
          options={LOST_ITEM_CATEGORIES}
          value={category}
          onSelect={setCategory}
          onClose={() => setShowCategory(false)}
        />
        <OptionSheet
          visible={showCampus}
          title="Kampüs"
          options={LOST_ITEM_CAMPUSES}
          value={campus}
          onSelect={setCampus}
          onClose={() => setShowCampus(false)}
        />
      </KeyboardAvoider>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 16 },
  sheet: { borderRadius: 12, padding: 20, maxHeight: '90%' },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 19, fontWeight: '800' },
  label: { fontSize: 14, fontWeight: '500', marginBottom: 4, marginTop: 14 },
  input: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 9, fontSize: 14 },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  selectBox: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 11 },
  selectText: { fontSize: 14 },
  segment: { flex: 1, borderWidth: 1, borderRadius: 8, alignItems: 'center', paddingVertical: 10 },
  segmentText: { fontSize: 14, fontWeight: '600' },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  dayChip: { borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7 },
  dayChipText: { fontSize: 13, fontWeight: '600' },
  thumb: { width: 72, height: 72, borderRadius: 8, overflow: 'hidden' },
  thumbAdd: { borderWidth: 1.5, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
  thumbRemove: { position: 'absolute', top: 4, right: 4, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 10, padding: 2 },
  hint: { fontSize: 11.5, marginTop: 4, lineHeight: 16 },
  questionBox: { borderWidth: 1, borderRadius: 10, padding: 12, marginTop: 16 },
  modeRow: { flexDirection: 'row', borderRadius: 8, padding: 3, marginTop: 10 },
  modeBtn: { flex: 1, alignItems: 'center', paddingVertical: 7, borderRadius: 6 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  ackRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: 18 },
  checkbox: { width: 20, height: 20, borderRadius: 5, borderWidth: 2, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  submitBtn: { backgroundColor: '#2F5755', borderRadius: 8, alignItems: 'center', paddingVertical: 11, marginTop: 14 },
  submitBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
