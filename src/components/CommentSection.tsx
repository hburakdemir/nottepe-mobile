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
import { useTheme } from '../context/ThemeContext';
import { useGoToUserProfile } from '../hooks/useGoToUserProfile';
import { useFeedTokens } from '../theme/feedTokens';
import { buildCommentAuthorAvatar } from '../lib/postAuthorAvatar';
import AvatarDisplay from './avatar/AvatarDisplay';
import BadgeChip from './BadgeChip';
import { Skeleton, SkeletonGroup } from './Skeleton';
import { useDelayedLoading } from '../hooks/useDelayedLoading';
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
  const { amber } = useFeedTokens();
  return (
    <View style={styles.starRow}>
      {[1, 2, 3, 4, 5].map((s) => (
        <Pressable key={s} onPress={() => onChange(value === s ? 0 : s)} hitSlop={6}>
          <Star size={22} color={amber} fill={value >= s ? amber : 'none'} />
        </Pressable>
      ))}
    </View>
  );
}

function StarDisplay({ value }: { value: number }) {
  const t = useFeedTokens();
  return (
    <View style={styles.starRow}>
      {[1, 2, 3, 4, 5].map((s) => (
        <Star key={s} size={14} color={value >= s ? t.amber : t.line} fill={value >= s ? t.amber : 'none'} />
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

// ⚠️ `React.memo` ZORUNLU.
//
// Yorum satırları `CommentSection`'ın gövdesinde `.map()` ile çiziliyor ve
// yorum YAZMA kutusunun state'i (`content`, `rating`) de aynı bileşende
// duruyor. Memo olmadan HER TUŞ VURUŞU bütün yorum satırlarını yeniden
// çiziyordu — her satırda bir avatar var, o avatar da piksel-sanat bir SVG
// (~40 düğüm, bkz. AvatarSVG.tsx). 20 yorumluk bir gönderide bu, her harfte
// ~800 native SVG düğümünün yeniden değerlendirilmesi demekti. Testçilerin
// "gönderilere girince yorumlar çok geç yükleniyor" dediği maliyetin bir
// kısmı buydu.
//
// Memo'nun tutması için `onDelete`/`onRestore`/`onEdit` çağrı yerinde
// `useCallback` olmak zorunda — aşağıda öyleler.
const CommentCard = React.memo(function CommentCard({
  comment,
  postOwnerId,
  isAdmin,
  onDelete,
  onRestore,
  onEdit,
  onEditRatingChange,
}: CommentCardProps) {
  const { user } = useAuth();
  const goToUserProfile = useGoToUserProfile();
  // Renkler artık akış/gönderi tasarımıyla AYNI kaynaktan (theme/feedTokens.ts).
  // Eskiden burada sabit hex'ler vardı — koyu tema için seçilmiş koyu yeşil bir
  // form bloğu, beyaz girdi, neredeyse siyah buton — ve açık temada sayfanın
  // geri kalanına hiç benzemiyordu.
  const t = useFeedTokens();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const avatarIconColor = t.ink3;
  const cancelIconColor = t.ink2;
  const editIconColor = t.accent;
  const deleteIconColor = t.danger;
  const restoreIconColor = isDark ? '#4ade80' : '#16a34a';

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
  // `buildCommentAuthorAvatar` her çağrıda YENİ bir nesne üretiyor; memoize
  // edilmezse `AvatarDisplay`'in kendi memo'su hiçbir zaman tutmaz.
  const authorAvatar = React.useMemo(() => buildCommentAuthorAvatar(comment), [comment]);

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
    <View style={[styles.commentCard, { backgroundColor: t.inset, borderColor: isDeleted ? t.danger : t.line }]}>
      <View style={styles.commentHeader}>
        <Pressable style={styles.commentUser} onPress={() => goToUserProfile(comment.username)}>
          <View style={[styles.avatarFallback, { backgroundColor: t.card, overflow: 'hidden' }]}>
            {authorAvatar ? <AvatarDisplay avatar={authorAvatar} size={26} showBg={false} /> : <User size={14} color={avatarIconColor} />}
          </View>
          <View style={{ flex: 1 }}>
            <View style={styles.usernameRow}>
              <Text style={[styles.username, { color: t.ink }]}>{comment.username || 'Anonim'}</Text>
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
            <Text style={[styles.date, { color: t.ink3 }]}>
              {formatDateTime(comment.created_at)}
              {!!comment.updated_at && <Text style={styles.editedText}> · düzenlendi</Text>}
            </Text>
          </View>
        </Pressable>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {!!comment.rating && !isEditing && <StarDisplay value={comment.rating} />}
          {canEdit && !isEditing && (
            <Pressable onPress={openEdit} hitSlop={6}>
              <Pencil size={15} color={editIconColor} />
            </Pressable>
          )}
          {isEditing && (
            <Pressable onPress={() => setIsEditing(false)} hitSlop={6}>
              <X size={15} color={cancelIconColor} />
            </Pressable>
          )}
          {canDelete && !isEditing && (
            <Pressable onPress={() => setShowDeleteDialog(true)} hitSlop={6}>
              <Trash2 size={16} color={deleteIconColor} />
            </Pressable>
          )}
          {canRestore && (
            <Pressable onPress={handleRestore} disabled={restoring} hitSlop={6}>
              <RotateCcw size={16} color={restoreIconColor} />
            </Pressable>
          )}
        </View>
      </View>

      {!isEditing && !!comment.content && <Text style={[styles.commentContent, { color: t.ink2 }]}>{comment.content}</Text>}

      {isEditing && (
        <View style={{ marginTop: 8, gap: 8 }}>
          {!withinEditWindow ? (
            <Text style={[styles.editWindowWarning, { backgroundColor: t.card, borderColor: t.amber, color: t.ink2 }]}>
              Yorumu attıktan sonra 1 saat içinde güncelleme yapabilirsiniz.
            </Text>
          ) : (
            <>
              <Text style={[styles.editLabel, { color: t.ink3 }]}>Puan</Text>
              <StarPicker value={editRating} onChange={setEditRating} />
              <TextInput
                style={[styles.editInput, { backgroundColor: t.card, borderColor: t.line, color: t.ink }]}
                value={editContent}
                onChangeText={(t) => setEditContent(t.slice(0, 300))}
                multiline
                placeholder="Yorumunuz..."
                placeholderTextColor={t.ink3}
              />
              {!!editError && <Text style={[styles.errorText, { color: t.danger }]}>{editError}</Text>}
              <Pressable style={[styles.editSubmitBtn, { backgroundColor: t.accent }]} onPress={handleEditSubmit} disabled={editLoading}>
                <Send size={13} color={t.onAccent} />
                <Text style={[styles.editSubmitText, { color: t.onAccent }]}>{editLoading ? 'Güncelleniyor…' : 'Güncelle'}</Text>
              </Pressable>
            </>
          )}
        </View>
      )}

      {isDeleted && isAdmin && (
        <View style={[styles.deletedInfo, { borderTopColor: t.line }]}>
          <Text style={[styles.deletedInfoText, { color: t.danger }]}>
            🗑 Silen: {comment.deleted_by_username || `#${comment.deleted_by}`} · {formatDateTime(comment.deleted_at!)}
          </Text>
          {!!comment.delete_reason && <Text style={[styles.deletedInfoText, { color: t.danger }]}>Sebep: {comment.delete_reason}</Text>}
        </View>
      )}

      {showDeleteDialog && (
        <View style={[styles.deleteDialog, { backgroundColor: t.card, borderColor: t.danger }]}>
          <Text style={[styles.deleteDialogText, { color: t.danger }]}>Bu yorumu silmek istediğinizden emin misiniz?</Text>
          {isAdminUser && (
            <TextInput
              style={[styles.deleteReasonInput, { backgroundColor: t.inset, borderColor: t.line, color: t.ink }]}
              value={deleteReason}
              onChangeText={setDeleteReason}
              placeholder="Silme sebebi (opsiyonel)"
              placeholderTextColor={t.ink3}
            />
          )}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Pressable
              style={[styles.deleteConfirmBtn, { backgroundColor: t.danger }]}
              onPress={() => {
                onDelete(comment.id, deleteReason);
                setShowDeleteDialog(false);
              }}
            >
              <Text style={styles.deleteConfirmText}>Evet, Sil</Text>
            </Pressable>
            <Pressable style={[styles.deleteCancelBtn, { backgroundColor: t.inset }]} onPress={() => setShowDeleteDialog(false)}>
              <Text style={[styles.deleteCancelText, { color: t.ink2 }]}>İptal</Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
});

interface Props {
  postId: string | number;
  postOwnerId: number;
  isAdmin?: boolean;
  defaultCollapsed?: boolean;
  onRatingChange: (stats: RatingStats) => void;
}

// `defaultCollapsed` varsayılanı artık FALSE: gönderi detayında yorumlar
// kapalı geliyordu ve kapalıyken hiç istek atılmadığı için "yorumlar
// çekilmiyor" gibi görünüyordu. Artık ekran açılır açılmaz (ve postId
// değiştiğinde yeniden) sunucudan çekiliyor.
export default function CommentSection({
  postId,
  postOwnerId,
  isAdmin = false,
  defaultCollapsed = false,
  onRatingChange,
}: Props) {
  const { isAuthenticated, user } = useAuth();
  const t = useFeedTokens();
  const headerIconColor = t.ink;

  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const [comments, setComments] = useState<Comment[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  // bkz. useDelayedLoading.ts — hızlı bağlantıda iskelet hiç görünmüyor.
  const showSkeleton = useDelayedLoading(loading);

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
          // Admin ucu geri yükleme için silinmiş yorumları da döndürüyor —
          // başlıktaki sayaç yalnızca AKTİF yorumları saymalı, yoksa akıştaki
          // gerçek comment_count ile tutarsız görünür (bkz. handleDelete/
          // handleRestore'daki +1/-1 — bu satır her fetchPage'de o düzeltmeyi
          // eziyordu çünkü ham listenin uzunluğunu kullanıyordu).
          setTotal(res.data.comments.filter((c: Comment) => !c.deleted_at).length);
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

  // `fetchPage` yalnızca postId/isAdmin değişince yeniden üretiliyor — yani bu
  // efekt hem ilk açılışta, hem başka bir gönderiye geçildiğinde, hem de
  // kullanıcı bölümü kapatıp tekrar açtığında taze veri çekiyor. (Eskiden bir
  // kerelik `hasFetched` bayrağı vardı: aynı bileşen başka bir gönderi için
  // yeniden kullanıldığında bir daha hiç istek atmıyordu.)
  useEffect(() => {
    if (collapsed) return;
    fetchPage(1);
  }, [collapsed, fetchPage]);

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

  // Üçü de `useCallback`: `CommentCard` memoize ve bu fonksiyonlar onun
  // prop'ları — referansları her render'da değişirse memo hiçbir işe yaramaz.
  const handleDelete = React.useCallback(async (commentId: number, deleteReason: string) => {
    try {
      const res = await commentAPI.delete(commentId, deleteReason);
      if (isAdmin) {
        setComments((prev) =>
          prev.map((c) =>
            c.id === commentId
              ? {
                  ...c,
                  deleted_at: new Date().toISOString(),
                  delete_reason: deleteReason || null,
                  // Sunucu cevabı silen kullanıcıyı dönmüyor (bkz. "Silen: #null"
                  // görünen hata) — bu, o anki (silme işlemini yapan) kullanıcı
                  // olduğu için burada biliniyor, sunucu tazelenmeden ekleniyor.
                  deleted_by: user?.id ?? c.deleted_by,
                  deleted_by_username: user?.username ?? c.deleted_by_username,
                }
              : c
          )
        );
        // Admin görünümünde silinen yorum "geri yükle" için listede kalıyor,
        // ama artık aktif değil — başlıktaki sayaç buna göre düşmeli
        // (aksi hâlde "Yorumlar (N)" silinen yorumu da saymaya devam eder ve
        // akıştaki gerçek comment_count ile tutarsız görünür).
        setTotal((t) => Math.max(t - 1, 0));
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
  }, [isAdmin, user?.id, user?.username, total, page, fetchPage, onRatingChange]);

  const handleRestore = React.useCallback(async (commentId: number) => {
    try {
      const res = await adminCommentAPI.restore(commentId);
      setComments((prev) => prev.map((c) => (c.id === commentId ? { ...c, deleted_at: null, delete_reason: null } : c)));
      setTotal((t) => t + 1);
      if (res.data.ratingStats) onRatingChange(res.data.ratingStats);
    } catch {
      Alert.alert('Hata', 'Geri yüklenemedi.');
    }
  }, [onRatingChange]);

  // Bağımlılıksız: yalnızca setState kullanıyor, referansı hiç değişmiyor.
  const handleEdit = React.useCallback((commentId: number, updated: Comment) => {
    setComments((prev) => prev.map((c) => (c.id === commentId ? { ...c, ...updated } : c)));
  }, []);

  return (
    <View style={styles.container}>
      <Pressable style={styles.toggleHeader} onPress={() => setCollapsed((c) => !c)}>
        <MessageSquare size={16} color={headerIconColor} />
        <Text style={[styles.toggleHeaderText, { color: t.ink }]}>Yorumlar</Text>
        <View style={[styles.countPill, { backgroundColor: t.inset }]}>
          <Text style={[styles.countPillText, { color: t.accent }]}>{total}</Text>
        </View>
        {collapsed ? <ChevronDown size={16} color={headerIconColor} /> : <ChevronUp size={16} color={headerIconColor} />}
      </Pressable>

      {!collapsed && (
        <>
          {showSkeleton ? (
            // Yorumlar gönderi gövdesinden SONRA, ayrı bir istekle geliyor;
            // burada çark döndürmek sayfanın altını boş bir bekleme alanına
            // çeviriyordu. İskelet yorum kartının kendi ölçülerini taşıyor
            // (26px avatar, 13px ad, 13.5px gövde) — veri gelince yerleşim
            // oynamıyor. Hızlı bağlantıda (<200ms) hiç görünmüyor.
            <SkeletonGroup>
              <View style={{ gap: 10, marginTop: 10 }}>
                {([
                  { name: 84, badge: 46, stars: true, body: ['100%', '72%'] },
                  { name: 66, badge: 0, stars: true, body: ['96%', '58%'] },
                  { name: 92, badge: 38, stars: false, body: ['100%', '46%'] },
                ] as const).map((row, i) => (
                  <View key={i} style={[styles.commentCard, { backgroundColor: t.inset, borderColor: t.line }]}>
                    <View style={styles.commentHeader}>
                      <View style={styles.commentUser}>
                        <Skeleton width={26} height={26} radius={13} style={{ backgroundColor: t.card }} />
                        <View style={{ flex: 1, gap: 5 }}>
                          <View style={styles.usernameRow}>
                            <Skeleton width={row.name} height={13} />
                            {row.badge > 0 && <Skeleton width={row.badge} height={14} radius={100} />}
                          </View>
                          <Skeleton width={104} height={10} />
                        </View>
                      </View>
                      {/* Puan yıldızları SABİT: boş yıldız zaten gerçek kartta da
                          "puan yok" hâli — gri bloğa çevirmek bilgi kaybı olurdu. */}
                      {row.stars && (
                        <View style={styles.starRow}>
                          {[1, 2, 3, 4, 5].map((s) => (
                            <Star key={s} size={14} color={t.line} />
                          ))}
                        </View>
                      )}
                    </View>
                    <View style={{ gap: 6, marginTop: 8 }}>
                      {row.body.map((w, j) => (
                        <Skeleton key={j} height={13} style={{ width: w }} />
                      ))}
                    </View>
                  </View>
                ))}
              </View>
            </SkeletonGroup>
          ) : loading ? null : comments.length === 0 ? (
            <Text style={[styles.empty, { color: t.ink3 }]}>{isAdmin ? 'Henüz yorum yok.' : 'İlk yorumu sen bırak!'}</Text>
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
                    style={[styles.pagerBtn, { borderColor: t.line }, page <= 1 && styles.pagerBtnDisabled]}
                    disabled={page <= 1}
                    onPress={() => fetchPage(page - 1)}
                  >
                    <ChevronLeft size={15} color={page <= 1 ? t.ink3 : t.accent} />
                  </Pressable>
                  <Text style={[styles.pagerText, { color: t.ink3 }]}>
                    {page} / {totalPages}
                  </Text>
                  <Pressable
                    style={[styles.pagerBtn, { borderColor: t.line }, page >= totalPages && styles.pagerBtnDisabled]}
                    disabled={page >= totalPages}
                    onPress={() => fetchPage(page + 1)}
                  >
                    <ChevronRight size={15} color={page >= totalPages ? t.ink3 : t.accent} />
                  </Pressable>
                </View>
              )}
            </View>
          )}

          {isAuthenticated && (
            <View style={[styles.form, { backgroundColor: t.inset, borderColor: t.line }]}>
              <Text style={[styles.formLabel, { color: t.ink3 }]}>Puanın</Text>
              <StarPicker value={rating} onChange={setRating} />
              <TextInput
                style={[styles.input, { backgroundColor: t.card, borderColor: t.line, color: t.ink }]}
                value={content}
                onChangeText={setContent}
                placeholder="Yorumunuz..."
                placeholderTextColor={t.ink3}
                multiline
                maxLength={350}
              />
              {!!formError && <Text style={[styles.error, { color: t.danger }]}>{formError}</Text>}
              <Pressable
                style={[styles.submitBtn, { backgroundColor: t.accent }, submitting && { opacity: 0.6 }]}
                onPress={handleSubmit}
                disabled={submitting}
              >
                <Send size={14} color={t.onAccent} />
                <Text style={[styles.submitText, { color: t.onAccent }]}>{submitting ? 'Gönderiliyor…' : 'Yorumu Gönder'}</Text>
              </Pressable>
            </View>
          )}
        </>
      )}
    </View>
  );
}

// Renk taşıyan hiçbir değer artık burada DEĞİL — hepsi kullanım yerinde
// theme/feedTokens.ts'ten geliyor. Burada sadece ölçü/tipografi kaldı.
const styles = StyleSheet.create({
  container: { marginTop: 16 },
  toggleHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  toggleHeaderText: { fontSize: 15, fontWeight: '600' },
  countPill: { borderRadius: 100, paddingHorizontal: 8, paddingVertical: 2 },
  countPillText: { fontSize: 11.5, fontWeight: '700' },
  empty: { fontSize: 13, textAlign: 'center', paddingVertical: 16 },
  commentCard: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, padding: 10 },
  commentHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  commentUser: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  usernameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  avatarFallback: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeRow: { flexDirection: 'row', gap: 3 },
  roleBadge: { backgroundColor: '#ca8a04', borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 },
  roleBadgeText: { fontSize: 9, fontWeight: '700', color: '#fff' },
  username: { fontSize: 13, fontWeight: '600' },
  date: { fontSize: 10.5 },
  editedText: { fontStyle: 'italic' },
  commentContent: { fontSize: 13.5, marginTop: 8, lineHeight: 19 },
  starRow: { flexDirection: 'row', gap: 3 },
  editLabel: { fontSize: 10.5, fontWeight: '700', textTransform: 'uppercase' },
  editInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13.5,
    minHeight: 60,
    textAlignVertical: 'top',
  },
  editWindowWarning: { fontSize: 12, borderWidth: 1, borderRadius: 8, padding: 8, lineHeight: 17 },
  editSubmitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 10,
    paddingVertical: 9,
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
  },
  editSubmitText: { fontSize: 12, fontWeight: '700' },
  errorText: { fontSize: 11.5 },
  deletedInfo: { marginTop: 8, paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth },
  deletedInfoText: { fontSize: 11 },
  deleteDialog: { marginTop: 10, borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, padding: 10, gap: 8 },
  deleteDialogText: { fontSize: 12.5, fontWeight: '600' },
  deleteReasonInput: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    fontSize: 12.5,
  },
  deleteConfirmBtn: { borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  deleteConfirmText: { color: '#fff', fontSize: 11.5, fontWeight: '700' },
  deleteCancelBtn: { borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  deleteCancelText: { fontSize: 11.5, fontWeight: '700' },
  pagerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 14, paddingVertical: 8 },
  pagerBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pagerBtnDisabled: { opacity: 0.4 },
  pagerText: { fontSize: 12, fontWeight: '600' },
  // Eskiden bu blok koyu yeşil (#2F5755) bir kutuydu: koyu temada bile yabancı,
  // açık temada sayfanın ortasında kocaman koyu bir leke gibi duruyordu. Artık
  // kartın içine gömülü nötr bir yüzey (t.inset) + saç teli çerçeve.
  form: { marginTop: 16, borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, padding: 14, gap: 10 },
  formLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    minHeight: 70,
    textAlignVertical: 'top',
  },
  error: { fontSize: 12 },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 10,
    paddingVertical: 10,
  },
  submitText: { fontSize: 13, fontWeight: '700' },
});
