import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withTiming,
  ZoomIn,
} from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Check, Dice5, X } from 'lucide-react-native';
import { avatarAPI } from '../../lib/api';
import { useTheme } from '../../context/ThemeContext';
import { Avatar2SVG, type Avatar2Mode } from '../../avatar2/Avatar2SVG';
import {
  ACCC,
  ACCENT,
  ACCS,
  BEARDS,
  BG,
  BODIES,
  BROWS,
  BUILDS,
  EYEC,
  EYES,
  FACES,
  HAIR,
  HAIRC,
  HATS,
  LIPC,
  MAKEC,
  MAKEUP,
  MOUTHS,
  NOSES,
  OUTC,
  OUTFITS,
  SKIN,
  normalize,
  optionsFor,
  randomConfig,
  sexOf,
  vectorPaths,
  type AvatarV2,
  type Sex,
} from '../../avatar2/core';
import { pixelPaths } from '../../avatar2/pixel';
import { toV2 } from '../../avatar2/migrateV1';

// AVATAR 2.0 OLUŞTURUCU. Sekme ve renk düzeni web'deki
// client/src/components/AvatarBuilder.jsx ile aynı; tarif ve iki çizici
// src/avatar2'de (web'deki client/src/avatar2'nin birebir kopyası).
//
// Kayıt yalnızca v2: eski avatar her yerde kalktı, ikili yazma yok. Eski
// sürümler v2'yi okuyamadığı için sunucu, X-Avatar-Version: 2 göndermeyen
// istemcilere v2 config'i null döner (bkz. lib/api.ts).

type Key = keyof AvatarV2;
interface Opt {
  id: string;
  name: string;
  sex?: Sex;
}
interface Cat {
  id: string;
  label: string;
  only?: Sex;
  groups: [label: string, key: Key, list: Opt[]][];
  colors: [label: string, key: Key, list: string[]][];
}

// Makyaj yalnızca kadında, Sakal yalnızca erkekte.
const CATS: Cat[] = [
  {
    id: 'body',
    label: 'Vücut',
    groups: [
      ['Vücut tipi', 'body', BODIES],
      ['Genişlik', 'build', BUILDS],
    ],
    colors: [
      ['Ten rengi', 'skin', SKIN],
      ['Arka plan', 'bg', BG],
    ],
  },
  { id: 'face', label: 'Yüz', groups: [['Yüz şekli', 'face', FACES]], colors: [['Ten rengi', 'skin', SKIN]] },
  { id: 'hair', label: 'Saç', groups: [['Saç', 'hair', HAIR]], colors: [['Saç rengi', 'hairColor', HAIRC]] },
  { id: 'eyes', label: 'Gözler', groups: [['Göz', 'eyes', EYES]], colors: [['Göz rengi', 'eyeColor', EYEC]] },
  { id: 'brows', label: 'Kaşlar', groups: [['Kaş', 'brows', BROWS]], colors: [] },
  { id: 'nose', label: 'Burun', groups: [['Burun', 'nose', NOSES]], colors: [] },
  { id: 'mouth', label: 'Ağız', groups: [['Ağız', 'mouth', MOUTHS]], colors: [['Dudak rengi', 'lip', LIPC]] },
  { id: 'makeup', label: 'Makyaj', only: 'k', groups: [['Makyaj', 'makeup', MAKEUP]], colors: [['Far rengi', 'makeupColor', MAKEC]] },
  { id: 'beard', label: 'Sakal', only: 'e', groups: [['Sakal', 'beard', BEARDS]], colors: [['Sakal rengi', 'beardColor', HAIRC]] },
  {
    id: 'outfit',
    label: 'Kıyafet',
    groups: [['Kıyafet', 'outfit', OUTFITS]],
    colors: [
      ['Ana renk', 'outfitColor', OUTC],
      ['Detay rengi', 'accent', ACCENT],
    ],
  },
  { id: 'hat', label: 'Şapka', groups: [['Şapka ve örtü', 'hat', HATS]], colors: [['Renk', 'hatColor', OUTC]] },
  { id: 'acc', label: 'Aksesuar', groups: [['Aksesuar', 'acc', ACCS]], colors: [['Aksesuar rengi', 'accColor', ACCC]] },
];

