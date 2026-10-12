import React, { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { CalendarDays, Clock, Inbox, MapPin, PackageSearch, ShieldCheck, User } from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import BlockedContentGate from '../moderation/BlockedContentGate';
import BlockedMeTag from '../moderation/BlockedMeTag';
import {
  CATEGORY_LABELS,
  CLAIM_STATUS_META,
  TYPE_META,
  formatDateTime,
  formatDay,
  lostItemImageUrl,
  type LostItem,
} from './lostItemMeta';

interface Props {
  item: LostItem;
  onOpen: (item: LostItem) => void;
}

function LostItemCardInner({ item, onOpen }: Props) {
  const { user } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const metaColor = isDark ? '#9ca3af' : '#6b7280';
  const brandColor = isDark ? '#5A9690' : '#2F5755';
  const isOwner = user?.id === item.user_id;
  const type = TYPE_META[item.type] ?? TYPE_META.lost;
  const cover = item.images?.[0];

  return (
    <Pressable className="bg-surface" style={styles.card} onPress={() => onOpen(item)}>
      <View className="bg-inset" style={styles.cover}>
        {cover ? (
          <Image source={{ uri: lostItemImageUrl(cover) }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
        ) : (
          <PackageSearch size={44} color={isDark ? '#4b5563' : '#d1d5db'} />
        )}
        <View style={[styles.badge, styles.badgeTopLeft, { backgroundColor: type.bg }]}>
          <Text style={[styles.badgeText, { color: type.text }]}>{type.label}</Text>
        </View>
        {item.status === 'resolved' && (
          <View style={[styles.badge, styles.badgeTopRight, { backgroundColor: 'rgba(31,41,55,0.85)' }]}>
            <Text style={[styles.badgeText, { color: '#fff' }]}>Çözüldü</Text>
          </View>
        )}
      </View>

      <View style={styles.body}>
        <View style={styles.chipRow}>
          <View style={[styles.chip, { backgroundColor: '#2F5755' }]}>
            <Text style={styles.chipText}>{CATEGORY_LABELS[item.category] ?? item.category}</Text>
          </View>
          <View style={[styles.chip, { backgroundColor: '#5A9690' }]}>
            <Text style={styles.chipText}>{item.campus}</Text>
          </View>
        </View>

        <Text className="text-ink" style={styles.title} numberOfLines={2}>
          {item.title}
        </Text>

        {!!item.location && (
          <View style={styles.metaRow}>
            <MapPin size={12} color={metaColor} />
            <Text className="text-muted" style={styles.metaText} numberOfLines={1}>
              {item.location}
            </Text>
          </View>
        )}
        {!!item.item_date && (
          <View style={styles.metaRow}>
            <CalendarDays size={12} color={metaColor} />
            <Text className="text-muted" style={styles.metaText}>
              {formatDay(item.item_date)}
            </Text>
          </View>
        )}
        {!!item.handed_over_place && !!item.handed_over_at && (
          <View style={[styles.metaRow, { alignItems: 'flex-start', marginTop: 2 }]}>
            <ShieldCheck size={13} color="#b45309" />
            <Text style={[styles.metaText, { color: '#b45309', fontWeight: '600' }]}>
              Teslim edildi: {item.handed_over_place} · {formatDateTime(item.handed_over_at)}
            </Text>
          </View>
        )}

        <View style={styles.footer}>
          <View style={[styles.metaRow, { flex: 1, marginBottom: 0 }]}>
            <User size={12} color={metaColor} />
            <Text className="text-muted2" style={styles.metaText} numberOfLines={1}>
              {item.owner_full_name || item.owner_username || 'Bir öğrenci'}
            </Text>
            <BlockedMeTag userId={item.user_id} />
          </View>
          {isOwner && (item.pending_claim_count ?? 0) > 0 ? (
            <View style={styles.footerRight}>
              <Inbox size={12} color={brandColor} />
              <Text className="text-accent" style={styles.footerRightText}>
                {item.pending_claim_count} başvuru
              </Text>
            </View>
          ) : item.my_claim_status ? (
            <View style={styles.footerRight}>
              <Clock size={12} color={brandColor} />
              <Text className="text-accent" style={styles.footerRightText}>
                Başvurun: {CLAIM_STATUS_META[item.my_claim_status].label}
              </Text>
            </View>
          ) : (
            <Text className="text-muted2" style={styles.metaText}>
              {formatDay(item.created_at)}
            </Text>
          )}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 10,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  cover: { height: 150, alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: 8, borderRadius: 100, paddingHorizontal: 10, paddingVertical: 3 },
  badgeTopLeft: { left: 8 },
  badgeTopRight: { right: 8 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  body: { padding: 14 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  chip: { borderRadius: 100, paddingHorizontal: 10, paddingVertical: 3 },
  chipText: { color: '#fff', fontSize: 10.5, fontWeight: '600' },
  title: { fontSize: 16, fontWeight: '600', marginBottom: 6 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 3 },
  metaText: { fontSize: 12, flexShrink: 1 },
  footer: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  footerRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  footerRightText: { fontSize: 12, fontWeight: '600' },
});

// Engellediğim kişinin ilanı kapalı kutuyla (bkz. BlockedContentGate).
function LostItemCard(props: Props) {
  return (
    <BlockedContentGate authorId={props.item.user_id} kind="kayıp eşya ilanı" style={{ marginBottom: 16 }}>
      <View style={{ marginBottom: 16 }}>
        <LostItemCardInner {...props} />
      </View>
    </BlockedContentGate>
  );
}

export default memo(LostItemCard);
