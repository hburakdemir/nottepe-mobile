import React from 'react';
import Svg, { Path as SvgPath, Rect as SvgRect, Text as SvgText } from 'react-native-svg';
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
import { pack, type Entry } from './avatarPack';
import { diagMark } from '../../lib/diagnostics';

function clamp(idx: number | undefined | null, len: number): number {
  return Math.min(Math.max(idx ?? 0, 0), len - 1);
}

// Düğüm paketlemesi (ardışık aynı renkleri tek `<Path>`'e toplama) ve NEDEN
// yalnızca ardışık olanların birleştiği: bkz. avatarPack.ts.

// ⚠️ `React.memo` ZORUNLU, süs değil.
//
// Bu avatar piksel-sanat: aşağıdaki altı dizi (kıyafet, yüz, sakal, saç, kaş,
// göz) map'lenip parçalar SVG düğümüne dönüyor ve Android'de react-native-svg
// düğüm başına native bir view kuruyor. Düğüm sayısı artık `pack` ile ardışık
// aynı renkler birleştirilerek düşürülüyor (bkz. avatarPack.ts): ölçülen
// ortalama 24,5 → 6,8, en kötü 51 → 13 düğüm.
//
// Memo olmadan bu bileşen, onu barındıran ağaç her kıpırdadığında baştan
// çiziliyordu. WaveTabBar'da bu, HER SEKME DOKUNUŞUNDA bütün SVG düğümlerinin
// sökülüp yeniden kurulması anlamına geliyordu — testçilerin "sayfa
// geçişlerinde tabbar donuyor" dediği şey buydu. Üstelik aşağıdaki stil
// fonksiyonları (`BEARD_STYLES[i](renk)` gibi) her render'da yeniden çağrılıp
// yeni diziler üretiyor.
//
// Memo mount maliyetini DÜŞÜRMÜYOR, yalnızca yeniden render'ı önlüyor: liste
// kaydırmasında kart pencereden çıkınca unmount olduğu için avatar sıfırdan
// kuruluyor. Mount maliyetini düşüren şey yukarıdaki paketleme.
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
  // GEÇİCİ ölçüm sayacı — teşhis aracıyla birlikte silinecek (bkz. diagnostics.ts).
  diagMark('AvatarSVG');
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

  // BELGE SIRASI KORUNMAK ZORUNDA: zemin → gövde → kıyafet → yüz → sakal → saç
  // → kaş → göz → burun/dudak. Katman sırası anlam taşıyor (saç yüzün üstüne,
  // göz yüzün üstüne biniyor), o yüzden liste tam bu sırayla kuruluyor; `pack`
  // yalnızca ARDIŞIK aynı renkleri birleştirdiği için sıra hiç değişmiyor.
  //
  // Dolgu ifadeleri eski JSX'ten BİREBİR taşındı — sakal ve kıyafet `r.c`
  // (tanımsızsa SVG varsayılanı siyah), kaş `r.c || bc`, göz `r.c || ec`, yüz
  // `skin`, saç `hc`. Buradaki tek değişiklik düğümlerin nasıl basıldığı.
  const entries: Entry[] = [];

  if (showBg) entries.push({ t: 'fill', fill: bg, r: { x: 0, y: 0, w: 32, h: 48 } });

  if (outfitIdx === 0 && !jersey) {
    entries.push({ t: 'fill', fill: skin, r: { x: 9, y: 24, w: 14, h: 12 } });
  }

  for (const r of outfitRects) {
    if (r.type === 'text') entries.push({ t: 'text', r });
    else if (r.type === 'image') continue;
    else entries.push({ t: 'fill', fill: r.c, r });
  }

  for (const r of FACES[faceIdx]) entries.push({ t: 'fill', fill: skin, r });
  for (const r of BEARD_STYLES[beardIdx](bdc)) entries.push({ t: 'fill', fill: r.c, r });
  for (const r of hairRects) entries.push({ t: 'fill', fill: hc, r });
  for (const r of BROW_STYLES[browIdx](bc)) entries.push({ t: 'fill', fill: r.c || bc, r });
  for (const r of EYE_STYLES[eyeIdx](skin, ec)) entries.push({ t: 'fill', fill: r.c || ec, r });

  entries.push({ t: 'fill', fill: ds, r: { x: 15, y: 17, w: 2, h: 1 } });
  entries.push({ t: 'fill', fill: lc, r: { x: 12, y: 20, w: 2, h: 1 } });
  entries.push({ t: 'fill', fill: lc, r: { x: 18, y: 20, w: 2, h: 1 } });
  entries.push({ t: 'fill', fill: lc, r: { x: 14, y: 21, w: 4, h: 1 } });

  return (
    <Svg width={size} height={size} viewBox="0 0 32 40">
      {pack(entries).map((p, i) =>
        p.t === 'path' ? (
          <SvgPath key={i} d={p.d} fill={p.fill} />
        ) : p.t === 'rect' ? (
          <SvgRect key={i} x={p.r.x} y={p.r.y} width={p.r.w} height={p.r.h} rx={p.r.rx} fill={p.fill} />
        ) : (
          <SvgText key={i} x={p.r.x} y={p.r.y} fontSize={p.r.fontSize} textAnchor="middle">
            {p.r.content}
          </SvgText>
        )
      )}
    </Svg>
  );
});

export default AvatarSVG;
