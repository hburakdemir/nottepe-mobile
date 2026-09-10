import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Award, X } from 'lucide-react-native';
import { BADGE_ICONS } from '../constants/badgeIcons';
import { getFileUrl } from '../lib/config';

export interface Badge {
  id: number;
  name: string;
  description?: string;
  icon_type?: 'lucide' | 'upload';
  icon_value?: string;
  icon_color?: string | null;
  bg_color?: string | null;
  text_color?: string | null;
  is_visible?: boolean;
}

function hexToBg(color: string) {
  return `${color}26`;
}

function BadgeIcon({ badge, size = 16 }: { badge: Badge; size?: number }) {
  if (badge.icon_type === 'upload' && badge.icon_value) {
    return (
      <Image
        source={{ uri: getFileUrl(`badges/${badge.icon_value}`) }}
        style={{ width: size, height: size, borderRadius: size / 4 }}
        contentFit="cover"
        transition={150}
        cachePolicy="memory-disk"
      />
    );
  }
  const Icon = (badge.icon_value && BADGE_ICONS[badge.icon_value]) || Award;
  return <Icon size={size} color={badge.icon_color || '#C59560'} />;
}

// Native `Alert.alert` görsel/ikon gösteremiyor (yalnızca metin) — rozete
// dokununca ikonun da görünmesi istendiği için (kullanıcı isteği) kendi
// modalimiz var. Ayrıca rozet chip'i çoğu yerde (Leaderboard satırı,
// PostCardClassic ownerRow) profile gitmek için TÜM satırı saran bir dış
// `Pressable`in İÇİNDE duruyor — `stopPropagation` olmadan dokunuş dış
// Pressable'a sızıp "açıklama yerine profile gidiyor" gibi görünen asıl
// şikayete yol açıyordu.
function BadgeDescriptionModal({ badge, visible, onClose }: { badge: Badge; visible: boolean; onClose: () => void }) {
  const { icon_color, bg_color, text_color } = badge;
  const backgroundColor = bg_color || (icon_color ? hexToBg(icon_color) : '#2F575519');
  const textColor = text_color || icon_color || bg_color || '#2F5755';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
          <Pressable onPress={onClose} hitSlop={10} style={styles.modalClose}>
            <X size={18} color="#8a8f98" />
          </Pressable>
          <View style={[styles.modalIconWrap, { backgroundColor }]}>
            <BadgeIcon badge={badge} size={34} />
          </View>
          <Text style={[styles.modalTitle, { color: textColor }]}>{badge.name}</Text>
          <Text style={styles.modalDescription}>{badge.description?.trim() || 'Bu rozet için açıklama eklenmemiş.'}</Text>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export default function BadgeChip({ badge, compact = false }: { badge: Badge; compact?: boolean }) {
  const { icon_color, bg_color, text_color } = badge;
  const backgroundColor = bg_color || (icon_color ? hexToBg(icon_color) : '#2F575519');
  const borderColor = icon_color ? `${icon_color}66` : bg_color || '#2F575533';
  const textColor = text_color || icon_color || bg_color || '#2F5755';
  const [showModal, setShowModal] = useState(false);

  const showDescription = (e: { stopPropagation?: () => void }) => {
    e.stopPropagation?.();
    setShowModal(true);
  };

  if (compact) {
    return (
      <>
        <Pressable onPress={showDescription} hitSlop={6} style={[styles.compactChip, { backgroundColor, borderColor }]}>
          <BadgeIcon badge={badge} size={13} />
        </Pressable>
        <BadgeDescriptionModal badge={badge} visible={showModal} onClose={() => setShowModal(false)} />
      </>
    );
  }

  return (
    <>
      <Pressable onPress={showDescription} style={[styles.chip, { backgroundColor, borderColor }]}>
        <BadgeIcon badge={badge} size={15} />
        <Text style={[styles.chipText, { color: textColor }]} numberOfLines={1}>
          {badge.name}
        </Text>
      </Pressable>
      <BadgeDescriptionModal badge={badge} visible={showModal} onClose={() => setShowModal(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  compactChip: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 100,
    borderWidth: 1,
    maxWidth: 160,
  },
  chipText: { fontSize: 11.5, fontWeight: '600' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 20,
    alignItems: 'center',
  },
  modalClose: { position: 'absolute', top: 12, right: 12, padding: 4 },
  modalIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  modalTitle: { fontSize: 17, fontWeight: '700', marginBottom: 6, textAlign: 'center' },
  modalDescription: { fontSize: 13.5, color: '#4b5563', textAlign: 'center', lineHeight: 19 },
});
