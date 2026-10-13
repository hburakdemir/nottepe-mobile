import React, { useState } from 'react';
import { Alert, Pressable, type StyleProp, type ViewStyle } from 'react-native';
import { MoreHorizontal } from 'lucide-react-native';
import { useQueryClient } from '@tanstack/react-query';
import { lostItemAPI } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { useThemeColors } from '../../context/ThemeContext';
import OptionSheet from '../layout/OptionSheet';
import ModerationMenu from '../moderation/ModerationMenu';
import type { LostItem } from './lostItemMeta';

interface Props {
  item: LostItem;
  /** Silme ya da engelleme sonrası (ör. detay modalını kapatmak için). */
  onGone?: () => void;
  size?: number;
  style?: StyleProp<ViewStyle>;
}

const ACTION_DELETE = 'delete';

// İlanın "…" menüsü. Başkasının ilanında Bildir/Engelle (ModerationMenu),
// kendi ilanında Sil — notlardaki gibi silme ayrı düğme değil bu menüde
// (bkz. OwnerPostMenu).
export default function LostItemMenu({ item, onGone, size = 18, style }: Props) {
  const { user } = useAuth();
  const colors = useThemeColors();
  const queryClient = useQueryClient();
  const [menuOpen, setMenuOpen] = useState(false);
  const isOwner = user?.id === item.user_id;

  if (!isOwner) {
    return (
      <ModerationMenu
        targetType="lost_item"
        targetId={item.id}
        ownerId={item.user_id}
        ownerUsername={item.owner_username}
        onBlocked={() => onGone?.()}
        size={size}
        style={style}
      />
    );
  }

  const confirmDelete = () =>
    Alert.alert('İlanı sil', 'İlan ve fotoğrafları kalıcı olarak silinsin mi?', [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: async () => {
          try {
            await lostItemAPI.delete(item.id);
            queryClient.invalidateQueries({ queryKey: ['lostItems'] });
            onGone?.();
          } catch (err: any) {
            Alert.alert('Hata', err?.response?.data?.message || 'Silinemedi');
          }
        },
      },
    ]);

  return (
    <>
      <Pressable
        onPress={() => setMenuOpen(true)}
        hitSlop={10}
        style={style}
        accessibilityRole="button"
        accessibilityLabel="Diğer seçenekler: sil"
      >
        <MoreHorizontal size={size} color={colors.muted} />
      </Pressable>
      {menuOpen && (
        <OptionSheet
          visible={menuOpen}
          title="Seçenekler"
          options={[{ value: ACTION_DELETE, label: 'Sil' }]}
          searchable={false}
          onClose={() => setMenuOpen(false)}
          onSelect={(value) => {
            setMenuOpen(false);
            // OptionSheet'in Modal'ı kapanırken Alert açmak iOS'ta yutuluyor
            // (bkz. OwnerPostMenu) — kapanış bitince aç.
            setTimeout(() => {
              if (value === ACTION_DELETE) confirmDelete();
            }, 350);
          }}
        />
      )}
    </>
  );
}
