import React, { useCallback, useState } from 'react';
import { Alert, Pressable, type StyleProp, type ViewStyle } from 'react-native';
import { MoreHorizontal } from 'lucide-react-native';
import { useQueryClient } from '@tanstack/react-query';
import { moderationAPI, type ReportTargetType } from '../../lib/api';
import { emitBlockChanged } from '../../lib/moderationEvents';
import { useAuth } from '../../context/AuthContext';
import { useThemeColors } from '../../context/ThemeContext';
import OptionSheet from '../layout/OptionSheet';
import ReportSheet from './ReportSheet';

interface Props {
  targetType: ReportTargetType;
  targetId: string | number;
  /** İçeriğin sahibi. Kendi içeriğinde menü hiç çizilmez. */
  ownerId?: number | null;
  ownerUsername?: string | null;
  /** Engelleme başarılı olunca (ör. detay ekranından geri dönmek için). */
  onBlocked?: (userId: number) => void;
  size?: number;
  style?: StyleProp<ViewStyle>;
}

const ACTION_REPORT = 'report';
const ACTION_BLOCK = 'block';

// İçeriklerin "…" menüsü: Bildir + Kullanıcıyı engelle (App Store 1.2).
// Engelleme sunucuda kalıcı ve web ile ortak; sonrasında tüm react-query
// listeleri tazeleniyor (engellenen kişinin içeriği sunucuda ayıklandığı için
// listelerden düşüyor), react-query dışı listelere de `emitBlockChanged` ile
// haber veriliyor.
export default function ModerationMenu({ targetType, targetId, ownerId, ownerUsername, onBlocked, size = 18, style }: Props) {
  const { user } = useAuth();
  const colors = useThemeColors();
  const queryClient = useQueryClient();
  const [menuOpen, setMenuOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);

  const block = useCallback(async () => {
    if (ownerId == null) return;
    try {
      await moderationAPI.block(ownerId);
      emitBlockChanged(ownerId, true);
      queryClient.invalidateQueries();
      onBlocked?.(ownerId);
      Alert.alert('Engellendi', `${ownerUsername ? '@' + ownerUsername : 'Kullanıcı'} engellendi. İçerikleri artık sana gösterilmeyecek.`);
    } catch (err: any) {
      Alert.alert('Engellenemedi', err.response?.data?.message || 'Bir sorun oluştu, tekrar dene.');
    }
  }, [ownerId, ownerUsername, onBlocked, queryClient]);

  const confirmBlock = useCallback(() => {
    Alert.alert(
      `${ownerUsername ? '@' + ownerUsername : 'Kullanıcı'} engellensin mi?`,
      'Gönderileri, yorumları ve diğer içerikleri sana gösterilmeyecek. Engeli profilinden ya da Profil → Düzenle ekranından istediğin zaman kaldırabilirsin.',
      [
        { text: 'Vazgeç', style: 'cancel' },
        { text: 'Engelle', style: 'destructive', onPress: block },
      ]
    );
  }, [ownerUsername, block]);

  if (!user || (ownerId != null && Number(ownerId) === Number(user.id))) return null;

  const options = [
    { value: ACTION_REPORT, label: 'Bildir' },
    ...(ownerId != null
      ? [{ value: ACTION_BLOCK, label: ownerUsername ? `@${ownerUsername} kullanıcısını engelle` : 'Kullanıcıyı engelle' }]
      : []),
  ];

  return (
    <>
      <Pressable
        onPress={() => setMenuOpen(true)}
        hitSlop={10}
        style={style}
        accessibilityRole="button"
        accessibilityLabel="Diğer seçenekler: bildir, engelle"
      >
        <MoreHorizontal size={size} color={colors.muted} />
      </Pressable>
      {/* Sayfalar yalnızca açıkken mount: menü akıştaki HER kartta var, kapalı
          Modal'ları kart başına taşımak liste render'ına boşuna yük. */}
      {menuOpen && (
        <OptionSheet
          visible={menuOpen}
          title="Seçenekler"
          options={options}
          searchable={false}
          onClose={() => setMenuOpen(false)}
          onSelect={(value) => {
            setMenuOpen(false);
            // OptionSheet'in Modal'ı kapanırken ikinci bir Modal/Alert açmak iOS'ta
            // yutulabiliyor — bir kare sonra aç.
            setTimeout(() => {
              if (value === ACTION_REPORT) setReportOpen(true);
              else if (value === ACTION_BLOCK) confirmBlock();
            }, 350);
          }}
        />
      )}
      {reportOpen && <ReportSheet visible={reportOpen} targetType={targetType} targetId={targetId} onClose={() => setReportOpen(false)} />}
    </>
  );
}
