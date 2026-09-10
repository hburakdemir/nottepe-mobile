import React from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Award } from 'lucide-react-native';
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
        source={{ uri: getFileUrl(badge.icon_value) }}
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

export default function BadgeChip({ badge, compact = false }: { badge: Badge; compact?: boolean }) {
  const { icon_color, bg_color, text_color } = badge;
  const backgroundColor = bg_color || (icon_color ? hexToBg(icon_color) : '#2F575519');
  const borderColor = icon_color ? `${icon_color}66` : bg_color || '#2F575533';
  const textColor = text_color || icon_color || bg_color || '#2F5755';

  const showDescription = () => {
    Alert.alert(badge.name, badge.description?.trim() || 'Bu rozet için açıklama eklenmemiş.');
  };

  if (compact) {
    return (
      <Pressable onPress={showDescription} style={[styles.compactChip, { backgroundColor, borderColor }]}>
        <BadgeIcon badge={badge} size={13} />
      </Pressable>
    );
  }

  return (
    <Pressable onPress={showDescription} style={[styles.chip, { backgroundColor, borderColor }]}>
      <BadgeIcon badge={badge} size={15} />
      <Text style={[styles.chipText, { color: textColor }]} numberOfLines={1}>
        {badge.name}
      </Text>
    </Pressable>
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
});
