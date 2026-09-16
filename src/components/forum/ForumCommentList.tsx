import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { CornerDownRight, MessageSquare, Send, ThumbsDown, ThumbsUp, Trash2 } from 'lucide-react-native';
import { useGoToUserProfile } from '../../hooks/useGoToUserProfile';
import { useTheme } from '../../context/ThemeContext';
import { useDelayedLoading } from '../../hooks/useDelayedLoading';
import { Skeleton, SkeletonGroup } from '../Skeleton';

export interface ForumComment {
  id: number;
  username: string;
  full_name: string;
  content: string;
  created_at: string;
  parent_comment_id?: number | null;
  upvotes?: number;
  downvotes?: number;
  my_vote?: number | null;
}

function formatDateTime(dateString: string): string {
  return new Date(dateString).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function VoteButtons({
  upvotes = 0,
  downvotes = 0,
  myVote,
  onVote,
}: {
  upvotes?: number;
  downvotes?: number;
  myVote?: number | null;
  onVote: (v: number) => void;
}) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const upColor = isDark ? '#5A9690' : '#2F5755';
  const downColor = isDark ? '#f87171' : '#dc2626';
  const mutedColor = isDark ? '#9ca3af' : '#6b7280';
  return (
    <View style={styles.voteRow}>
      <Pressable className="border-line" style={[styles.voteBtn, myVote === 1 && { borderColor: upColor }]} onPress={() => onVote(1)}>
        <ThumbsUp size={13} color={myVote === 1 ? upColor : mutedColor} />
        <Text style={[styles.voteText, { color: myVote === 1 ? upColor : mutedColor }]}>{upvotes}</Text>
      </Pressable>
      <Pressable className="border-line" style={[styles.voteBtn, myVote === -1 && { borderColor: downColor }]} onPress={() => onVote(-1)}>
        <ThumbsDown size={13} color={myVote === -1 ? downColor : mutedColor} />
        <Text style={[styles.voteText, { color: myVote === -1 ? downColor : mutedColor }]}>{downvotes}</Text>
      </Pressable>
    </View>
  );
}

function ReplyForm({ onSubmit, onCancel }: { onSubmit: (text: string) => Promise<void>; onCancel: () => void }) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!text.trim()) return;
    setSubmitting(true);
    try {
      await onSubmit(text.trim());
      onCancel();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.replyRow}>
      <TextInput
        className="border-line text-ink"
        style={styles.replyInput}
        value={text}
        onChangeText={setText}
        placeholder="Yanıt yaz..."
        placeholderTextColor={isDark ? '#6b7280' : '#9ca3af'}
        maxLength={2000}
        autoFocus
      />
      <Pressable className="bg-accent" style={styles.replySubmitBtn} onPress={handleSubmit} disabled={submitting || !text.trim()}>
        <Send size={13} color="#fff" />
      </Pressable>
      <Pressable onPress={onCancel}>
        <Text className="text-muted" style={styles.replyCancelText}>
          Vazgeç
        </Text>
      </Pressable>
    </View>
  );
}

function CommentRow({
  comment,
  canModerate,
  canReply,
  isReply = false,
  onDeleteComment,
  onVoteComment,
  onReply,
}: {
  comment: ForumComment;
  canModerate: boolean;
  canReply?: boolean;
  isReply?: boolean;
  onDeleteComment: (id: number) => void;
  onVoteComment: (id: number, vote: number) => void;
  onReply?: (parentId: number, text: string) => Promise<void>;
}) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const mutedColor = isDark ? '#9ca3af' : '#6b7280';
  const [replying, setReplying] = useState(false);
  const goToUserProfile = useGoToUserProfile();

  return (
    <View
      className={`bg-inset border-line-soft ${isReply ? 'border-l-line' : ''}`}
      style={[styles.commentRow, isReply && styles.commentRowReply]}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
        <View style={{ flex: 1 }}>
          <Pressable onPress={() => goToUserProfile(comment.username)}>
            <View style={styles.commentHeaderRow}>
              <Text className="text-ink" style={styles.commentAuthor}>
                {comment.full_name}
              </Text>
              <Text className="text-muted" style={styles.commentMeta}>
                @{comment.username}
              </Text>
              <Text className="text-muted" style={styles.commentMeta}>
                {formatDateTime(comment.created_at)}
              </Text>
            </View>
          </Pressable>
          <Text className="text-ink2" style={styles.commentContent}>
            {comment.content}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <VoteButtons
              upvotes={comment.upvotes}
              downvotes={comment.downvotes}
              myVote={comment.my_vote}
              onVote={(v) => onVoteComment(comment.id, v)}
            />
            {canReply && !isReply && (
              <Pressable style={styles.replyToggle} onPress={() => setReplying((r) => !r)}>
                <CornerDownRight size={13} color={mutedColor} />
                <Text className="text-muted" style={styles.replyToggleText}>
                  Yanıtla
                </Text>
              </Pressable>
            )}
          </View>
          {replying && onReply && <ReplyForm onSubmit={(text) => onReply(comment.id, text)} onCancel={() => setReplying(false)} />}
        </View>
        {canModerate && (
          <Pressable onPress={() => onDeleteComment(comment.id)} hitSlop={6}>
            <Trash2 size={15} color="#9ca3af" />
          </Pressable>
        )}
      </View>
    </View>
  );
}

interface Props {
  comments: ForumComment[];
  loading: boolean;
  canModerate: boolean;
  onAddComment: (content: string, parentCommentId?: number | null) => Promise<void>;
  onDeleteComment: (commentId: number) => void;
  onVoteComment: (commentId: number, vote: number) => void;
}

