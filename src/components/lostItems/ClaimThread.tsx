import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Text, TextInput, View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, ChevronUp, Lock, MessagesSquare, Send } from 'lucide-react-native';
import { lostItemAPI } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { formatDateTime, type LostItemMessage } from './lostItemMeta';

const BRAND = '#2F5755';
// Konuşma açıkken karşı tarafın yanıtı için hafif yoklama (soket yok).
const POLL_MS = 10 * 1000;

interface ThreadData {
  messages: LostItemMessage[];
  can_send: boolean;
  closed_reason: string | null;
}

// Başvuran ↔ ilan sahibi özel konuşması (bkz. sunucu 058_lost_item_messages.sql).
// Kapalı başlar: "Mesajlar (n)" satırı, okunmamış varsa rozetli. Açılınca
// mesajlar + giriş kutusu; açılış karşı tarafın mesajlarını okundu sayar.
export default function ClaimThread({
  claimId,
  itemId,
  messageCount = 0,
  unreadCount = 0,
  otherLabel,
  defaultOpen = false,
}: {
  claimId: number;
  itemId: number;
  messageCount?: number;
  unreadCount?: number;
  /** Başlıkta "… ile mesajlar" — karşı tarafın adı. */
  otherLabel: string;
  defaultOpen?: boolean;
}) {
  const { user } = useAuth();
  const { theme } = useTheme();
  const muted = theme === 'dark' ? '#9ca3af' : '#6b7280';
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(defaultOpen);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  const key = ['lostItems', 'messages', claimId] as const;
  const thread = useQuery({
    queryKey: key,
    queryFn: async () => (await lostItemAPI.getMessages(claimId)).data as ThreadData,
    enabled: open,
    refetchInterval: open ? POLL_MS : false,
  });

  // İlk yüklemede okunmamış rozetleri tazele (sunucu okundu işaretledi).
  const markedRef = useRef(false);
  useEffect(() => {
    if (!thread.isSuccess || markedRef.current) return;
    markedRef.current = true;
    queryClient.invalidateQueries({ queryKey: ['lostItems', 'claims', itemId] });
    queryClient.invalidateQueries({ queryKey: ['lostItems', 'myClaims'] });
  }, [thread.isSuccess, itemId, queryClient]);

  const send = async () => {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      await lostItemAPI.sendMessage(claimId, body);
      setText('');
      await queryClient.invalidateQueries({ queryKey: key });
    } catch (err: any) {
      Alert.alert('Hata', err?.response?.data?.message || 'Mesaj gönderilemedi');
    } finally {
      setSending(false);
    }
  };

  const messages = thread.data?.messages ?? [];
  const count = thread.data ? messages.length : messageCount;
  const showUnread = !open && unreadCount > 0;

  return (
    <View className="border-line" style={{ borderTopWidth: 1, marginTop: 10, paddingTop: 10 }}>
      <Pressable
        onPress={() => setOpen((v) => !v)}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
      >
        <MessagesSquare size={16} color={BRAND} />
        <Text className="text-ink" style={{ fontSize: 13, fontWeight: '700', flexShrink: 1 }} numberOfLines={1}>
          {otherLabel} ile mesajlar{count > 0 ? ` (${count})` : ''}
        </Text>
        {showUnread && (
          <View style={{ backgroundColor: '#ef4444', borderRadius: 9, minWidth: 18, height: 18, paddingHorizontal: 5, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>{unreadCount}</Text>
          </View>
        )}
        <View style={{ flex: 1 }} />
        {open ? <ChevronUp size={16} color={muted} /> : <ChevronDown size={16} color={muted} />}
      </Pressable>

      {open && (
        <View style={{ marginTop: 10, gap: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Lock size={11} color={muted} />
            <Text className="text-muted2" style={{ fontSize: 11 }}>
              Yalnız siz ikiniz ve Nottepe yetkilileri görebilir.
            </Text>
          </View>

          {thread.isLoading ? (
            <ActivityIndicator color={BRAND} style={{ marginVertical: 8 }} />
          ) : thread.isError ? (
            <Text className="text-muted" style={{ fontSize: 13 }}>
              Mesajlar yüklenemedi.
            </Text>
          ) : messages.length === 0 ? (
            <Text className="text-muted" style={{ fontSize: 13 }}>
              Henüz mesaj yok. Buluşma yeri, saat ya da eşyayla ilgili soruları buradan konuşabilirsiniz.
            </Text>
          ) : (
            messages.map((m) => {
              const mine = m.sender_id === user?.id;
              return (
                <View key={m.id} style={{ alignItems: mine ? 'flex-end' : 'flex-start' }}>
                  <View
                    className={mine ? '' : 'bg-inset'}
                    style={[
                      { maxWidth: '85%', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8 },
                      mine ? { backgroundColor: BRAND, borderBottomRightRadius: 4 } : { borderBottomLeftRadius: 4 },
                    ]}
                  >
                    <Text className={mine ? '' : 'text-ink'} style={[{ fontSize: 14, lineHeight: 19 }, mine && { color: '#fff' }]} selectable>
                      {m.body}
                    </Text>
                  </View>
                  <Text className="text-muted2" style={{ fontSize: 10.5, marginTop: 2 }}>
                    {formatDateTime(m.created_at)}
                  </Text>
                </View>
              );
            })
          )}

          {thread.data && !thread.data.can_send ? (
            !!thread.data.closed_reason && (
              <Text className="text-muted2" style={{ fontSize: 12, fontStyle: 'italic' }}>
                {thread.data.closed_reason}
              </Text>
            )
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
              <TextInput
                className="text-ink border-line"
                style={{ flex: 1, borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 9, fontSize: 14, maxHeight: 110 }}
                value={text}
                onChangeText={setText}
                maxLength={1000}
                multiline
                placeholder="Mesaj yaz..."
                placeholderTextColor="#9ca3af"
              />
              <Pressable
                onPress={send}
                disabled={sending || !text.trim()}
                accessibilityLabel="Gönder"
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 8,
                  backgroundColor: BRAND,
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: sending || !text.trim() ? 0.5 : 1,
                }}
              >
                {sending ? <ActivityIndicator color="#fff" size="small" /> : <Send size={17} color="#fff" />}
              </Pressable>
            </View>
          )}
        </View>
      )}
    </View>
  );
}
