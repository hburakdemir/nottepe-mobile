import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ExternalLink, HeartHandshake, RotateCcw, ThumbsUp, Trash2, Upload, User, Users, XCircle } from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import type { RootStackParamList, NoteRequestSummary } from '../../navigation/types';

export interface NoteRequest {
  id: number;
  user_id: number;
  faculty: string;
  department: string;
  course_name: string;
  description?: string | null;
  status: 'open' | 'fulfilled' | 'closed';
  requester_full_name?: string;
  requester_username?: string;
  created_at: string;
  supporter_count?: number;
  supported_by_me?: boolean;
  fulfilled_post_id?: number;
  fulfilled_post_title?: string;
  fulfiller_username?: string;
}

const STATUS_META: Record<string, { label: string; bg: string; text: string }> = {
  open: { label: 'Açık', bg: '#2F575519', text: '#2F5755' },
  fulfilled: { label: 'Karşılandı', bg: '#dcfce7', text: '#15803d' },
  closed: { label: 'Kapalı', bg: '#e5e7eb', text: '#4b5563' },
};

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
}

interface Props {
  request: NoteRequest;
  onFulfill: (request: NoteRequest) => void;
  onSupport: (request: NoteRequest) => void;
  onClose: (request: NoteRequest) => void;
  onReopen: (request: NoteRequest) => void;
  onDelete: (request: NoteRequest) => void;
}

