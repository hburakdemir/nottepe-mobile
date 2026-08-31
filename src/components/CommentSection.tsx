import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  MessageSquare,
  Pencil,
  RotateCcw,
  Send,
  Star,
  Trash2,
  User,
  X,
} from 'lucide-react-native';
import { adminCommentAPI, commentAPI } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useGoToUserProfile } from '../hooks/useGoToUserProfile';
import BadgeChip from './BadgeChip';
import type { Comment } from '../types/comment';

const LIMIT = 5;
const EDIT_WINDOW_MS = 60 * 60 * 1000;

function formatDateTime(dateString: string): string {
  return new Date(dateString).toLocaleString('tr-TR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function StarPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <View style={styles.starRow}>
      {[1, 2, 3, 4, 5].map((s) => (
        <Pressable key={s} onPress={() => onChange(value === s ? 0 : s)} hitSlop={6}>
          <Star size={22} color="#eab308" fill={value >= s ? '#eab308' : 'none'} />
        </Pressable>
      ))}
    </View>
  );
}

function StarDisplay({ value }: { value: number }) {
  return (
    <View style={styles.starRow}>
      {[1, 2, 3, 4, 5].map((s) => (
        <Star key={s} size={14} color={value >= s ? '#eab308' : '#d1d5db'} fill={value >= s ? '#eab308' : 'none'} />
      ))}
    </View>
  );
}

interface RatingStats {
  avg_rating: number | string;
  rating_count: number;
}

interface CommentCardProps {
  comment: Comment;
  postOwnerId: number;
  isAdmin: boolean;
  onDelete: (id: number, reason: string) => void;
  onRestore: (id: number) => void;
  onEdit: (id: number, updated: Comment) => void;
  onEditRatingChange: (stats: RatingStats) => void;
}

