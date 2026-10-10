import React, { useEffect, useState } from 'react';
import { Alert, Modal, Pressable, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { VenetianMask, X } from 'lucide-react-native';
import { useThemeColors } from '../../context/ThemeContext';
import { postsAPI } from '../../lib/api';
import { tap } from '../../lib/haptics';

interface Props {
  visible: boolean;
  postId: string | number;
  isAnonymous: boolean;
  onClose: () => void;
  onSaved: (isAnonymous: boolean) => void;
}

// "Notu düzenle" — OwnerPostMenu → Düzenle. Web karşılığı EditPostModal.jsx.
// Şimdilik tek ayar: anonimlik (not bazlı, iki yönlü). Başlık/içerik düzenleme
// yok: onaylı notun yeniden moderasyona girmesi gerekir.
//
// Kabuk NotificationSettingsSheet ile aynı ölçülerde (o da OptionSheet'ten
// kopya) — alttan açılan paneller yan yana aynı bileşen gibi dursun.
export default function EditPostSheet({ visible, postId, isAnonymous, onClose, onSaved }: Props) {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const [value, setValue] = useState(isAnonymous);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) setValue(isAnonymous);
  }, [visible, isAnonymous]);

  const close = () => {
    if (!saving) onClose();
  };

  const save = async () => {
    if (value === isAnonymous) {
      onClose();
      return;
    }
    setSaving(true);
    try {
      await postsAPI.setAnonymous(postId, value);
      onSaved(value);
      onClose();
    } catch (err: any) {
      Alert.alert('Hata', err.response?.data?.message || 'Not güncellenemedi.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <Pressable className="flex-1 justify-end" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} onPress={close}>
        <Pressable
          className="bg-surface rounded-t-[18px] px-4 pt-4"
          style={{ paddingBottom: Math.max(insets.bottom, 16) + 8 }}
          onPress={() => {}}
        >
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-ink text-base font-bold flex-1" numberOfLines={1}>
              Notu düzenle
            </Text>
            <Pressable onPress={close} hitSlop={10} accessibilityLabel="Kapat">
              <X size={20} color={colors.muted} />
            </Pressable>
          </View>

          <View className="flex-row items-start gap-2.5 py-1">
            <VenetianMask size={18} color={colors.ink2} style={{ marginTop: 1 }} />
            <View className="flex-1">
              <Text className="text-ink2 text-[13px] font-semibold">Anonim olarak göster</Text>
              <Text className="text-muted text-[11px] leading-[15px] mt-1">
                Notta adın, avatarın ve rozetlerin görünmez; profilinde ve liderlik tablosunda listelenmez. Moderatörler
                sahibini görebilir.
              </Text>
            </View>
            <Switch
              value={value}
              onValueChange={(v) => {
                tap();
                setValue(v);
              }}
              disabled={saving}
              trackColor={{ true: '#2F5755' }}
              accessibilityLabel="Anonim olarak göster"
            />
          </View>

          <View className="flex-row gap-2.5 mt-4">
            <Pressable className="flex-1 items-center border border-line rounded-[10px] py-3" onPress={close} disabled={saving}>
              <Text className="text-ink2 text-[13.5px] font-semibold">Vazgeç</Text>
            </Pressable>
            <Pressable
              className="flex-1 items-center bg-brand rounded-[10px] py-3"
              style={saving ? { opacity: 0.6 } : undefined}
              onPress={save}
              disabled={saving}
            >
              <Text className="text-white text-[13.5px] font-bold">{saving ? 'Kaydediliyor...' : 'Kaydet'}</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
