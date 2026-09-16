import React, { useEffect, useMemo, useState } from 'react';
import { AppState, Linking, Modal, Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import { AlertCircle, BellOff, CheckCircle, ChevronDown, X } from 'lucide-react-native';
import { useThemeColors } from '../../context/ThemeContext';
import { usePushPreferences, useUpdatePushPreferences } from '../../hooks/usePushPreferences';
import { pushGroupLabel, resolvePushType, type ResolvedPushType } from '../../lib/push/catalog';
import type { PushPreferences } from '../../lib/api';
import OptionSheet from '../layout/OptionSheet';
import StateView from '../StateView';
import { useDelayedLoading } from '../../hooks/useDelayedLoading';

const HOUR_OPTIONS = Array.from({ length: 24 }, (_, h) => `${String(h).padStart(2, '0')}:00`);

interface Props {
  visible: boolean;
  onClose: () => void;
}

// Kabuk `layout/OptionSheet.tsx`'ten KOPYALANDI, yeniden kullanılmadı.
// OptionSheet tek-seçimli: bir satıra dokunulduğu an `onSelect` + `close`
// çağırıyor. Çok anahtarlı bir tercih paneli için bu yapısal olarak yanlış —
// burada kullanıcı birden çok anahtara dokunup sonra "Kaydet"e basıyor.
// Ortak olan tek şey alttan açılan sayfanın ölçüleri; onlar bilerek birebir
// aynı tutuldu ki iki panel yan yana görüldüğünde aynı bileşen gibi dursun.

/** Kullanıcının açıkça ayarlamadığı anahtar sunucunun `default`ına düşer. */
function effectiveValue(prefs: PushPreferences, type: ResolvedPushType): boolean {
  const explicit = prefs.types?.[type.key];
  return explicit === undefined ? type.default : explicit;
}

export default function NotificationSettingsSheet({ visible, onClose }: Props) {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();

  const { data: prefs, isLoading, isError, refetch } = usePushPreferences();
  // bkz. useDelayedLoading.ts — hızlı bağlantıda spinner hiç görünmüyor.
  const showLoading = useDelayedLoading(isLoading);
  const updatePrefs = useUpdatePushPreferences();

  // Cihaz izni sunucu tercihlerinden BAĞIMSIZ: `push_enabled` açıkken bile
  // Android izni reddedilmişse tek bir bildirim gelmez. İkisini ayrı göstermek
  // zorundayız, yoksa kullanıcı açık duran anahtara bakıp "bozuk" der.
  const [permissionGranted, setPermissionGranted] = useState(true);

  const [pushEnabled, setPushEnabled] = useState(false);
  const [types, setTypes] = useState<Record<string, boolean>>({});
  const [cafeteriaHour, setCafeteriaHour] = useState(10);
  const [showHourPicker, setShowHourPicker] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const availableTypes = useMemo(() => (prefs?.available_types ?? []).map(resolvePushType), [prefs]);

  // Sunucu sırası korunarak gruplanıyor: hangi grubun önce geldiğini de sunucu
  // söylüyor (plan 3.4), istemci grup sırası uydurmuyor.
  const groups = useMemo(() => {
    const ordered: { group: string; items: ResolvedPushType[] }[] = [];
    availableTypes.forEach((type) => {
      const existing = ordered.find((g) => g.group === type.group);
      if (existing) existing.items.push(type);
      else ordered.push({ group: type.group, items: [type] });
    });
    return ordered;
  }, [availableTypes]);

  // Taslak state sunucu gövdesinden tohumlanıyor. Panel her açıldığında yeniden
  // tohumlanması bilinçli: kaydedilmemiş değişiklikle kapatmak onları ATIYOR
  // (ProfileEditModal ile aynı davranış), o yüzden bir sonraki açılış sunucudaki
  // gerçeği göstermeli.
  useEffect(() => {
    if (!visible || !prefs) return;
    setPushEnabled(prefs.push_enabled);
    const seeded: Record<string, boolean> = {};
    (prefs.available_types ?? []).map(resolvePushType).forEach((type) => {
      seeded[type.key] = effectiveValue(prefs, type);
    });
    setTypes(seeded);
    setCafeteriaHour(prefs.cafeteria_notify_hour ?? 10);
    setError('');
    setSuccess('');
  }, [visible, prefs]);

  // İzin durumu panel açılırken VE uygulama ön plana dönerken okunuyor. İkincisi
  // kurtarma yolunun kendisi: kullanıcı aşağıdaki bandın linkiyle sistem
  // ayarlarına gidip izni açtığında geri döndüğü an bant kaybolsun.
  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    const check = () => {
      Notifications.getPermissionsAsync()
        .then((status) => {
          if (!cancelled) setPermissionGranted(!!status.granted);
        })
        .catch(() => {});
    };
    check();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') check();
    });
    return () => {
      cancelled = true;
      sub.remove();
    };
  }, [visible]);

  const handleSave = async () => {
    if (!prefs) return;
    setError('');
    setSuccess('');

    const payload: { push_enabled?: boolean; types?: Record<string, boolean>; cafeteria_notify_hour?: number } = {};
    if (pushEnabled !== prefs.push_enabled) payload.push_enabled = pushEnabled;
    if (cafeteriaHour !== (prefs.cafeteria_notify_hour ?? 10)) payload.cafeteria_notify_hour = cafeteriaHour;

    // Yalnızca DEĞİŞEN anahtarlar gidiyor: sunucu `types`i shallow-merge ediyor,
    // dokunulmayanlar korunuyor. Tümünü göndermek, kullanıcının hiç görmediği
    // (bu sürümde listelenmeyen) bir anahtarı da yazmak demek olurdu.
    const typesPatch: Record<string, boolean> = {};
    availableTypes.forEach((type) => {
      const next = types[type.key];
      if (next !== undefined && next !== effectiveValue(prefs, type)) typesPatch[type.key] = next;
    });
    if (Object.keys(typesPatch).length > 0) payload.types = typesPatch;

    if (Object.keys(payload).length === 0) {
      setError('Hiçbir değişiklik yapmadınız.');
      return;
    }

    try {
      await updatePrefs.mutateAsync(payload);
      setSuccess('Bildirim tercihlerin kaydedildi.');
      setTimeout(onClose, 1200);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Tercihler kaydedilemedi.');
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      {/* Zemine dokunmak kapatıyor — OptionSheet ile aynı davranış. */}
      <Pressable className="flex-1 justify-end" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} onPress={onClose}>
        {/* İç panelde onPress yutuluyor ki panele dokunmak sayfayı kapatmasın. */}
        <Pressable
          className="bg-surface rounded-t-[18px] px-4 pt-4 max-h-[85%]"
          style={{ paddingBottom: Math.max(insets.bottom, 16) + 8 }}
          onPress={() => {}}
        >
          <View className="flex-row items-center justify-between mb-2">
            <Text className="text-ink text-base font-bold flex-1" numberOfLines={1}>
              Bildirim Ayarları
            </Text>
            <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Kapat">
              <X size={20} color={colors.muted} />
            </Pressable>
          </View>

          {!permissionGranted && (
            // BU BANT OLMADAN KURTARMA YOLU YOK: Android 13+ bildirim izni
            // dialogu bir kez reddedildikten sonra bir daha gösterilmiyor, yani
            // uygulama içinden istemek işe yaramıyor. Tek çıkış sistem ayarları.
            <Pressable
              className="flex-row items-start gap-2 bg-warn-soft border border-warn rounded-[10px] px-3 py-2.5 mb-2"
              onPress={() => Linking.openSettings()}
            >
              <BellOff size={15} color={colors.warn} style={{ marginTop: 1 }} />
              <View className="flex-1">
                <Text className="text-warn-ink text-[13px] font-bold">Bildirim izni kapalı</Text>
                <Text className="text-warn-ink text-[11.5px] leading-[16px] mt-0.5">
                  Aşağıdaki tercihler ne olursa olsun bildirim gelmez. Açmak için dokun — sistem ayarları açılır.
                </Text>
              </View>
            </Pressable>
          )}

          {!!error && (
            <View className="flex-row items-center gap-2 bg-danger-soft border border-danger-line rounded-[10px] px-3 py-2.5 mb-2">
              <AlertCircle size={15} color={colors.danger} />
              <Text className="flex-1 text-danger text-[12.5px]">{error}</Text>
            </View>
          )}
          {!!success && (
            <View className="flex-row items-center gap-2 bg-success-soft border border-success-line rounded-[10px] px-3 py-2.5 mb-2">
              <CheckCircle size={15} color={colors.success} />
              <Text className="flex-1 text-success text-[12.5px]">{success}</Text>
            </View>
          )}

          {showLoading ? (
            <View style={{ marginVertical: 32 }}>
              <StateView kind="loading" loadingColor={colors.accent} />
            </View>
          ) : isLoading ? null : isError || !prefs ? (
            <StateView kind="error" title="Bildirim tercihleri yüklenemedi." onAction={() => refetch()} />
          ) : (
            <ScrollView showsVerticalScrollIndicator={false}>
              <View className="flex-row items-center gap-2.5 py-1">
                <View className="flex-1">
                  <Text className="text-ink2 text-[13px] font-semibold">Push bildirimleri</Text>
                  <Text className="text-muted text-[11px] leading-[15px] mt-1">
                    Kapatırsan aşağıdaki tiplerin hiçbiri için bildirim almazsın.
                  </Text>
                </View>
                <Switch value={pushEnabled} onValueChange={setPushEnabled} trackColor={{ true: '#2F5755' }} />
              </View>

              {groups.map(({ group, items }) => (
                // Ana anahtar kapalıyken grup soluk VE dokunulamaz: solgun ama
                // hâlâ çalışan bir anahtar "kapattım ama bir şey olmadı" demek.
                <View key={group} style={{ opacity: pushEnabled ? 1 : 0.4 }}>
                  <Text className="text-ink2 text-[12.5px] font-semibold mt-3.5 mb-1.5">{pushGroupLabel(group)}</Text>
                  <View className="border border-line-soft rounded-[10px] overflow-hidden">
                    {items.map((type) => {
                      const Icon = type.icon;
                      const isCafeteria = type.key === 'cafeteria_daily';
                      return (
                        <View key={type.key} className="border-b border-line-soft">
                          <View className="flex-row items-center gap-2.5 px-3 py-2.5">
                            <Icon size={16} color={colors.muted} />
                            <View className="flex-1">
                              <Text className="text-ink2 text-[13px]">{type.label}</Text>
                              {!!type.description && (
                                <Text className="text-muted text-[11px] leading-[15px] mt-0.5">{type.description}</Text>
                              )}
                            </View>
                            <Switch
                              value={!!types[type.key]}
                              onValueChange={(v) => setTypes((prev) => ({ ...prev, [type.key]: v }))}
                              disabled={!pushEnabled}
                              trackColor={{ true: '#2F5755' }}
                            />
                          </View>
                          {isCafeteria && types[type.key] && (
                            <Pressable
                              className="flex-row items-center justify-between px-3 pb-2.5 pl-[38px]"
                              onPress={() => setShowHourPicker(true)}
                              disabled={!pushEnabled}
                            >
                              <Text className="text-muted text-[12px]">Bildirim saati</Text>
                              <View className="flex-row items-center gap-1">
                                <Text className="text-ink2 text-[12.5px] font-semibold">
                                  {String(cafeteriaHour).padStart(2, '0')}:00
                                </Text>
                                <ChevronDown size={14} color={colors.muted} />
                              </View>
                            </Pressable>
                          )}
                        </View>
                      );
                    })}
                  </View>
                </View>
              ))}

              {groups.length === 0 && (
                <Text className="text-muted2 text-[13px] text-center py-8">Ayarlanabilir bildirim tipi yok.</Text>
              )}
            </ScrollView>
          )}

          <View className="flex-row gap-2.5 mt-4">
            <Pressable
              className="flex-1 items-center border border-line rounded-[10px] py-3"
              onPress={onClose}
              disabled={updatePrefs.isPending}
            >
              <Text className="text-ink2 text-[13.5px] font-semibold">İptal</Text>
            </Pressable>
            <Pressable
              className="flex-1 items-center bg-brand rounded-[10px] py-3"
              style={updatePrefs.isPending || !prefs ? { opacity: 0.6 } : undefined}
              onPress={handleSave}
              disabled={updatePrefs.isPending || !prefs}
            >
              <Text className="text-white text-[13.5px] font-bold">
                {updatePrefs.isPending ? 'Kaydediliyor...' : 'Kaydet'}
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>

      <OptionSheet
        visible={showHourPicker}
        title="Bildirim saati"
        options={HOUR_OPTIONS}
        value={`${String(cafeteriaHour).padStart(2, '0')}:00`}
        onSelect={(v) => setCafeteriaHour(parseInt(v, 10))}
        onClose={() => setShowHourPicker(false)}
      />
    </Modal>
  );
}