// Vücut tipi listesi süzülmez: ikisi de her zaman seçilebilir olmalı.
const visible = (key: Key, list: Opt[], sx: Sex) => (key === 'body' ? list : optionsFor(list, sx));
const catsFor = (sx: Sex) => CATS.filter((c) => !c.only || c.only === sx);
const sameColor = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

function ColorRow({ colors, value, onChange }: { colors: string[]; value: string; onChange: (c: string) => void }) {
  return (
    <View className="flex-row flex-wrap gap-2">
      {colors.map((c) => {
        const on = sameColor(c, value);
        return (
          <Pressable
            key={c}
            onPress={() => onChange(c)}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            className={`w-[26px] h-[26px] rounded-[13px] border-2 ${on ? 'border-accent scale-110' : 'border-line'}`}
            style={{ backgroundColor: c }}
          />
        );
      })}
    </View>
  );
}

// Seçenek kutusu, o seçenekle çizilmiş avatarın kendisi.
// Memo yok: `config` her seçimde yeniden kuruluyor, bu bilerek — kutular güncel
// saç rengi, ten vb. ile çizilmeli. Hesap ucuz (Normal ~0,2 ms, Piksel ~1,8 ms).
function OptTile({
  label,
  config,
  mode,
  active,
  onPress,
}: {
  label: string;
  config: Partial<AvatarV2>;
  mode: Avatar2Mode;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      className={`w-[64px] items-center gap-1 py-1 rounded-xl border-2 ${active ? 'border-accent bg-accent-soft' : 'border-transparent bg-inset'}`}
    >
      {/* 48 dp: satıra 5 seçenek sığsın (web'de de aynı). */}
      <View className="w-[48px] h-[48px] rounded-[8px] overflow-hidden">
        <Avatar2SVG config={config} mode={mode} size={48} />
      </View>
      <Text numberOfLines={2} className={`text-[10px] font-semibold text-center px-0.5 ${active ? 'text-ink' : 'text-muted'}`}>
        {label}
      </Text>
    </Pressable>
  );
}

function Section({ label, children }: { label?: string; children: React.ReactNode }) {
  return (
    <View className="mt-4">
      {!!label && <Text className="text-[11px] font-bold text-muted2 tracking-[0.5px] mb-2 uppercase">{label}</Text>}
      {children}
    </View>
  );
}

// Görünüm avatarın sahibinin seçimi ve config'le birlikte kaydediliyor: herkes
// avatarı bu görünümde görür.
function ModeSwitch({ mode, onChange }: { mode: Avatar2Mode; onChange: (m: Avatar2Mode) => void }) {
  return (
    <View className="flex-row rounded-[10px] border border-line overflow-hidden" accessibilityLabel="Görünüm">
      {(['piksel', 'normal'] as const).map((m) => (
        <Pressable
          key={m}
          onPress={() => onChange(m)}
          accessibilityRole="button"
          accessibilityState={{ selected: mode === m }}
          className={`px-3.5 h-10 items-center justify-center ${mode === m ? 'bg-accent-soft' : ''}`}
        >
          <Text className={`text-[13px] font-bold ${mode === m ? 'text-ink' : 'text-muted'}`}>{m === 'piksel' ? 'Piksel' : 'Normal'}</Text>
        </Pressable>
      ))}
    </View>
  );
}

interface Props {
  // Sunucudaki config olduğu gibi (v1 ya da v2); toV2 ile okunuyor.
  initialConfig: unknown;
  onSaved: (config: AvatarV2) => void;
  onClose: () => void;
}