function CommentCard({ comment, postOwnerId, isAdmin, onDelete, onRestore, onEdit, onEditRatingChange }: CommentCardProps) {
  const { user } = useAuth();
  const goToUserProfile = useGoToUserProfile();

  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteReason, setDeleteReason] = useState('');
  const [restoring, setRestoring] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(comment.content || '');
  const [editRating, setEditRating] = useState(comment.rating || 0);
  const [editError, setEditError] = useState('');
  const [editLoading, setEditLoading] = useState(false);

  const commentAgeMs = Date.now() - new Date(comment.created_at).getTime();
  const withinEditWindow = commentAgeMs < EDIT_WINDOW_MS;
  const isDeleted = !!comment.deleted_at;
  const isCommentOwner = !!user && String(user.id) === String(comment.user_id);
  const isPostOwner = !!user && String(user.id) === String(postOwnerId);
  const isAdminUser = user?.role === 'admin' || user?.role === 'moderator';
  const canDelete = !isDeleted && (isAdminUser || isCommentOwner || isPostOwner);
  const canRestore = isDeleted && isAdminUser && isAdmin;
  const canEdit = !isDeleted && isCommentOwner;

  const openEdit = () => {
    setEditContent(comment.content || '');
    setEditRating(comment.rating || 0);
    setEditError('');
    setIsEditing(true);
  };

  const handleEditSubmit = async () => {
    if (!editContent.trim() && !editRating) {
      setEditError('Yorum içeriği veya puan giriniz.');
      return;
    }
    setEditLoading(true);
    setEditError('');
    try {
      const res = await commentAPI.update(comment.id, { content: editContent.trim() || undefined, rating: editRating || undefined });
      onEdit(comment.id, res.data.comment);
      if (res.data.ratingStats) onEditRatingChange(res.data.ratingStats);
      setIsEditing(false);
    } catch (err: any) {
      setEditError(err.response?.data?.message || 'Güncelleme başarısız.');
    } finally {
      setEditLoading(false);
    }
  };

  const handleRestore = async () => {
    setRestoring(true);
    try {
      await onRestore(comment.id);
    } finally {
      setRestoring(false);
    }
  };

  return (
    <View style={[styles.commentCard, isDeleted && styles.commentCardDeleted]}>
      <View style={styles.commentHeader}>
        <Pressable style={styles.commentUser} onPress={() => goToUserProfile(comment.username)}>
          <View style={styles.avatarFallback}>
            <User size={14} color="#6b7280" />
          </View>
          <View style={{ flex: 1 }}>
            <View style={styles.usernameRow}>
              <Text style={styles.username}>{comment.username || 'Anonim'}</Text>
              {!!comment.badges?.length && (
                <View style={styles.badgeRow}>
                  {comment.badges.map((b) => (
                    <BadgeChip key={b.id} badge={b} compact />
                  ))}
                </View>
              )}
              {(comment.role === 'admin' || comment.role === 'moderator') && (
                <View style={styles.roleBadge}>
                  <Text style={styles.roleBadgeText}>{comment.role}</Text>
                </View>
              )}
            </View>
            <Text style={styles.date}>
              {formatDateTime(comment.created_at)}
              {!!comment.updated_at && <Text style={styles.editedText}> · düzenlendi</Text>}
            </Text>
          </View>
        </Pressable>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {!!comment.rating && !isEditing && <StarDisplay value={comment.rating} />}
          {canEdit && !isEditing && (
            <Pressable onPress={openEdit} hitSlop={6}>
              <Pencil size={15} color="#1d4ed8" />
            </Pressable>
          )}
          {isEditing && (
            <Pressable onPress={() => setIsEditing(false)} hitSlop={6}>
              <X size={15} color="#6b7280" />
            </Pressable>
          )}
          {canDelete && !isEditing && (
            <Pressable onPress={() => setShowDeleteDialog(true)} hitSlop={6}>
              <Trash2 size={16} color="#dc2626" />
            </Pressable>
          )}
          {canRestore && (
            <Pressable onPress={handleRestore} disabled={restoring} hitSlop={6}>
              <RotateCcw size={16} color="#16a34a" />
            </Pressable>
          )}
        </View>
      </View>

      {!isEditing && !!comment.content && <Text style={styles.commentContent}>{comment.content}</Text>}

      {isEditing && (
        <View style={{ marginTop: 8, gap: 8 }}>
          {!withinEditWindow ? (
            <Text style={styles.editWindowWarning}>Yorumu attıktan sonra 1 saat içinde güncelleme yapabilirsiniz.</Text>
          ) : (
            <>
              <Text style={styles.editLabel}>Puan</Text>
              <StarPicker value={editRating} onChange={setEditRating} />
              <TextInput
                style={styles.editInput}
                value={editContent}
                onChangeText={(t) => setEditContent(t.slice(0, 300))}
                multiline
                placeholder="Yorumunuz..."
                placeholderTextColor="#9ca3af"
              />
              {!!editError && <Text style={styles.errorText}>{editError}</Text>}
              <Pressable style={styles.editSubmitBtn} onPress={handleEditSubmit} disabled={editLoading}>
                <Send size={13} color="#fff" />
                <Text style={styles.editSubmitText}>{editLoading ? 'Güncelleniyor…' : 'Güncelle'}</Text>
              </Pressable>
            </>
          )}
        </View>
      )}

      {isDeleted && isAdmin && (
        <View style={styles.deletedInfo}>
          <Text style={styles.deletedInfoText}>
            🗑 Silen: {comment.deleted_by_username || `#${comment.deleted_by}`} · {formatDateTime(comment.deleted_at!)}
          </Text>
          {!!comment.delete_reason && <Text style={styles.deletedInfoText}>Sebep: {comment.delete_reason}</Text>}
        </View>
      )}

      {showDeleteDialog && (
        <View style={styles.deleteDialog}>
          <Text style={styles.deleteDialogText}>Bu yorumu silmek istediğinizden emin misiniz?</Text>
          {isAdminUser && (
            <TextInput
              style={styles.deleteReasonInput}
              value={deleteReason}
              onChangeText={setDeleteReason}
              placeholder="Silme sebebi (opsiyonel)"
              placeholderTextColor="#9ca3af"
            />
          )}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Pressable
              style={styles.deleteConfirmBtn}
              onPress={() => {
                onDelete(comment.id, deleteReason);
                setShowDeleteDialog(false);
              }}
            >
              <Text style={styles.deleteConfirmText}>Evet, Sil</Text>
            </Pressable>
            <Pressable style={styles.deleteCancelBtn} onPress={() => setShowDeleteDialog(false)}>
              <Text style={styles.deleteCancelText}>İptal</Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

interface Props {
  postId: string | number;
  postOwnerId: number;
  isAdmin?: boolean;
  defaultCollapsed?: boolean;
  onRatingChange: (stats: RatingStats) => void;
}

export default function CommentSection({ postId, postOwnerId, isAdmin = false, defaultCollapsed = true, onRatingChange }: Props) {
  const { isAuthenticated } = useAuth();

  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const [hasFetched, setHasFetched] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);

  const [content, setContent] = useState('');
  const [rating, setRating] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const fetchPage = useCallback(
    async (p: number) => {
      try {
        setLoading(true);
        if (isAdmin) {
          const res = await adminCommentAPI.getByPost(postId);
          setComments(res.data.comments);
          setTotal(res.data.comments.length);
          setTotalPages(1);
        } else {
          const res = await commentAPI.getByPost(postId, p);
          const { comments: rows, total: t, limit } = res.data;
          setComments(rows);
          setTotal(t);
          setTotalPages(Math.max(1, Math.ceil(t / limit)));
          setPage(p);
        }
      } catch (err) {
        console.error('Yorumlar alınamadı:', err);
      } finally {
        setLoading(false);
      }
    },
    [postId, isAdmin]
  );

  useEffect(() => {
    if (!collapsed && !hasFetched) {
      setHasFetched(true);
      fetchPage(1);
    }
  }, [collapsed, hasFetched, fetchPage]);

  const handleSubmit = async () => {
    if (!content.trim() && !rating) {
      setFormError('Yorum veya puan giriniz.');
      return;
    }
    setFormError('');
    setSubmitting(true);
    try {
      const res = await commentAPI.create({ post_id: postId, content: content.trim() || undefined, rating: rating || undefined });
      setContent('');
      setRating(0);
      setTotal((t) => t + 1);
      await fetchPage(1);
      if (res.data.ratingStats) onRatingChange(res.data.ratingStats);
    } catch (err: any) {
      setFormError(err.response?.data?.message || 'Yorum gönderilemedi.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (commentId: number, deleteReason: string) => {
    try {
      const res = await commentAPI.delete(commentId, deleteReason);
      if (isAdmin) {
        setComments((prev) =>
          prev.map((c) => (c.id === commentId ? { ...c, deleted_at: new Date().toISOString(), delete_reason: deleteReason || null } : c))
        );
      } else {
        const newTotal = Math.max(total - 1, 0);
        setTotal(newTotal);
        const newTotalPages = Math.max(1, Math.ceil(newTotal / LIMIT));
        await fetchPage(page > newTotalPages ? newTotalPages : page);
      }
      if (res.data.ratingStats) onRatingChange(res.data.ratingStats);
    } catch {
      Alert.alert('Hata', 'Yorum silinemedi.');
    }
  };

  const handleRestore = async (commentId: number) => {
    try {
      const res = await adminCommentAPI.restore(commentId);
      setComments((prev) => prev.map((c) => (c.id === commentId ? { ...c, deleted_at: null, delete_reason: null } : c)));
      if (res.data.ratingStats) onRatingChange(res.data.ratingStats);
    } catch {
      Alert.alert('Hata', 'Geri yüklenemedi.');
    }
  };

  const handleEdit = (commentId: number, updated: Comment) => {
    setComments((prev) => prev.map((c) => (c.id === commentId ? { ...c, ...updated } : c)));
  };

  return (
    <View style={styles.container}>
      <Pressable style={styles.toggleHeader} onPress={() => setCollapsed((c) => !c)}>
        <MessageSquare size={16} color="#111827" />
        <Text style={styles.toggleHeaderText}>Yorumlar</Text>
        <View style={styles.countPill}>
          <Text style={styles.countPillText}>{total}</Text>
        </View>
        {collapsed ? <ChevronDown size={16} color="#111827" /> : <ChevronUp size={16} color="#111827" />}
      </Pressable>

      {!collapsed && (
        <>
          {loading ? (
            <ActivityIndicator style={{ marginVertical: 16 }} color="#1d4ed8" />
          ) : comments.length === 0 ? (
            <Text style={styles.empty}>{isAdmin ? 'Henüz yorum yok.' : 'İlk yorumu sen bırak!'}</Text>
          ) : (
            <View style={{ gap: 10, marginTop: 10 }}>
              {comments.map((c) => (
                <CommentCard
                  key={c.id}
                  comment={c}
                  postOwnerId={postOwnerId}
                  isAdmin={isAdmin}
                  onDelete={handleDelete}
                  onRestore={handleRestore}
                  onEdit={handleEdit}
                  onEditRatingChange={onRatingChange}
                />
              ))}
              {totalPages > 1 && (
                <View style={styles.pagerRow}>
                  <Pressable
                    style={[styles.pagerBtn, page <= 1 && styles.pagerBtnDisabled]}
                    disabled={page <= 1}
                    onPress={() => fetchPage(page - 1)}
                  >
                    <ChevronLeft size={15} color={page <= 1 ? '#d1d5db' : '#2F5755'} />
                  </Pressable>
                  <Text style={styles.pagerText}>
                    {page} / {totalPages}
                  </Text>
                  <Pressable
                    style={[styles.pagerBtn, page >= totalPages && styles.pagerBtnDisabled]}
                    disabled={page >= totalPages}
                    onPress={() => fetchPage(page + 1)}
                  >
                    <ChevronRight size={15} color={page >= totalPages ? '#d1d5db' : '#2F5755'} />
                  </Pressable>
                </View>
              )}
            </View>
          )}

          {isAuthenticated && (
            <View style={styles.form}>
              <Text style={styles.formLabel}>Puanın</Text>
              <StarPicker value={rating} onChange={setRating} />
              <TextInput
                style={styles.input}
                value={content}
                onChangeText={setContent}
                placeholder="Yorumunuz..."
                placeholderTextColor="#9ca3af"
                multiline
                maxLength={350}
              />
              {!!formError && <Text style={styles.error}>{formError}</Text>}
              <Pressable
                style={[styles.submitBtn, submitting && { opacity: 0.6 }]}
                onPress={handleSubmit}
                disabled={submitting}
              >
                <Send size={14} color="#fff" />
                <Text style={styles.submitText}>{submitting ? 'Gönderiliyor…' : 'Yorumu Gönder'}</Text>
              </Pressable>
            </View>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginTop: 16 },
  toggleHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  toggleHeaderText: { fontSize: 15, fontWeight: '700', color: '#111827' },
  countPill: { backgroundColor: '#2F575519', borderRadius: 100, paddingHorizontal: 8, paddingVertical: 2 },
  countPillText: { fontSize: 11.5, fontWeight: '700', color: '#2F5755' },
  empty: { color: '#9ca3af', fontSize: 13, textAlign: 'center', paddingVertical: 16 },
  commentCard: { borderWidth: 1, borderColor: '#f3f4f6', borderRadius: 10, padding: 10 },
  commentCardDeleted: { borderColor: '#fecaca' },
  commentHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  commentUser: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  usernameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  avatarFallback: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeRow: { flexDirection: 'row', gap: 3 },
  roleBadge: { backgroundColor: '#ca8a04', borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 },
  roleBadgeText: { fontSize: 9, fontWeight: '700', color: '#fff' },
  username: { fontSize: 13, fontWeight: '600', color: '#111827' },
  date: { fontSize: 10.5, color: '#9ca3af' },
  editedText: { fontStyle: 'italic' },
  commentContent: { fontSize: 13.5, color: '#374151', marginTop: 8, lineHeight: 19 },
  starRow: { flexDirection: 'row', gap: 3 },
  editLabel: { fontSize: 10.5, fontWeight: '700', color: '#9ca3af', textTransform: 'uppercase' },
  editInput: {
    borderWidth: 1,
    borderColor: '#111827',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13.5,
    color: '#1f2937',
    minHeight: 60,
    textAlignVertical: 'top',
  },
  editWindowWarning: { fontSize: 12, color: '#1e3a8a', backgroundColor: '#fde047', borderRadius: 8, padding: 8 },
  editSubmitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#12161A',
    borderRadius: 10,
    paddingVertical: 9,
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
  },
  editSubmitText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  errorText: { color: '#dc2626', fontSize: 11.5 },
  deletedInfo: { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#fecaca' },
  deletedInfoText: { fontSize: 11, color: '#ef4444' },
  deleteDialog: { marginTop: 10, backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fecaca', borderRadius: 10, padding: 10, gap: 8 },
  deleteDialogText: { fontSize: 12.5, fontWeight: '600', color: '#b91c1c' },
  deleteReasonInput: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    fontSize: 12.5,
    color: '#374151',
  },
  deleteConfirmBtn: { backgroundColor: '#ef4444', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  deleteConfirmText: { color: '#fff', fontSize: 11.5, fontWeight: '700' },
  deleteCancelBtn: { backgroundColor: '#e5e7eb', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  deleteCancelText: { color: '#374151', fontSize: 11.5, fontWeight: '700' },
  pagerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 14, paddingVertical: 8 },
  pagerBtn: { width: 30, height: 30, borderRadius: 15, borderWidth: 1, borderColor: '#e5e7eb', alignItems: 'center', justifyContent: 'center' },
  pagerBtnDisabled: { opacity: 0.4 },
  pagerText: { fontSize: 12, color: '#6b7280', fontWeight: '600' },
  form: { marginTop: 16, backgroundColor: '#2F5755', borderRadius: 12, padding: 14, gap: 10 },
  formLabel: { color: '#E0D9D9', fontSize: 12, fontWeight: '700' },
  input: {
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#111827',
    minHeight: 70,
    textAlignVertical: 'top',
  },
  error: { color: '#fca5a5', fontSize: 12 },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#12161A',
    borderRadius: 10,
    paddingVertical: 10,
  },
  submitText: { color: '#fff', fontSize: 13, fontWeight: '700' },
});
