import { useCallback } from 'react';
import { Alert } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { badgeAPI } from '../../lib/api';
import type { Badge } from '../../components/BadgeChip';
import { MY_BADGES_KEY, useMyBadges } from './useProfileLists';

const NO_BADGES: Badge[] = [];

// Profil düzenleme modalının rozet görünürlüğü anahtarı — modal hem Profil
// sekmesinden hem Ayarlar sayfasından açıldığı için ortak.
export function useBadgeVisibility() {
  const queryClient = useQueryClient();
  const { data: badges = NO_BADGES } = useMyBadges();

  const toggle = useCallback(
    async (badge: Badge) => {
      const nextVisible = !(badge.is_visible !== false);
      // En az bir rozet görünür kalmalı — sayım her çağrıda taze cache'ten.
      if (!nextVisible && badges.filter((b) => b.is_visible !== false).length <= 1) {
        Alert.alert('Uyarı', 'En az bir rozet görünür kalmalı.');
        return;
      }
      try {
        await badgeAPI.setVisibility(badge.id, nextVisible);
        queryClient.setQueryData<Badge[]>(MY_BADGES_KEY, (prev) =>
          prev?.map((b) => (b.id === badge.id ? { ...b, is_visible: nextVisible } : b))
        );
      } catch (err: any) {
        Alert.alert('Hata', err.response?.data?.message || 'Rozet görünürlüğü güncellenemedi.');
      }
    },
    [badges, queryClient]
  );

  return { badges, toggle };
}
