import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Award } from 'lucide-react-native';
import { BADGE_ICONS } from '../constants/badgeIcons';

export interface Badge {
  id: number;
  name: string;
  description?: string;
  icon_type?: 'lucide' | 'upload';
  icon_value?: string;
  icon_color?: string | null;
  bg_color?: string | null;
  is_visible?: boolean;
}

function hexToBg(color: string) {
  return `${color}26`;
}

function BadgeIcon({ badge, size = 16 }: { badge: Badge; size?: number }) {
  const Icon = (badge.icon_value && BADGE_ICONS[badge.icon_value]) || Award;
  return <Icon size={size} color={badge.icon_color || '#C59560'} />;
}

export default function BadgeChip({ badge, compact = false }: { badge: Badge; compact?: boolean }) {
  const { icon_color, bg_color } = badge;
  const backgroundColor = bg_color || (icon_color ? hexToBg(icon_color) : '#2F575519');
  const borderColor = icon_color ? `${icon_color}66` : bg_color || '#2F575533';
  const textColor = icon_color || bg_color || '#2F5755';

  if (compact) {
    return (
      <View style={[styles.compactChip, { backgroundColor, borderColor }]}>
        <BadgeIcon badge={badge} size={13} />
      </View>
    );
  }

  return (
    <View style={[styles.chip, { backgroundColor, borderColor }]}>
      <BadgeIcon badge={badge} size={15} />
      <Text style={[styles.chipText, { color: textColor }]} numberOfLines={1}>
        {badge.name}
      </Text>
    </View>
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