export default function AvatarBuilderScreen({ initialConfig, onSaved, onClose }: Props) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const initial = useMemo(() => toV2(initialConfig), [initialConfig]);
  const [cfg, setCfg] = useState<AvatarV2>(initial.config);
  // v1'den çevrilen avatarda vücut tipi tahmin edilemediyse kullanıcıya sor.
  // Hiç avatarı olmayanda da sexGuessed false geliyor (toV2(null)); ona "çevrildi"
  // demek yanlış olur, o yüzden yalnızca gerçekten bir eski config varken.
  const hadConfig = !!initialConfig && typeof initialConfig === 'object' && Object.keys(initialConfig).length > 0;
  const [askBody, setAskBody] = useState(hadConfig && !initial.sexGuessed);
  const [tab, setTab] = useState('body');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const sx = sexOf(cfg);
  const cats = catsFor(sx);
  // Vücut tipi değişince Makyaj/Sakal sekmesi kaybolabilir: Vücut'a dön.
  const cat = cats.find((c) => c.id === tab) ?? cats[0];

  const set = useCallback((key: Key, val: string) => {
    setCfg((prev) => normalize({ ...prev, [key]: val }));
    if (key === 'body') setAskBody(false);
    setSaved(false);
  }, []);

  // Rastgele, seçili görünümü korur.
  const handleRandomize = useCallback(() => {
    setCfg((prev) => randomConfig(Math.random, prev.style));
    setAskBody(false);
    setSaved(false);
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      // Sunucu bilinmeyen alanı 400 ile reddediyor; normalize yalnızca şemadaki
      // alanları bırakıp renkleri #rrggbb'ye zorluyor.
      const clean = normalize(cfg);
      await avatarAPI.save(clean as unknown as Record<string, unknown>);
      setSaved(true);
      onSaved(clean);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Avatar kaydedilemedi.');
    } finally {
      setSaving(false);
    }
  };

  // ── Düzen ──────────────────────────────────────────────────────────────────
  // Solda sabit avatar (+ görünüm, zar), yanında kategoriler alt alta; altta
  // seçenekler, tek kaydırma alanı. Avatar küçülüp büyümüyor; dokununca tam
  // ekran açılıyor. Web'deki AvatarBuilder.jsx ile aynı düzen.
  const { width: winW, height: winH } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  // 412 dp'lik telefonda 176; dar ekranda kategorilere en az yarısı kalsın.
  const AV = Math.min(176, Math.floor((winW - 32 - 12) / 2));
  const ZOOM = Math.floor(Math.min(winW, winH) * 0.85);
  const scrollRef = useRef<ScrollView>(null);
  // Kategori değişince listenin başına dön.
  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [cat.id]);
  const [zoom, setZoom] = useState(false);
  const reduceMotion = useReducedMotion();

  // Zar her basışta geri gerilip iki tur atarak sıçrıyor, yaylanıp yerine
  // oturuyor (web'deki dice-roll ile aynı kareler).
  const diceTurn = useSharedValue(0);
  const diceScale = useSharedValue(1);
  const diceLift = useSharedValue(0);
  const diceStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: diceLift.value }, { rotate: `${diceTurn.value}deg` }, { scale: diceScale.value }],
  }));
  const onDice = useCallback(() => {
    if (!reduceMotion) {
      const out = Easing.out(Easing.cubic);
      const base = Math.round(diceTurn.value / 360) * 360;
      diceTurn.value = withSequence(
        withTiming(base - 28, { duration: 120, easing: out }),
        withTiming(base + 560, { duration: 320, easing: out }),
        withTiming(base + 705, { duration: 185, easing: out }),
        withTiming(base + 724, { duration: 95 }),
        withTiming(base + 720, { duration: 80 })
      );
      diceScale.value = withSequence(
        withTiming(0.88, { duration: 120 }),
        withTiming(1.15, { duration: 320, easing: out }),
        withTiming(0.94, { duration: 185 }),
        withTiming(1.03, { duration: 95 }),
        withTiming(1, { duration: 80 })
      );
      diceLift.value = withSequence(
        withTiming(2, { duration: 120 }),
        withTiming(-12, { duration: 320, easing: out }),
        withTiming(2, { duration: 185 }),
        withTiming(-2, { duration: 95 }),
        withTiming(0, { duration: 80 })
      );
    }
    handleRandomize();
  }, [diceLift, diceScale, diceTurn, handleRandomize, reduceMotion]);

  // Geliştirici için: Android'de çizilecek gerçek düğüm sayısı (yollar +
  // tekil kırpmalar). Eski paketli avatarın en kötüsü 13.
  const nodes = useMemo(() => {
    if (!__DEV__) return 0;
    if (cfg.style === 'piksel') return pixelPaths(cfg).length;
    const { paths } = vectorPaths(cfg);
    return paths.length + new Set(paths.filter((p) => p.clip).map((p) => p.clip)).size;
  }, [cfg]);

  return (
    <SafeAreaView edges={['top', 'bottom']} className="flex-1 bg-surface">
      <View className="flex-row gap-3 px-4 pt-4 pb-3 border-b border-line-soft">
        {/* ── Avatar (sabit) ── */}
        <View className="items-center gap-2" style={{ width: AV }}>
          <Pressable
            onPress={() => setZoom(true)}
            accessibilityRole="button"
            accessibilityLabel="Avatarı büyük göster"
            className="rounded-[28px] overflow-hidden border-[3px] border-beige"
            style={{ width: AV, height: AV }}
          >
            {/* Avatar kutunun İÇ alanı kadar: AV − 2×3 (çerçeve). */}
            <Avatar2SVG config={cfg} size={AV - 6} />
          </Pressable>
          {__DEV__ && <Text className="text-[10px] text-muted2">{nodes} düğüm</Text>}
          <ModeSwitch mode={cfg.style} onChange={(m) => set('style', m)} />
          {/* Arka plansız zar; basılıyken rengi açılıyor (web'deki hover ile aynı). */}
          <Pressable
            onPress={onDice}
            accessibilityRole="button"
            accessibilityLabel="Rastgele avatar"
            hitSlop={6}
            style={({ pressed }) => ({
              width: 40,
              height: 40,
              alignItems: 'center',
              justifyContent: 'center',
              transform: [{ scale: pressed ? 0.92 : 1 }],
            })}
          >
            {({ pressed }) => (
              <Animated.View style={diceStyle}>
                <Dice5 size={28} strokeWidth={2} color={pressed ? (isDark ? '#ffffff' : '#5A9690') : isDark ? '#DFD0B8' : '#2F5755'} />
              </Animated.View>
            )}
          </Pressable>
        </View>

        {/* ── Kategoriler (alt alta, sabit) ── */}
        {/* Satır 24 dp: 11 kategori avatar sütunu kadar yer tutsun, seçeneklere alan kalsın. */}
        <View className="flex-1" accessibilityRole="tablist">
          {cats.map((c) => {
            const on = c.id === cat.id;
            const count = c.groups.reduce((n, [, key, list]) => n + visible(key, list, sx).length, 0);
            return (
              <Pressable
                key={c.id}
                onPress={() => setTab(c.id)}
                accessibilityRole="tab"
                accessibilityState={{ selected: on }}
                className={`flex-row items-center justify-between px-2.5 h-[24px] rounded-md ${on ? 'bg-brand' : ''}`}
              >
                <Text numberOfLines={1} className={`text-[13px] font-bold ${on ? 'text-white' : 'text-ink'}`}>
                  {c.label}
                </Text>
                <Text className={`text-[11px] font-semibold ${on ? 'text-white/70' : 'text-muted2'}`}>{count}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        className="flex-1 px-4"
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        {askBody && (
          <View className="mt-4 rounded-[10px] border border-warn bg-warn-soft p-3">
            <Text className="text-[13px] text-warn-ink leading-[18px]">Avatarın yeni sürüme çevrildi. Vücut tipini seçer misin? Seçenekler buna göre değişiyor.</Text>
            <View className="flex-row gap-2 mt-2.5">
              {BODIES.map((b) => (
                <Pressable
                  key={b.id}
                  onPress={() => set('body', b.id)}
                  accessibilityRole="button"
                  className="px-3.5 h-9 items-center justify-center rounded-lg border border-warn"
                >
                  <Text className="text-[13px] font-bold text-warn-ink">{b.name}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}
        {cat.groups.map(([label, key, list]) => (
          <Section key={key} label={cat.groups.length > 1 ? label : undefined}>
            <View className="flex-row flex-wrap gap-1.5">
              {visible(key, list, sx).map((o) => (
                <OptTile
                  key={o.id}
                  label={o.name}
                  config={key === 'body' ? normalize({ ...cfg, body: o.id }) : { ...cfg, [key]: o.id }}
                  mode={cfg.style}
                  active={cfg[key] === o.id}
                  onPress={() => set(key, o.id)}
                />
              ))}
            </View>
          </Section>
        ))}
        {cat.colors.map(([label, key, list]) => (
          <Section key={key} label={label}>
            <ColorRow colors={list} value={String(cfg[key])} onChange={(c) => set(key, c)} />
          </Section>
        ))}
      </ScrollView>

      {/* Hata, Kaydet'in hemen üstünde. */}
      {!!error && <Text className="text-red-600 text-[11.5px] text-center px-4 pt-2">{error}</Text>}
      {/* ALT ÇUBUK — solda Vazgeç, sağda Kaydet (kullanıcı isteği). */}
      <View className="flex-row items-center gap-3 px-4 py-3 border-t border-line-soft">
        <Pressable
          className="flex-1 items-center justify-center h-11 rounded-[10px] border border-line"
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Vazgeç"
        >
          <Text className="text-sm font-bold text-ink2">Vazgeç</Text>
        </Pressable>
        <Pressable
          className={`flex-1 flex-row items-center justify-center gap-1.5 h-11 rounded-[10px] ${saved ? 'bg-green-500' : 'bg-brand'} ${saving ? 'opacity-60' : ''}`}
          onPress={handleSave}
          disabled={saving || saved}
          accessibilityRole="button"
          accessibilityLabel="Kaydet"
        >
          {saving ? <ActivityIndicator size="small" color="#fff" /> : saved ? <Check size={16} color="#fff" /> : null}
          <Text className="text-white text-sm font-bold">{saving ? 'Kaydediliyor...' : saved ? 'Kaydedildi!' : 'Kaydet'}</Text>
        </Pressable>
      </View>

      {/* ── Tam ekran önizleme ── avatara dokununca; herhangi bir yere dokununca kapanır. */}
      {zoom && (
        <Animated.View
          entering={reduceMotion ? undefined : FadeIn.duration(160)}
          exiting={reduceMotion ? undefined : FadeOut.duration(120)}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 10, backgroundColor: 'rgba(0,0,0,0.85)' }}
        >
          <Pressable
            onPress={() => setZoom(false)}
            accessibilityRole="button"
            accessibilityLabel="Önizlemeyi kapat"
            style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
          >
            <Animated.View entering={reduceMotion ? undefined : ZoomIn.duration(200)}>
              <View className="rounded-[36px] overflow-hidden border-4 border-white" style={{ width: ZOOM, height: ZOOM }}>
                <Avatar2SVG config={cfg} size={ZOOM - 8} />
              </View>
            </Animated.View>
          </Pressable>
          <View pointerEvents="none" style={{ position: 'absolute', top: insets.top + 12, right: 16 }}>
            <X size={26} color="#fff" />
          </View>
        </Animated.View>
      )}
    </SafeAreaView>
  );
}
