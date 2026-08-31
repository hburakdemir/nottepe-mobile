import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { CornerDownRight, MessageSquare, Send, ThumbsDown, ThumbsUp, Trash2 } from 'lucide-react-native';
import { useGoToUserProfile } from '../../hooks/useGoToUserProfile';

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

function VoteButtons({ upvotes = 0, downvotes = 0, myVote, onVote }: { upvotes?: number; downvotes?: number; myVote?: number | null; onVote: (v: number) => void }) {
  return (
    <View style={styles.voteRow}>
      <Pressable style={[styles.voteBtn, myVote === 1 && styles.voteBtnUp]} onPress={() => onVote(1)}>
        <ThumbsUp size={13} color={myVote === 1 ? '#2F5755' : '#6b7280'} />
        <Text style={[styles.voteText, myVote === 1 && { color: '#2F5755' }]}>{upvotes}</Text>
      </Pressable>
      <Pressable style={[styles.voteBtn, myVote === -1 && styles.voteBtnDown]} onPress={() => onVote(-1)}>
        <ThumbsDown size={13} color={myVote === -1 ? '#dc2626' : '#6b7280'} />
        <Text style={[styles.voteText, myVote === -1 && { color: '#dc2626' }]}>{downvotes}</Text>
      </Pressable>
    </View>
  );
}

function ReplyForm({ onSubmit, onCancel }: { onSubmit: (text: string) => Promise<void>; onCancel: () => void }) {
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
        style={styles.replyInput}
        value={text}
        onChangeText={setText}
        placeholder="Yanıt yaz..."
        placeholderTextColor="#9ca3af"
        maxLength={2000}
        autoFocus
      />
      <Pressable style={styles.replySubmitBtn} onPress={handleSubmit} disabled={submitting || !text.trim()}>
        <Send size={13} color="#fff" />
      </Pressable>
      <Pressable onPress={onCancel}>
        <Text style={styles.replyCancelText}>Vazgeç</Text>
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
  const [replying, setReplying] = useState(false);
  const goToUserProfile = useGoToUserProfile();

  return (
    <View style={[styles.commentRow, isReply && styles.commentRowReply]}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
        <View style={{ flex: 1 }}>
          <Pressable onPress={() => goToUserProfile(comment.username)}>
            <View style={styles.commentHeaderRow}>
              <Text style={styles.commentAuthor}>{comment.full_name}</Text>
              <Text style={styles.commentMeta}>@{comment.username}</Text>
              <Text style={styles.commentMeta}>{formatDateTime(comment.created_at)}</Text>
            </View>
          </Pressable>
          <Text style={styles.commentContent}>{comment.content}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <VoteButtons upvotes={comment.upvotes} downvotes={comment.downvotes} myVote={comment.my_vote} onVote={(v) => onVoteComment(comment.id, v)} />
            {canReply && !isReply && (
              <Pressable style={styles.replyToggle} onPress={() => setReplying((r) => !r)}>
                <CornerDownRight size={13} color="#6b7280" />
                <Text style={styles.replyToggleText}>Yanıtla</Text>
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
        <MessageSquare size={16} color="#2F5755" />
        <Text style={styles.headerText}>Yorumlar {comments ? `(${comments.length})` : ''}</Text>
      </View>

      <View style={styles.formRow}>
        <TextInput
          style={styles.formInput}
          value={text}
          onChangeText={setText}
          placeholder="Bir şeyler yaz..."
          placeholderTextColor="#9ca3af"
          maxLength={2000}
        />
        <Pressable style={styles.formSubmitBtn} onPress={handleSubmit} disabled={submitting || !text.trim()}>
          <Send size={15} color="#fff" />
        </Pressable>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginVertical: 16 }} color="#2F5755" />
      ) : topLevel.length === 0 ? (
        <Text style={styles.emptyText}>Henüz yorum yok — ilk yorumu sen yaz.</Text>
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
                <CommentRow key={r.id} comment={r} canModerate={canModerate} isReply onDeleteComment={onDeleteComment} onVoteComment={onVoteComment} />
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
  headerText: { fontSize: 15, fontWeight: '700', color: '#111827' },
  formRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  formInput: { flex: 1, borderWidth: 1, borderColor: '#d1d5db', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13.5, color: '#111827' },
  formSubmitBtn: { backgroundColor: '#2F5755', borderRadius: 10, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontSize: 13, color: '#9ca3af', textAlign: 'center', paddingVertical: 20 },
  commentRow: { backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#f3f4f6', borderRadius: 10, padding: 10 },
  commentRowReply: { marginLeft: 24, marginTop: 8, borderLeftWidth: 2, borderLeftColor: '#d1d5db' },
  commentHeaderRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' },
  commentAuthor: { fontSize: 13, fontWeight: '600', color: '#111827' },
  commentMeta: { fontSize: 10.5, color: '#9ca3af' },
  commentContent: { fontSize: 13, color: '#374151', marginTop: 4, lineHeight: 18 },
  voteRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  voteBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5 },
  voteBtnUp: { borderColor: '#2F5755' },
  voteBtnDown: { borderColor: '#dc2626' },
  voteText: { fontSize: 11.5, color: '#6b7280', fontWeight: '600' },
  replyToggle: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 },
  replyToggleText: { fontSize: 11.5, color: '#6b7280', fontWeight: '600' },
  replyRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  replyInput: { flex: 1, borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7, fontSize: 13, color: '#111827' },
  replySubmitBtn: { backgroundColor: '#2F5755', borderRadius: 8, padding: 8 },
  replyCancelText: { fontSize: 11.5, color: '#6b7280' },
});