// SSS ve Öneriler detay ekranlarında paylaşılan, tek seviyeli yanıt destekli yorum listesi.
export default function ForumCommentList({ comments, loading, canModerate, onAddComment, onDeleteComment, onVoteComment }: Props) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const brandColor = isDark ? '#5A9690' : '#2F5755';
  // bkz. useDelayedLoading.ts — hızlı bağlantıda iskelet hiç görünmüyor.
  const showSkeleton = useDelayedLoading(loading);
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!text.trim()) return;
    setSubmitting(true);
    try {
      await onAddComment(text.trim());
      setText('');
    } finally {
      setSubmitting(false);
    }
  };

  const topLevel = (comments || []).filter((c) => !c.parent_comment_id);
  const repliesByParent: Record<number, ForumComment[]> = {};
  (comments || []).forEach((c) => {
    if (c.parent_comment_id) {
      repliesByParent[c.parent_comment_id] = repliesByParent[c.parent_comment_id] || [];
      repliesByParent[c.parent_comment_id].push(c);
    }
  });

  return (
    <View>
      <View style={styles.header}>
        <MessageSquare size={16} color={brandColor} />
        <Text className="text-ink" style={styles.headerText}>
          Yorumlar {comments ? `(${comments.length})` : ''}
        </Text>
      </View>

      <View style={styles.formRow}>
        <TextInput
          className="border-line text-ink"
          style={styles.formInput}
          value={text}
          onChangeText={setText}
          placeholder="Bir şeyler yaz..."
          placeholderTextColor={isDark ? '#6b7280' : '#9ca3af'}
          maxLength={2000}
        />
        <Pressable className="bg-accent" style={styles.formSubmitBtn} onPress={handleSubmit} disabled={submitting || !text.trim()}>
          <Send size={15} color="#fff" />
        </Pressable>
      </View>

      {showSkeleton ? (
        // Yorum satırının kendi ölçüleri (13px ad, 10.5px tarih, 13px gövde).
        // Çark yerine bu: veri gelince sayfanın altı yerinden oynamıyor.
        // Hızlı bağlantıda (<200ms) hiç görünmüyor, bkz. useDelayedLoading.ts.
        <SkeletonGroup>
          <View style={{ gap: 10 }}>
            {([
              { name: 78, body: ['100%', '68%'] },
              { name: 92, body: ['94%'] },
              { name: 70, body: ['100%', '52%'] },
            ] as const).map((row, i) => (
              <View key={i} className="border-line-soft" style={styles.commentRow}>
                <View style={styles.commentHeaderRow}>
                  <Skeleton width={row.name} height={13} />
                  <Skeleton width={54} height={10} />
                </View>
                <View style={{ gap: 6, marginTop: 6 }}>
                  {row.body.map((w, j) => (
                    <Skeleton key={j} height={13} style={{ width: w }} />
                  ))}
                </View>
                {/* Oy butonları SABİT (ikon + çerçeve), yalnızca sayıları gri. */}
                <View style={styles.voteRow}>
                  <View className="border-line" style={styles.voteBtn}>
                    <ThumbsUp size={13} color={isDark ? '#4b5563' : '#d1d5db'} />
                    <Skeleton width={12} height={11} />
                  </View>
                  <View className="border-line" style={styles.voteBtn}>
                    <ThumbsDown size={13} color={isDark ? '#4b5563' : '#d1d5db'} />
                    <Skeleton width={12} height={11} />
                  </View>
                </View>
              </View>
            ))}
          </View>
        </SkeletonGroup>
      ) : loading ? null : topLevel.length === 0 ? (
        <Text className="text-muted" style={styles.emptyText}>
          Henüz yorum yok — ilk yorumu sen yaz.
        </Text>
      ) : (
        <View style={{ gap: 10 }}>
          {topLevel.map((c) => (
            <View key={c.id}>
              <CommentRow
                comment={c}
                canModerate={canModerate}
                canReply
                onDeleteComment={onDeleteComment}
                onVoteComment={onVoteComment}
                onReply={(parentId, replyText) => onAddComment(replyText, parentId)}
              />
              {(repliesByParent[c.id] || []).map((r) => (
                <CommentRow
                  key={r.id}
                  comment={r}
                  canModerate={canModerate}
                  isReply
                  onDeleteComment={onDeleteComment}
                  onVoteComment={onVoteComment}
                />
              ))}
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  headerText: { fontSize: 15, fontWeight: '600' },
  formRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  formInput: { flex: 1, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13.5 },
  formSubmitBtn: { borderRadius: 10, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontSize: 13, textAlign: 'center', paddingVertical: 20 },
  commentRow: { borderWidth: 1, borderRadius: 10, padding: 10 },
  commentRowReply: { marginLeft: 24, marginTop: 8, borderLeftWidth: 2 },
  commentHeaderRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' },
  commentAuthor: { fontSize: 13, fontWeight: '600' },
  commentMeta: { fontSize: 10.5 },
  commentContent: { fontSize: 13, marginTop: 4, lineHeight: 18 },
  voteRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  voteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  voteText: { fontSize: 11.5, fontWeight: '600' },
  replyToggle: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 },
  replyToggleText: { fontSize: 11.5, fontWeight: '600' },
  replyRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  replyInput: { flex: 1, borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7, fontSize: 13 },
  replySubmitBtn: { borderRadius: 8, padding: 8 },
  replyCancelText: { fontSize: 11.5 },
});
