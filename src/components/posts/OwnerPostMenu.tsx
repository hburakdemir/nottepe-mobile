import React, { useState } from 'react';
import { Pressable, type StyleProp, type ViewStyle } from 'react-native';
import { MoreHorizontal } from 'lucide-react-native';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../context/AuthContext';
import { useThemeColors } from '../../context/ThemeContext';
import { patchPostInCache } from '../../lib/postCache';
import OptionSheet from '../layout/OptionSheet';
import EditPostSheet from './EditPostSheet';

interface Props {
  postId: string | number;
  isAnonymous: boolean;
  /** Kartın yerel state'i — önbellekte olmayan listeler (profil "Postlar") için. Detay ekranı önbellekten okuduğu için vermiyor. */
  onAnonymousChange?: (isAnonymous: boolean) => void;
  /** "Sil" öğesi — onayı (Alert) çağıranın silme işleyicisi soruyor. */
  onDelete?: () => void;
  size?: number;
  style?: StyleProp<ViewStyle>;
}

const ACTION_EDIT = 'edit';
const ACTION_DELETE = 'delete';

// Notun sahibine özel "…" menüsü. ModerationMenu (Bildir/Engelle) kendi
// içeriğinde hiç çizilmiyor; sahibi burayı görüyor. Web karşılığı
// OwnerPostMenu.jsx. Öğeler: Düzenle → EditPostSheet (anonimlik), Sil (kullanıcı
// isteği: silme ayrı çöp kutusu ikonu yerine bu menüde).
export default function OwnerPostMenu({ postId, isAnonymous, onAnonymousChange, onDelete, size = 18, style }: Props) {
  const colors = useThemeColors();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const handleSaved = (next: boolean) => {
    onAnonymousChange?.(next);
    // Anonimken çekilmiş kopyalarda `username` null — anonimlik kalkınca sahibin
    // adı hemen görünsün. Avatar alanları bir sonraki tazelemede geliyor.
    patchPostInCache(
      queryClient,
      postId,
      next ? { is_anonymous: true } : { is_anonymous: false, username: user?.username ?? null, full_name: user?.full_name ?? null }
    );
  };

  return (
    <>
      <Pressable
        onPress={() => setMenuOpen(true)}
        hitSlop={10}
        style={style}
        accessibilityRole="button"
        accessibilityLabel={onDelete ? 'Diğer seçenekler: düzenle, sil' : 'Diğer seçenekler: düzenle'}
      >
        <MoreHorizontal size={size} color={colors.muted} />
      </Pressable>
      {/* Sayfalar yalnızca açıkken mount (bkz. ModerationMenu). */}
      {menuOpen && (
        <OptionSheet
          visible={menuOpen}
          title="Seçenekler"
          options={[{ value: ACTION_EDIT, label: 'Düzenle' }, ...(onDelete ? [{ value: ACTION_DELETE, label: 'Sil' }] : [])]}
          searchable={false}
          onClose={() => setMenuOpen(false)}
          onSelect={(value) => {
            setMenuOpen(false);
            // OptionSheet'in Modal'ı kapanırken ikinci bir Modal açmak iOS'ta
            // yutuluyor (bkz. ModerationMenu, CoachMarks) — kapanış bitince aç.
            setTimeout(() => {
              if (value === ACTION_EDIT) setEditOpen(true);
              else if (value === ACTION_DELETE) onDelete?.();
            }, 350);
          }}
        />
      )}
      {editOpen && (
        <EditPostSheet
          visible={editOpen}
          postId={postId}
          isAnonymous={isAnonymous}
          onClose={() => setEditOpen(false)}
          onSaved={handleSaved}
        />
      )}
    </>
  );
}
