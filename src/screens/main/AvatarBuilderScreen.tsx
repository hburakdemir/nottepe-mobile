import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import Svg, { Rect as SvgRect } from 'react-native-svg';
import { Check, Dice5, ShieldOff } from 'lucide-react-native';
import { avatarAPI } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { AvatarSVG } from '../../components/avatar/AvatarSVG';
import {
  BEARD_COLORS,
  BEARD_STYLES,
  BG_COLORS,
  BROW_COLORS,
  BROW_STYLES,
  DEFAULT_AVATAR_CONFIG,
  EYE_COLORS,
  EYE_STYLES,
  FACES,
  HAIR_COLORS,
  HAIR_STYLES,
  JERSEYS,
  LIP_COLORS,
  OUTFIT_COLORS,
  OUTFIT_LABELS,
  OUTFIT_PATTERN_COLORS,
  OUTFIT_STYLES,
  SKIN_COLORS,
  generateRandomConfig,
  jerseyBodyRects,
  type AvatarConfig,
  type Rect,
} from '../../constants/avatarConfig';

function ColorRow({ colors, activeIdx, onChange }: { colors: string[]; activeIdx: number; onChange: (i: number) => void }) {
  return (
    <View className="flex-row flex-wrap gap-2">
      {colors.map((c, i) => (
        <Pressable
          key={i}
          onPress={() => onChange(i)}
          className={`w-[26px] h-[26px] rounded-[13px] border-2 ${
            i === activeIdx ? 'border-brand dark:border-brand-light scale-110' : c === '#ffffff' ? 'border-gray-300 dark:border-gray-600' : 'border-transparent'
          }`}
          style={{ backgroundColor: c }}
        />
      ))}
    </View>
  );
}

function MiniSvg({ rects, skin }: { rects: Rect[]; skin: string }) {
  return (
    <Svg width={30} height={30} viewBox="0 0 32 40">
      <SvgRect x={8} y={7} width={16} height={16} fill={skin} />
      {rects.map((r, i) =>
        r.type === 'image' ? null : <SvgRect key={i} x={r.x} y={r.y} width={r.w} height={r.h} rx={r.rx} fill={r.c} />
      )}
    </Svg>
  );
}

function OptButton({
  rects,
  skin,
  active,
  onPress,
  disabled,
}: {
  rects: Rect[];
  skin: string;
  active: boolean;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      className={`w-[38px] h-[38px] rounded-lg border-2 items-center justify-center overflow-hidden ${
        active ? 'border-brand dark:border-brand-light bg-brand/10 dark:bg-brand-light/20' : 'border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-darkbg'
      } ${disabled ? 'opacity-30' : ''}`}
    >
      <MiniSvg rects={rects} skin={skin} />
    </Pressable>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View className="mt-4">
      <Text className="text-[11px] font-bold text-gray-400 dark:text-gray-500 tracking-[0.5px] mb-2 uppercase">{label}</Text>
      {children}
    </View>
  );
}

interface Props {
  initialConfig: Partial<AvatarConfig>;
  isStaff: boolean;
  onSaved: (config: AvatarConfig) => void;
  onClose: () => void;
}