export default function RequestCard({ request, onFulfill, onSupport, onClose, onReopen, onDelete }: Props) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const mutedIconColor = isDark ? '#DFD0B8' : '#6b7280';
  const metaIconColor = isDark ? '#9ca3af' : '#6b7280';
  const brandIconColor = isDark ? '#5A9690' : '#2F5755';
  const dangerIconColor = isDark ? '#f87171' : '#ef4444';
  const isOwner = user?.id === request.user_id;
  const isStaff = user?.role === 'admin' || user?.role === 'moderator';
  const status = STATUS_META[request.status] || STATUS_META.open;
  const supporterCount = request.supporter_count || 0;

  const handleUpload = () => {
    const noteRequest: NoteRequestSummary = {
      id: request.id,
      faculty: request.faculty,
      department: request.department,
      course_name: request.course_name,
    };
    navigation.navigate('AddPost', { noteRequest });
  };

  return (
    <View className="bg-primary dark:bg-darkbgbutton" style={styles.card}>
      <View style={styles.chipRow}>
        <View style={[styles.badge, { backgroundColor: status.bg }]}>
          <Text style={[styles.badgeText, { color: status.text }]}>{status.label}</Text>
        </View>
        <View style={[styles.chip, styles.chipBrand]}>
          <Text style={styles.chipText}>{request.faculty}</Text>
        </View>
        <View style={[styles.chip, styles.chipBrandLight]}>
          <Text style={styles.chipText}>{request.department}</Text>
        </View>
        {supporterCount > 0 && (
          <View style={styles.supportBadge}>
            <Users size={12} color="#92400e" />
            <Text style={styles.supportBadgeText}>{supporterCount} kişi istiyor</Text>
          </View>
        )}
      </View>

      <Text className="text-gray-900 dark:text-darktext" style={styles.title}>{request.course_name}</Text>
      {!!request.description && (
        <Text className="text-gray-800 dark:text-darktext" style={styles.description}>{request.description}</Text>
      )}

      <View style={styles.metaRow}>
        <User size={12} color={metaIconColor} />
        <Text className="text-gray-500 dark:text-gray-400" style={styles.metaText}>
          {request.requester_full_name || request.requester_username || 'Bir öğrenci'} · {formatDate(request.created_at)}
        </Text>
      </View>

      {request.status === 'fulfilled' && request.fulfilled_post_id && (
        <Pressable style={styles.fulfilledLink} onPress={() => navigation.navigate('PostDetail', { postId: request.fulfilled_post_id! })}>
          <ExternalLink size={15} color={brandIconColor} />
          <Text className="text-brand dark:text-brand-light" style={styles.fulfilledLinkText} numberOfLines={1}>
            Karşılayan not: {request.fulfilled_post_title || 'Görüntüle'}
            {request.fulfiller_username ? ` (${request.fulfiller_username})` : ''}
          </Text>
        </Pressable>
      )}

      <View style={styles.actionsRow}>
        {!isOwner && request.status === 'open' && (
          <>
            <Pressable style={styles.actionBtnPrimary} onPress={() => onFulfill(request)}>
              <HeartHandshake size={14} color="#fff" />
              <Text style={styles.actionBtnPrimaryText}>Karşıla</Text>
            </Pressable>
            <Pressable className="border-brand dark:border-brand-light" style={styles.actionBtnBrandOutline} onPress={handleUpload}>
              <Upload size={15} color={brandIconColor} />
              <Text className="text-brand dark:text-brand-light" style={styles.actionBtnBrandOutlineText}>Not Yükle</Text>
            </Pressable>
            <Pressable
              className={request.supported_by_me ? undefined : 'border-gray-200 dark:border-gray-600'}
              style={[styles.actionBtnOutline, request.supported_by_me && styles.actionBtnSupported]}
              onPress={() => onSupport(request)}
            >
              <ThumbsUp size={15} color={request.supported_by_me ? '#92400e' : mutedIconColor} />
              <Text
                className={request.supported_by_me ? undefined : 'text-gray-700 dark:text-darktext'}
                style={[styles.actionBtnOutlineText, request.supported_by_me && { color: '#92400e' }]}
              >
                {request.supported_by_me ? 'İstiyorum ✓' : 'Ben de istiyorum'}
              </Text>
            </Pressable>
          </>
        )}

        {isOwner && request.status === 'open' && (
          <Pressable className="border-gray-200 dark:border-gray-600" style={styles.actionBtnOutline} onPress={() => onClose(request)}>
            <XCircle size={15} color={mutedIconColor} />
            <Text className="text-gray-700 dark:text-darktext" style={styles.actionBtnOutlineText}>Kapat</Text>
          </Pressable>
        )}

        {isOwner && request.status === 'fulfilled' && (
          <Pressable className="border-brand dark:border-brand-light" style={styles.actionBtnBrandOutline} onPress={() => onReopen(request)}>
            <RotateCcw size={15} color={brandIconColor} />
            <Text className="text-brand dark:text-brand-light" style={styles.actionBtnBrandOutlineText}>Yeniden Aç</Text>
          </Pressable>
        )}

        {(isOwner || isStaff) && (
          <Pressable style={styles.actionBtnDanger} onPress={() => onDelete(request)}>
            <Trash2 size={15} color={dangerIconColor} />
            <Text className="text-red-500 dark:text-red-400" style={styles.actionBtnDangerText}>Sil</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  badge: { borderRadius: 100, paddingHorizontal: 10, paddingVertical: 3 },
  badgeText: { fontSize: 10.5, fontWeight: '700' },
  chip: { borderRadius: 100, paddingHorizontal: 10, paddingVertical: 3 },
  chipBrand: { backgroundColor: '#2F5755' },
  chipBrandLight: { backgroundColor: '#5A9690' },
  chipText: { color: '#fff', fontSize: 10.5, fontWeight: '600' },
  supportBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#fef3c7', borderRadius: 100, paddingHorizontal: 9, paddingVertical: 3 },
  supportBadgeText: { fontSize: 10.5, fontWeight: '600', color: '#92400e' },
  title: { fontSize: 17, fontWeight: '600', marginBottom: 4 },
  description: { fontSize: 14, marginBottom: 12, lineHeight: 19 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 14 },
  metaText: { fontSize: 12 },
  fulfilledLink: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 14 },
  fulfilledLinkText: { fontSize: 14, fontWeight: '600', flexShrink: 1 },
  actionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  actionBtnPrimary: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#2F5755', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 9 },
  actionBtnPrimaryText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  actionBtnOutline: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 9 },
  actionBtnOutlineText: { fontSize: 13, fontWeight: '600' },
  actionBtnBrandOutline: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 9 },
  actionBtnBrandOutlineText: { fontSize: 13, fontWeight: '600' },
  actionBtnSupported: { backgroundColor: '#fef3c7', borderColor: '#fcd34d' },
  actionBtnDanger: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: '#fca5a5', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 9 },
  actionBtnDangerText: { fontSize: 13, fontWeight: '600' },
});
