import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CalendarDays,
  Check,
  CheckCircle2,
  Hand,
  HelpCircle,
  MapPin,
  Phone,
  RotateCcw,
  ShieldCheck,
  User,
  X,
  XCircle,
} from 'lucide-react-native';
import { lostItemAPI } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import KeyboardAvoider from '../layout/KeyboardAvoider';
import { success } from '../../lib/haptics';
import DayTimeFields from './DayTimeFields';
import LostItemMenu from './LostItemMenu';
import {
  CLAIM_STATUS_META,
  HANDOVER_PLACE_SUGGESTIONS,
  TYPE_META,
  currentTimeString,
  dayTimeToIso,
  formatDateTime,
  formatDay,
  itemWhen,
  lostItemImageUrl,
  type LostItem,
  type LostItemClaim,
} from './lostItemMeta';

const BRAND = '#2F5755';
const errMsg = (err: any, fallback: string) => err?.response?.data?.message || fallback;

interface Props {
  itemId: number;
  initialItem?: LostItem | null;
  onClose: () => void;
  onChanged: () => void;
  onOpenProfile: (username: string) => void;
}

// ─── Başvuru formu (ilan sahibi olmayan) ──────────────────────────────
function ClaimForm({ item, onDone }: { item: LostItem; onDone: () => void }) {
  const { theme } = useTheme();
  const muted = theme === 'dark' ? '#9ca3af' : '#6b7280';
  const [open, setOpen] = useState(false);
  const [answerText, setAnswerText] = useState('');
  const [answerIndex, setAnswerIndex] = useState<number | null>(null);
  const [contact, setContact] = useState('');
  const [sending, setSending] = useState(false);
  const hasOptions = Array.isArray(item.verify_options) && item.verify_options.length > 0;
  const cta = item.type === 'found' ? 'Bu benim' : 'Ben buldum';

  const submit = async () => {
    if (hasOptions && answerIndex === null) return Alert.alert('Eksik', 'Bir şık seç');
    if (!hasOptions && item.verify_question && !answerText.trim()) return Alert.alert('Eksik', 'Soruyu cevapla');
    if (!contact.trim()) return Alert.alert('Eksik', 'İletişim bilgini yaz');
    setSending(true);
    try {
      await lostItemAPI.claim(item.id, {
        answer_text: answerText.trim() || undefined,
        answer_index: hasOptions ? answerIndex ?? undefined : undefined,
        contact: contact.trim(),
      });
      success();
      onDone();
    } catch (err: any) {
      Alert.alert('Hata', errMsg(err, 'Başvuru gönderilemedi'));
    } finally {
      setSending(false);
    }
  };

  if (!open) {
    return (
      <Pressable style={styles.primaryBtn} onPress={() => setOpen(true)}>
        <Hand size={18} color="#fff" />
        <Text style={styles.primaryBtnText}>{cta}</Text>
      </Pressable>
    );
  }

  return (
    <View className="border-line" style={styles.box}>
      {item.verify_question ? (
        <View style={{ flexDirection: 'row', gap: 6, alignItems: 'flex-start' }}>
          <HelpCircle size={16} color={BRAND} style={{ marginTop: 1 }} />
          <Text className="text-ink" style={{ fontSize: 14, fontWeight: '600', flex: 1 }}>
            {item.verify_question}
          </Text>
        </View>
      ) : (
        <Text className="text-muted" style={{ fontSize: 13 }}>
          {item.type === 'found'
            ? 'İlan sahibine eşyanın sana ait olduğunu gösterecek kısa bir not bırakabilirsin.'
            : 'Eşyayı nerede bulduğunu kısaca yazabilirsin.'}
        </Text>
      )}

      {hasOptions ? (
        <View style={{ gap: 8, marginTop: 10 }}>
          {item.verify_options!.map((opt, i) => {
            const active = answerIndex === i;
            return (
              <Pressable
                key={i}
                className={active ? '' : 'border-line'}
                style={[styles.option, active && { borderColor: BRAND, backgroundColor: '#2F57551A' }]}
                onPress={() => setAnswerIndex(i)}
              >
                <View style={[styles.radio, { borderColor: active ? BRAND : muted }, active && { backgroundColor: BRAND }]}>
                  {active && <Check size={11} color="#fff" />}
                </View>
                <Text className={active ? 'text-accent' : 'text-ink'} style={{ fontSize: 14, flex: 1 }}>
                  {opt}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : (
        <TextInput
          className="text-ink border-line"
          style={[styles.input, styles.textArea, { marginTop: 10 }]}
          value={answerText}
          onChangeText={setAnswerText}
          maxLength={300}
          multiline
          placeholder={item.verify_question ? 'Cevabın' : 'Not (isteğe bağlı)'}
          placeholderTextColor="#9ca3af"
        />
      )}

      <Text className="text-ink" style={styles.label}>
        İletişim bilgin *
      </Text>
      <TextInput
        className="text-ink border-line"
        style={styles.input}
        value={contact}
        onChangeText={setContact}
        maxLength={150}
        placeholder="Telefon, Instagram, e-posta..."
        placeholderTextColor="#9ca3af"
      />
      <Text className="text-muted2" style={styles.hint}>
        Yalnız ilan sahibi görür.
      </Text>
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
        <Pressable style={[styles.primaryBtn, { flex: 1 }, sending && { opacity: 0.6 }]} onPress={submit} disabled={sending}>
          <Text style={styles.primaryBtnText}>{sending ? 'Gönderiliyor...' : 'Başvur'}</Text>
        </Pressable>
        <Pressable className="border-line" style={styles.outlineBtn} onPress={() => setOpen(false)}>
          <Text className="text-muted" style={styles.outlineBtnText}>
            Vazgeç
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

// ─── Başvurular (ilan sahibi) ─────────────────────────────────────────
function ClaimsList({
  item,
  onChanged,
  onOpenProfile,
}: {
  item: LostItem;
  onChanged: () => void;
  onOpenProfile: (username: string) => void;
}) {
  const queryClient = useQueryClient();
  const key = ['lostItems', 'claims', item.id] as const;
  const claims = useQuery({
    queryKey: key,
    queryFn: async () => (await lostItemAPI.getClaims(item.id)).data.claims as LostItemClaim[],
  });
  const [acceptTarget, setAcceptTarget] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const decide = async (claim: LostItemClaim, action: 'accept' | 'reject') => {
    setBusy(true);
    try {
      await lostItemAPI.decideClaim(claim.id, action, action === 'accept' ? note.trim() || undefined : undefined);
      success();
      setAcceptTarget(null);
      setNote('');
      queryClient.invalidateQueries({ queryKey: key });
      if (action === 'accept') onChanged();
    } catch (err: any) {
      Alert.alert('Hata', errMsg(err, 'İşlem başarısız'));
    } finally {
      setBusy(false);
    }
  };

  if (claims.isLoading) return <ActivityIndicator color={BRAND} style={{ marginVertical: 12 }} />;
  const rows = claims.data ?? [];

  return (
    <View style={{ gap: 8 }}>
      <Text className="text-ink" style={{ fontSize: 14, fontWeight: '700' }}>
        Başvurular ({rows.length})
      </Text>
      {rows.length === 0 && (
        <Text className="text-muted" style={{ fontSize: 13 }}>
          Henüz başvuru yok.
        </Text>
      )}
      {rows.map((c) => {
        const st = CLAIM_STATUS_META[c.status];
        const optionText = c.answer_index != null && item.verify_options ? item.verify_options[c.answer_index] : null;
        return (
          <View key={c.id} className="border-line" style={styles.box}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <Pressable onPress={() => onOpenProfile(c.claimant_username)} style={{ flexShrink: 1 }}>
                <Text className="text-accent" style={{ fontSize: 14, fontWeight: '600' }} numberOfLines={1}>
                  {c.claimant_full_name || c.claimant_username}
                </Text>
              </Pressable>
              <View style={[styles.pill, { backgroundColor: st.bg }]}>
                <Text style={[styles.pillText, { color: st.text }]}>{st.label}</Text>
              </View>
            </View>
            {optionText != null && (
              <Text className="text-ink" style={{ fontSize: 13, marginTop: 4 }}>
                Seçtiği şık: <Text style={{ fontWeight: '700' }}>{optionText}</Text>{' '}
                <Text style={{ color: c.is_correct ? '#16a34a' : '#ef4444', fontSize: 12 }}>
                  {c.is_correct ? '✓ doğru' : 'yanlış'}
                </Text>
              </Text>
            )}
            {!!c.answer_text && (
              <Text className="text-ink" style={{ fontSize: 13, marginTop: 4 }}>
                "{c.answer_text}"
              </Text>
            )}
            {!!c.contact && (
              <View style={[styles.metaRow, { marginTop: 4 }]}>
                <Phone size={13} color={BRAND} />
                <Text className="text-ink" style={{ fontSize: 13, flexShrink: 1 }} selectable>
                  {c.contact}
                </Text>
              </View>
            )}
            <Text className="text-muted2" style={{ fontSize: 11, marginTop: 4 }}>
              {formatDateTime(c.created_at)}
            </Text>

            {c.status === 'pending' && item.status === 'open' &&
              (acceptTarget === c.id ? (
                <View style={{ marginTop: 8, gap: 8 }}>
                  <TextInput
                    className="text-ink border-line"
                    style={[styles.input, styles.textArea]}
                    value={note}
                    onChangeText={setNote}
                    maxLength={300}
                    multiline
                    placeholder="Başvurana not (isteğe bağlı): buluşma yeri ve saati..."
                    placeholderTextColor="#9ca3af"
                  />
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <Pressable
                      style={[styles.primaryBtn, { flex: 1, backgroundColor: '#16a34a' }, busy && { opacity: 0.6 }]}
                      onPress={() => decide(c, 'accept')}
                      disabled={busy}
                    >
                      <Text style={styles.primaryBtnText}>Onayla ve ilanı kapat</Text>
                    </Pressable>
                    <Pressable className="border-line" style={styles.outlineBtn} onPress={() => setAcceptTarget(null)}>
                      <Text className="text-muted" style={styles.outlineBtnText}>
                        Vazgeç
                      </Text>
                    </Pressable>
                  </View>
                </View>
              ) : (
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                  <Pressable
                    style={[styles.smallBtn, { backgroundColor: '#16a34a' }]}
                    onPress={() => setAcceptTarget(c.id)}
                    disabled={busy}
                  >
                    <CheckCircle2 size={14} color="#fff" />
                    <Text style={[styles.smallBtnText, { color: '#fff' }]}>Onayla</Text>
                  </Pressable>
                  <Pressable
                    className="border-line"
                    style={[styles.smallBtn, { borderWidth: 1 }]}
                    onPress={() => decide(c, 'reject')}
                    disabled={busy}
                  >
                    <XCircle size={14} color="#ef4444" />
                    <Text className="text-muted" style={styles.smallBtnText}>
                      Reddet
                    </Text>
                  </Pressable>
                </View>
              ))}
          </View>
        );
      })}
    </View>
  );
}

// ─── "Bir yere teslim ettim" (ilan sahibi, Buldum + açık) ──────────────
function HandoverForm({ item, onSaved }: { item: LostItem; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [place, setPlace] = useState(item.handed_over_place || '');
  const [daysAgo, setDaysAgo] = useState<number | null>(0);
  const [time, setTime] = useState(currentTimeString);
  const [saving, setSaving] = useState(false);

  const save = async (clear: boolean) => {
    let at: string | undefined;
    if (!clear) {
      if (!place.trim()) return Alert.alert('Eksik', 'Teslim yerini yaz');
      const iso = dayTimeToIso(daysAgo ?? 0, time);
      if (!iso) return Alert.alert('Saat', 'Saati SS:DD biçiminde yaz (örn. 14:30); gelecekte olamaz');
      at = iso;
    }
    setSaving(true);
    try {
      await lostItemAPI.setHandover(item.id, clear ? '' : place.trim(), at);
      success();
      setOpen(false);
      onSaved();
    } catch (err: any) {
      Alert.alert('Hata', errMsg(err, 'Kaydedilemedi'));
    } finally {
      setSaving(false);
    }
  };

  if (!open) {
    return (
      <Pressable className="border-line" style={styles.outlineBtn} onPress={() => setOpen(true)}>
        <ShieldCheck size={15} color="#b45309" />
        <Text className="text-ink" style={styles.outlineBtnText}>
          {item.handed_over_place ? 'Teslim bilgisini düzenle' : 'Bir yere teslim ettim'}
        </Text>
      </Pressable>
    );
  }

  return (
    <View className="border-line" style={[styles.box, { width: '100%' }]}>
      <Text className="text-ink" style={styles.label}>
        Teslim yeri
      </Text>
      <TextInput
        className="text-ink border-line"
        style={styles.input}
        value={place}
        onChangeText={setPlace}
        maxLength={150}
        placeholder="Örn: Beytepe Güvenlik Amirliği"
        placeholderTextColor="#9ca3af"
      />
      <View style={[styles.chipWrap, { marginTop: 8 }]}>
        {HANDOVER_PLACE_SUGGESTIONS.map((p) => (
          <Pressable key={p} className="bg-inset" style={styles.chip} onPress={() => setPlace(p)}>
            <Text className="text-muted" style={styles.chipText}>
              {p}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text className="text-ink" style={styles.label}>
        Teslim günü ve saati
      </Text>
      <DayTimeFields daysAgo={daysAgo} onDaysAgo={setDaysAgo} time={time} onTime={setTime} />

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
        <Pressable style={[styles.primaryBtn, { flex: 1 }, saving && { opacity: 0.6 }]} onPress={() => save(false)} disabled={saving}>
          <Text style={styles.primaryBtnText}>Kaydet</Text>
        </Pressable>
        {!!item.handed_over_place && (
          <Pressable className="border-line" style={styles.outlineBtn} onPress={() => save(true)} disabled={saving}>
            <Text className="text-muted" style={styles.outlineBtnText}>
              Kaldır
            </Text>
          </Pressable>
        )}
        <Pressable className="border-line" style={styles.outlineBtn} onPress={() => setOpen(false)}>
          <Text className="text-muted" style={styles.outlineBtnText}>
            Vazgeç
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

// ─── Ana modal ────────────────────────────────────────────────────────
export default function LostItemDetailModal({ itemId, initialItem, onClose, onChanged, onOpenProfile }: Props) {
  const { user } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const muted = isDark ? '#9ca3af' : '#6b7280';
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const width = Dimensions.get('window').width;

  const detailKey = ['lostItems', 'detail', itemId] as const;
  const detail = useQuery({
    queryKey: detailKey,
    queryFn: async () => (await lostItemAPI.getById(itemId)).data.item as LostItem,
    initialData: initialItem ?? undefined,
    // Liste satırı yalnız ilk boyama için; açılışta her zaman tazesi çekilsin.
    initialDataUpdatedAt: 0,
  });
  const item = detail.data;

  const changed = () => {
    queryClient.invalidateQueries({ queryKey: detailKey });
    onChanged();
  };

  const runStatus = async (fn: (id: number) => Promise<unknown>, fallback: string) => {
    if (!item) return;
    try {
      await fn(item.id);
      success();
      changed();
    } catch (err: any) {
      Alert.alert('Hata', errMsg(err, fallback));
    }
  };

  const confirmResolve = () =>
    Alert.alert(
      'Çözüldü',
      item?.type === 'found' ? 'Eşya sahibine ulaştı mı? İlan kapatılsın mı?' : 'Eşyanı buldun mu? İlan kapatılsın mı?',
      [
        { text: 'Vazgeç', style: 'cancel' },
        { text: 'Evet', onPress: () => runStatus(lostItemAPI.resolve, 'İşlem başarısız') },
      ]
    );

  const isOwner = !!item && user?.id === item.user_id;
  const type = item ? TYPE_META[item.type] ?? TYPE_META.lost : null;

  return (
    <Modal visible animationType="slide" onRequestClose={onClose} presentationStyle="fullScreen" statusBarTranslucent>
      <KeyboardAvoider>
        <View className="bg-ground" style={{ flex: 1, paddingTop: insets.top }}>
          <View style={styles.topBar}>
            <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Kapat">
              <X size={22} color={muted} />
            </Pressable>
            {item && item.status !== 'removed' && (
              <LostItemMenu
                item={item}
                size={22}
                onGone={() => {
                  onChanged();
                  onClose();
                }}
              />
            )}
          </View>

          {detail.isError && !item ? (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
              <Text className="text-muted">{errMsg(detail.error, 'İlan bulunamadı')}</Text>
            </View>
          ) : !item || !type ? (
            <ActivityIndicator color={BRAND} style={{ marginTop: 48 }} />
          ) : (
            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
            >
              {item.images.length > 0 && (
                <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} style={{ backgroundColor: '#000' }}>
                  {item.images.map((img) => (
                    <Image
                      key={img}
                      source={{ uri: lostItemImageUrl(img) }}
                      style={{ width, height: Math.round(width * 0.75) }}
                      contentFit="contain"
                      transition={150}
                    />
                  ))}
                </ScrollView>
              )}
              {item.images.length > 1 && (
                <Text className="text-muted2" style={{ fontSize: 11, textAlign: 'center', marginTop: 6 }}>
                  {item.images.length} fotoğraf — kaydır
                </Text>
              )}

              <View style={{ padding: 16, gap: 14 }}>
                <View>
                  <View style={styles.chipWrap}>
                    <View style={[styles.pill, { backgroundColor: type.bg }]}>
                      <Text style={[styles.pillText, { color: type.text }]}>{type.label}</Text>
                    </View>
                    {item.status === 'resolved' && (
                      <View style={[styles.pill, { backgroundColor: '#e5e7eb' }]}>
                        <Text style={[styles.pillText, { color: '#374151' }]}>Çözüldü</Text>
                      </View>
                    )}
                  </View>
                  <Text className="text-ink" style={{ fontSize: 21, fontWeight: '800', marginTop: 10 }}>
                    {item.title}
                  </Text>
                </View>

                <View style={{ gap: 5 }}>
                  {!!item.location && (
                    <View style={styles.metaRow}>
                      <MapPin size={15} color={muted} />
                      <Text className="text-muted" style={styles.metaText}>
                        {item.location}
                      </Text>
                    </View>
                  )}
                  {!!itemWhen(item) && (
                    <View style={styles.metaRow}>
                      <CalendarDays size={15} color={muted} />
                      <Text className="text-muted" style={styles.metaText}>
                        {item.type === 'found' ? 'Bulunma' : 'Kaybolma'} zamanı: {itemWhen(item)}
                      </Text>
                    </View>
                  )}
                  <View style={styles.metaRow}>
                    <User size={15} color={muted} />
                    <Pressable onPress={() => onOpenProfile(item.owner_username)}>
                      <Text className="text-accent" style={styles.metaText}>
                        {item.owner_full_name || item.owner_username}
                      </Text>
                    </Pressable>
                    <Text className="text-muted2" style={styles.metaText}>
                      · {formatDay(item.created_at)}
                    </Text>
                  </View>
                </View>

                {!!item.description && (
                  <Text className="text-ink" style={{ fontSize: 14, lineHeight: 20 }}>
                    {item.description}
                  </Text>
                )}

                {!!item.contact && (
                  <View className="bg-surface border-line" style={[styles.box, { flexDirection: 'row', gap: 10 }]}>
                    <Phone size={18} color={BRAND} style={{ marginTop: 1 }} />
                    <View style={{ flex: 1 }}>
                      <Text className="text-muted2" style={{ fontSize: 12 }}>
                        İletişim
                      </Text>
                      <Text className="text-ink" style={{ fontSize: 15, fontWeight: '600', marginTop: 2 }} selectable>
                        {item.contact}
                      </Text>
                    </View>
                  </View>
                )}

                {item.type === 'found' && item.status === 'open' && !item.handed_over_place && (
                  <View className="bg-inset" style={[styles.box, { borderWidth: 0, flexDirection: 'row', gap: 8 }]}>
                    <Hand size={16} color={muted} style={{ marginTop: 1 }} />
                    <Text className="text-ink" style={{ fontSize: 13, flex: 1 }}>
                      Eşya şu an bulan kişide.
                    </Text>
                  </View>
                )}

                {!!item.handed_over_place && !!item.handed_over_at && (
                  <View style={styles.handoverBox}>
                    <ShieldCheck size={20} color="#b45309" />
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: '#92400e', fontSize: 14 }}>
                        Bu eşya <Text style={{ fontWeight: '700' }}>{item.handed_over_place}</Text> noktasına teslim edildi
                      </Text>
                      <Text style={{ color: '#92400e', fontSize: 12, marginTop: 2 }}>{formatDateTime(item.handed_over_at)}</Text>
                    </View>
                  </View>
                )}

                {!isOwner &&
                  item.status === 'open' &&
                  (item.my_claim_status ? (
                    <View className="bg-inset" style={[styles.box, { borderWidth: 0 }]}>
                      <Text className="text-ink" style={{ fontSize: 13 }}>
                        Bu ilana başvurdun — durum:{' '}
                        <Text style={{ fontWeight: '700' }}>{CLAIM_STATUS_META[item.my_claim_status].label}</Text>. Yanıt
                        geldiğinde bildirim alacaksın.
                      </Text>
                    </View>
                  ) : (
                    <ClaimForm item={item} onDone={changed} />
                  ))}
                {!isOwner && item.status !== 'open' && item.my_claim_status === 'accepted' && (
                  <View style={[styles.box, { backgroundColor: '#dcfce7', borderWidth: 0 }]}>
                    <Text style={{ color: '#166534', fontSize: 13 }}>
                      Başvurun onaylandı. İlan sahibinin notu için "Başvurularım" sekmesine bak.
                    </Text>
                  </View>
                )}

                {isOwner && item.status !== 'removed' && (
                  <>
                    <ClaimsList item={item} onChanged={changed} onOpenProfile={onOpenProfile} />
                    <View style={[styles.chipWrap, { paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, borderColor: '#9ca3af55' }]}>
                      {item.type === 'found' && item.status === 'open' && <HandoverForm item={item} onSaved={changed} />}
                      {item.status === 'open' && (
                        <Pressable className="border-line" style={styles.outlineBtn} onPress={confirmResolve}>
                          <CheckCircle2 size={15} color={muted} />
                          <Text className="text-ink" style={styles.outlineBtnText}>
                            Çözüldü
                          </Text>
                        </Pressable>
                      )}
                      {item.status === 'resolved' && (
                        <Pressable
                          className="border-line"
                          style={styles.outlineBtn}
                          onPress={() => runStatus(lostItemAPI.reopen, 'Yeniden açılamadı')}
                        >
                          <RotateCcw size={15} color={muted} />
                          <Text className="text-ink" style={styles.outlineBtnText}>
                            Yeniden Aç
                          </Text>
                        </Pressable>
                      )}
                    </View>
                  </>
                )}
              </View>
            </ScrollView>
          )}
        </View>
      </KeyboardAvoider>
    </Modal>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: { borderRadius: 100, paddingHorizontal: 10, paddingVertical: 4 },
  pillText: { fontSize: 11, fontWeight: '700' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaText: { fontSize: 13 },
  handoverBox: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: '#fef3c7',
    borderRadius: 10,
    padding: 12,
  },
  box: { borderWidth: 1, borderRadius: 10, padding: 12 },
  label: { fontSize: 13, fontWeight: '600', marginBottom: 6, marginTop: 10 },
  input: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 9, fontSize: 14 },
  textArea: { minHeight: 64, textAlignVertical: 'top' },
  hint: { fontSize: 11.5, marginTop: 8, lineHeight: 16 },
  option: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 8, padding: 10 },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  chip: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  chipText: { fontSize: 12, fontWeight: '600' },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: BRAND,
    borderRadius: 8,
    paddingVertical: 11,
    paddingHorizontal: 14,
  },
  primaryBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  outlineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  outlineBtnText: { fontSize: 13, fontWeight: '600' },
  smallBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7 },
  smallBtnText: { fontSize: 12, fontWeight: '600' },
});