export default function AvatarBuilderScreen({ initialConfig, isStaff, onSaved, onClose }: Props) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [cfg, setCfg] = useState<AvatarConfig>({ ...DEFAULT_AVATAR_CONFIG, ...initialConfig });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const set = useCallback(<K extends keyof AvatarConfig>(key: K, val: AvatarConfig[K]) => {
    setCfg((prev) => ({ ...prev, [key]: val }));
    setSaved(false);
  }, []);

  const handleRandomize = () => {
    setCfg({ ...generateRandomConfig(), jersey: null });
    setSaved(false);
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      await avatarAPI.save(cfg as unknown as Record<string, unknown>);
      setSaved(true);
      onSaved(cfg);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Avatar kaydedilemedi.');
    } finally {
      setSaving(false);
    }
  };

  const skin = SKIN_COLORS[cfg.skin] || SKIN_COLORS[0];

  return (
    <View className="flex-1 bg-primary dark:bg-darkbgbutton">
      <View className="items-center py-4 border-b border-gray-100 dark:border-gray-700/40">
        <View className="w-[150px] h-[150px] rounded-[30px] overflow-hidden border-[3px] border-beige">
          <AvatarSVG config={cfg} size={140} />
        </View>
        <View className="flex-row gap-2.5 mt-3">
          <Pressable className="w-10 h-10 rounded-[10px] bg-brand items-center justify-center" onPress={handleRandomize}>
            <Dice5 size={20} color="#fff" />
          </Pressable>
          <Pressable
            className={`flex-row items-center gap-1.5 px-4 h-10 rounded-[10px] ${saved ? 'bg-green-500' : 'bg-brand'} ${saving ? 'opacity-60' : ''}`}
            onPress={handleSave}
            disabled={saving || saved}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : saved ? (
              <Check size={16} color="#fff" />
            ) : null}
            <Text className="text-white text-[13px] font-bold">{saving ? 'Kaydediliyor...' : saved ? 'Kaydedildi!' : 'Kaydet'}</Text>
          </Pressable>
        </View>
        {!!error && <Text className="text-red-600 text-[11.5px] mt-2 text-center max-w-[220px]">{error}</Text>}
      </View>

      <ScrollView className="flex-1 px-4" contentContainerStyle={{ paddingBottom: 40 }}>
        <Section label="Arka plan">
          <ColorRow colors={BG_COLORS} activeIdx={cfg.bg} onChange={(v) => set('bg', v)} />
        </Section>

        <Section label="Ten rengi">
          <ColorRow colors={SKIN_COLORS} activeIdx={cfg.skin} onChange={(v) => set('skin', v)} />
        </Section>

        <Section label="Yüz şekli">
          <View className="flex-row flex-wrap gap-2">
            {FACES.map((rects, i) => (
              <OptButton key={i} rects={rects} skin={skin} active={cfg.face === i} onPress={() => set('face', i)} />
            ))}
          </View>
        </Section>

        <Section label="Saç Stili">
          <View className="flex-row flex-wrap gap-2">
            {HAIR_STYLES.map((style, i) => (
              <OptButton
                key={i}
                rects={(style ?? []).map((r) => ({ ...r, c: HAIR_COLORS[cfg.hairColor] }))}
                skin={skin}
                active={cfg.hair === i}
                onPress={() => set('hair', i)}
              />
            ))}
          </View>
        </Section>

        <Section label="Saç rengi">
          <ColorRow colors={HAIR_COLORS} activeIdx={cfg.hairColor} onChange={(v) => set('hairColor', v)} />
        </Section>

        <Section label="Göz">
          <View className="flex-row flex-wrap gap-2">
            {EYE_STYLES.map((fn, i) => (
              <OptButton
                key={i}
                rects={fn(skin, EYE_COLORS[cfg.eyeColor])}
                skin={skin}
                active={cfg.eye === i}
                onPress={() => set('eye', i)}
              />
            ))}
          </View>
        </Section>

        <Section label="Göz rengi">
          <ColorRow colors={EYE_COLORS} activeIdx={cfg.eyeColor} onChange={(v) => set('eyeColor', v)} />
        </Section>

        <Section label="Kaş">
          <View className="flex-row flex-wrap gap-2">
            {BROW_STYLES.map((fn, i) => (
              <OptButton
                key={i}
                rects={fn(BROW_COLORS[cfg.browColor ?? 0])}
                skin={skin}
                active={cfg.brow === i}
                onPress={() => set('brow', i)}
              />
            ))}
          </View>
        </Section>

        <Section label="Kaş rengi">
          <ColorRow colors={BROW_COLORS} activeIdx={cfg.browColor ?? 0} onChange={(v) => set('browColor', v)} />
        </Section>

        <Section label="Dudak rengi">
          <ColorRow colors={LIP_COLORS} activeIdx={cfg.lipColor ?? 0} onChange={(v) => set('lipColor', v)} />
        </Section>

        <Section label="Sakal">
          <View className="flex-row flex-wrap gap-2">
            {BEARD_STYLES.map((fn, i) => (
              <OptButton
                key={i}
                rects={fn(BEARD_COLORS[cfg.beardColor])}
                skin={skin}
                active={cfg.beard === i}
                onPress={() => set('beard', i)}
              />
            ))}
          </View>
        </Section>

        <Section label="Sakal rengi">
          <ColorRow colors={BEARD_COLORS} activeIdx={cfg.beardColor} onChange={(v) => set('beardColor', v)} />
        </Section>

        <Section label="Kıyafet">
          <View className="flex-row flex-wrap gap-2">
            {OUTFIT_STYLES.map((fn, i) => (
              <OptButton
                key={i}
                rects={i === 0 ? [] : fn(OUTFIT_COLORS[cfg.outfitColor], OUTFIT_PATTERN_COLORS[cfg.outfitColor2 ?? 0])}
                skin={skin}
                active={!cfg.jersey && cfg.outfit === i}
                onPress={() => set('outfit', i)}
                disabled={!!cfg.jersey}
              />
            ))}
          </View>
          {!!cfg.jersey && <Text className="text-[11px] text-gray-400 dark:text-gray-500 mt-1.5">Forma seçiliyken kıyafet değiştirilemez.</Text>}
        </Section>

        {!cfg.jersey && (
          <>
            <Section label="Kıyafet ana rengi">
              <ColorRow colors={OUTFIT_COLORS} activeIdx={cfg.outfitColor} onChange={(v) => set('outfitColor', v)} />
            </Section>
            {cfg.outfit > 0 && (
              <Section label="Kıyafet desen / detay rengi">
                <ColorRow
                  colors={OUTFIT_PATTERN_COLORS}
                  activeIdx={cfg.outfitColor2 ?? 0}
                  onChange={(v) => set('outfitColor2', v)}
                />
              </Section>
            )}
          </>
        )}

        {isStaff && (
          <Section label="Forma (admin/moderatör)">
            <View className="flex-row flex-wrap gap-2">
              {JERSEYS.map((team) => (
                <OptButton
                  key={team.id}
                  rects={jerseyBodyRects(team)}
                  skin={skin}
                  active={cfg.jersey === team.id}
                  onPress={() => set('jersey', team.id)}
                />
              ))}
            </View>
            {!!cfg.jersey && (
              <Pressable className="flex-row items-center gap-1.5 mt-2" onPress={() => set('jersey', null)}>
                <ShieldOff size={14} color={isDark ? '#9ca3af' : '#6b7280'} />
                <Text className="text-xs text-gray-500 dark:text-gray-400 font-semibold">Formayı kaldır</Text>
              </Pressable>
            )}
            <Text className="text-[11px] text-gray-400 dark:text-gray-500 mt-1.5">Forma seçiliyken renkler sabittir.</Text>
          </Section>
        )}
      </ScrollView>

      <Pressable className="items-center py-3.5 border-t border-gray-100 dark:border-gray-700/40" onPress={onClose}>
        <Text className="text-sm font-bold text-gray-700 dark:text-darktext">Kapat</Text>
      </Pressable>
    </View>
  );
}
