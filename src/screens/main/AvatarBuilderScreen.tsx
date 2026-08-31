import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Rect as SvgRect } from 'react-native-svg';
import { Check, Dice5, ShieldOff } from 'lucide-react-native';
import { avatarAPI } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
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
    <View style={styles.colorRow}>
      {colors.map((c, i) => (
        <Pressable
          key={i}
          onPress={() => onChange(i)}
          style={[
            styles.colorSwatch,
            { backgroundColor: c },
            c === '#ffffff' && styles.colorSwatchWhiteBorder,
            i === activeIdx && styles.colorSwatchActive,
          ]}
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
      style={[styles.optButton, active && styles.optButtonActive, disabled && styles.optButtonDisabled]}
    >
      <MiniSvg rects={rects} skin={skin} />
    </Pressable>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>{label}</Text>
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
    <View style={styles.container}>
      <View style={styles.previewBox}>
        <View style={styles.previewCircle}>
          <AvatarSVG config={cfg} size={140} />
        </View>
        <View style={styles.previewActions}>
          <Pressable style={styles.diceBtn} onPress={handleRandomize}>
            <Dice5 size={20} color="#fff" />
          </Pressable>
          <Pressable
            style={[styles.saveBtn, saved && styles.saveBtnSaved, saving && { opacity: 0.6 }]}
            onPress={handleSave}
            disabled={saving || saved}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : saved ? (
              <Check size={16} color="#fff" />
            ) : null}
            <Text style={styles.saveBtnText}>{saving ? 'Kaydediliyor...' : saved ? 'Kaydedildi!' : 'Kaydet'}</Text>
          </Pressable>
        </View>
        {!!error && <Text style={styles.errorText}>{error}</Text>}
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={{ paddingBottom: 40 }}>
        <Section label="Arka plan">
          <ColorRow colors={BG_COLORS} activeIdx={cfg.bg} onChange={(v) => set('bg', v)} />
        </Section>

        <Section label="Ten rengi">
          <ColorRow colors={SKIN_COLORS} activeIdx={cfg.skin} onChange={(v) => set('skin', v)} />
        </Section>

        <Section label="Yüz şekli">
          <View style={styles.optGrid}>
            {FACES.map((rects, i) => (
              <OptButton key={i} rects={rects} skin={skin} active={cfg.face === i} onPress={() => set('face', i)} />
            ))}
          </View>
        </Section>

        <Section label="Saç Stili">
          <View style={styles.optGrid}>
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
          <View style={styles.optGrid}>
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
          <View style={styles.optGrid}>
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
          <View style={styles.optGrid}>
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
          <View style={styles.optGrid}>
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
          {!!cfg.jersey && <Text style={styles.hintText}>Forma seçiliyken kıyafet değiştirilemez.</Text>}
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
            <View style={styles.optGrid}>
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
              <Pressable style={styles.removeJerseyBtn} onPress={() => set('jersey', null)}>
                <ShieldOff size={14} color="#6b7280" />
                <Text style={styles.removeJerseyText}>Formayı kaldır</Text>
              </Pressable>
            )}
            <Text style={styles.hintText}>Forma seçiliyken renkler sabittir.</Text>
          </Section>
        )}
      </ScrollView>

      <Pressable style={styles.closeBtn} onPress={onClose}>
        <Text style={styles.closeBtnText}>Kapat</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  previewBox: { alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  previewCircle: {
    width: 150,
    height: 150,
    borderRadius: 30,
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: '#E0D9D9',
  },
  previewActions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  diceBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#2F5755',
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#2F5755',
  },
  saveBtnSaved: { backgroundColor: '#22c55e' },
  saveBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  errorText: { color: '#dc2626', fontSize: 11.5, marginTop: 8, textAlign: 'center', maxWidth: 220 },
  scroll: { flex: 1, paddingHorizontal: 16 },
  section: { marginTop: 16 },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: '#9ca3af', letterSpacing: 0.5, marginBottom: 8, textTransform: 'uppercase' },
  colorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  colorSwatch: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: 'transparent' },
  colorSwatchWhiteBorder: { borderColor: '#d1d5db' },
  colorSwatchActive: { borderColor: '#2F5755', transform: [{ scale: 1.1 }] },
  optGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  optButton: {
    width: 38,
    height: 38,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  optButtonActive: { borderColor: '#2F5755', backgroundColor: '#2F575519' },
  optButtonDisabled: { opacity: 0.3 },
  hintText: { fontSize: 11, color: '#9ca3af', marginTop: 6 },
  removeJerseyBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  removeJerseyText: { fontSize: 12, color: '#6b7280', fontWeight: '600' },
  closeBtn: { alignItems: 'center', paddingVertical: 14, borderTopWidth: 1, borderTopColor: '#f3f4f6' },
  closeBtnText: { fontSize: 14, fontWeight: '700', color: '#374151' },
});
