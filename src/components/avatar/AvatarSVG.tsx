import React from 'react';
import Svg, { Rect as SvgRect, Text as SvgText } from 'react-native-svg';
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
  OUTFIT_PATTERN_COLORS,
  OUTFIT_STYLES,
  SKIN_COLORS,
  darkenHex,
  jerseyBodyRects,
  type AvatarConfig,
} from '../../constants/avatarConfig';

function clamp(idx: number | undefined | null, len: number): number {
  return Math.min(Math.max(idx ?? 0, 0), len - 1);
}

// ⚠️ `React.memo` ZORUNLU, süs değil.
//
// Bu avatar piksel-sanat: aşağıdaki altı dizi (kıyafet, yüz, sakal, saç, kaş,
// göz) map'lenip her parça ayrı bir `<SvgRect>` oluyor — seçilen stillere göre
// tek bir avatar kabaca 30-50 SVG düğümü demek. Android'de react-native-svg
// bunların HER BİRİ için native bir view kuruyor.
//
// Memo olmadan bu bileşen, onu barındıran ağaç her kıpırdadığında baştan
// çiziliyordu. WaveTabBar'da bu, HER SEKME DOKUNUŞUNDA ~40 native SVG
// düğümünün sökülüp yeniden kurulması anlamına geliyordu — testçilerin
// "sayfa geçişlerinde tabbar donuyor" dediği şey buydu. Üstelik aşağıdaki
// stil fonksiyonları (`BEARD_STYLES[i](renk)` gibi) her render'da yeniden
// çağrılıp yeni diziler üretiyor.
//
// Prop'ların üçü de sığ karşılaştırmaya uygun: `config` react-query
// cache'inden geliyor (veri değişmedikçe referansı sabit), `size` ve `showBg`
// ilkel değerler.
export const AvatarSVG = React.memo(function AvatarSVG({
  config,
  size = 40,
  showBg = true,
}: {
  config: Partial<AvatarConfig> | null | undefined;
  size?: number;
  showBg?: boolean;
}) {
  const cfg = { ...DEFAULT_AVATAR_CONFIG, ...(config || {}) };

  const bg = BG_COLORS[clamp(cfg.bg, BG_COLORS.length)];
  const skin = SKIN_COLORS[clamp(cfg.skin, SKIN_COLORS.length)];
  const hc = HAIR_COLORS[clamp(cfg.hairColor, HAIR_COLORS.length)];
  const ec = EYE_COLORS[clamp(cfg.eyeColor, EYE_COLORS.length)];
  const bc = BROW_COLORS[clamp(cfg.browColor ?? cfg.hairColor, BROW_COLORS.length)];
  const bdc = BEARD_COLORS[clamp(cfg.beardColor, BEARD_COLORS.length)];
  const oc = OUTFIT_COLORS[clamp(cfg.outfitColor, OUTFIT_COLORS.length)];
  const oc2 = OUTFIT_PATTERN_COLORS[clamp(cfg.outfitColor2, OUTFIT_PATTERN_COLORS.length)];
  const lc = LIP_COLORS[clamp(cfg.lipColor, LIP_COLORS.length)];
  const ds = darkenHex(skin);

  const jersey = cfg.jersey ? JERSEYS.find((j) => j.id === cfg.jersey) : null;
  const outfitIdx = clamp(cfg.outfit, OUTFIT_STYLES.length);
  const outfitRects = jersey ? jerseyBodyRects(jersey) : OUTFIT_STYLES[outfitIdx] ? OUTFIT_STYLES[outfitIdx](oc, oc2) : [];
  const faceIdx = clamp(cfg.face, FACES.length);
  const hairIdx = clamp(cfg.hair, HAIR_STYLES.length);
  const beardIdx = clamp(cfg.beard, BEARD_STYLES.length);
  const browIdx = clamp(cfg.brow, BROW_STYLES.length);
  const eyeIdx = clamp(cfg.eye ?? 1, EYE_STYLES.length);
  const hairRects = HAIR_STYLES[hairIdx] ?? [];

  return (
    <Svg width={size} height={size} viewBox="0 0 32 40">
      {showBg && <SvgRect x={0} y={0} width={32} height={48} fill={bg} />}

      {outfitIdx === 0 && !jersey && <SvgRect x={9} y={24} width={14} height={12} fill={skin} />}

      {outfitRects.map((r, i) =>
        r.type === 'text' ? (
          <SvgText key={i} x={r.x} y={r.y} fontSize={r.fontSize} textAnchor="middle">
            {r.content}
          </SvgText>
        ) : r.type === 'image' ? null : (
          <SvgRect key={i} x={r.x} y={r.y} width={r.w} height={r.h} rx={r.rx} fill={r.c} />
        )
      )}

      {FACES[faceIdx].map((r, i) => (
        <SvgRect key={i} x={r.x} y={r.y} width={r.w} height={r.h} fill={skin} />
      ))}

      {BEARD_STYLES[beardIdx](bdc).map((r, i) => (
        <SvgRect key={i} x={r.x} y={r.y} width={r.w} height={r.h} fill={r.c} />
      ))}

      {hairRects.map((r, i) => (
        <SvgRect key={i} x={r.x} y={r.y} width={r.w} height={r.h} fill={hc} />
      ))}

      {BROW_STYLES[browIdx](bc).map((r, i) => (
        <SvgRect key={i} x={r.x} y={r.y} width={r.w} height={r.h} fill={r.c || bc} />
      ))}

      {EYE_STYLES[eyeIdx](skin, ec).map((r, i) => (
        <SvgRect key={i} x={r.x} y={r.y} width={r.w} height={r.h} fill={r.c || ec} />
      ))}

      <SvgRect x={15} y={17} width={2} height={1} fill={ds} />
      <SvgRect x={12} y={20} width={2} height={1} fill={lc} />
      <SvgRect x={18} y={20} width={2} height={1} fill={lc} />
      <SvgRect x={14} y={21} width={4} height={1} fill={lc} />
    </Svg>
  );
});

export default AvatarSVG;
