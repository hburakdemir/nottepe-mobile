import React, { useId, useMemo } from 'react';
import Svg, { ClipPath, Defs, Path } from 'react-native-svg';
import type { Style, VectorPath } from './core';
import { vectorPaths } from './core';
import { pixelPaths } from './pixel';
import { toV2 } from './migrateV1';
import { diagMark } from '../lib/diagnostics';

export type Avatar2Mode = Style;

// Çekirdeğin zemin yolu: vectorPaths'in ilk elemanı hep bu (core.ts `art()`).
const BG_PATH = 'M0 0H100V100H0Z';

// Piksel çizimde zemini ayırmanın çekirdekte bir yolu yok: ızgara zemin rengiyle
// dolduruluyor ve aynı renk kıyafette de çıkabiliyor (OUTC[1] === BG[0]), yani
// "fill === cfg.bg olanı atla" o kıyafeti de siler. O yüzden showBg=false'ta
// zemin, hiçbir palette olmayan bu renkle çiziliyor ve o renkteki yol atlanıyor.
// Kenar konturu zemine göre hesaplandığı için çıktı zeminli çizimle aynı;
// yalnızca zeminin üstüne yarı saydam binen katmanlar (çok az) koyu tona karışıyor.
const PX_BG_SENTINEL = '#010203';

type Drawing = { mode: 'piksel'; paths: { fill: string; d: string }[] } | { mode: 'normal'; paths: VectorPath[] };

// Çizim (yol listesi) config + görünüm + zemin başına bir kez hesaplanıyor: akışta
// aynı yazarın onlarca kartı var ve kart pencereden çıkıp girdikçe yeniden
// mount oluyor; memo bunu kurtarmıyor, önbellek kurtarıyor. Anahtar JSON çünkü
// config'ler react-query cache'inden geliyor ve aynı içerik farklı nesne olabilir.
// Web'deki AvatarBuilder.jsx `drawingFor` ile aynı desen.
const cache = new Map<string, Drawing>();
function drawingFor(config: unknown, modeProp: Style | undefined, showBg: boolean): Drawing {
  const key = `${modeProp ?? ''}|${showBg ? 1 : 0}|${JSON.stringify(config ?? null)}`;
  let hit = cache.get(key);
  if (!hit) {
    const cfg = toV2(config).config;
    const mode = modeProp ?? cfg.style;
    if (mode === 'piksel') {
      const input = showBg ? cfg : { ...cfg, bg: PX_BG_SENTINEL };
      hit = { mode, paths: pixelPaths(input).filter((p) => showBg || p.fill !== PX_BG_SENTINEL) };
    } else {
      const { paths } = vectorPaths(cfg);
      hit = { mode: 'normal', paths: !showBg && paths[0]?.d === BG_PATH ? paths.slice(1) : paths };
    }
    if (cache.size > 600) cache.clear();
    cache.set(key, hit);
  }
  return hit;
}

// ⚠️ `React.memo` ZORUNLU — gerekçesi eski AvatarSVG'deki gibi: WaveTabBar'da
// memo'suz bir avatar her sekme dokunuşunda bütün SVG düğümlerini söküp yeniden
// kuruyordu ("sayfa geçişlerinde tabbar donuyor"). Bu çizim eskisinden ağır:
// Normal ortalama ~42 / en kötü 57, Piksel ~29 / 48 düğüm (eski paketli avatar
// ortalama 6,8 / en kötü 13).
//
// Normal çizimde yollar BİRLEŞTİRİLMİYOR (vectorPaths'in `nodes` sayısı
// birleştirilmiş tahmin): üst üste binen iki alt yol ters yönde çizilmişse
// nonzero dolguda delik açar, yarı saydamlarda da çakışan bölge tek kat boyanır.
// Aynı kırpma yolu bir örnekte bir kez tanımlanıyor (göz akı iris ve bebeği
// birlikte kırpıyor).
//
// `config` sunucudan geldiği gibi: v1, v2 ya da null — toV2 okurken çeviriyor.
// `mode` verilmezse avatarın sahibinin seçtiği görünüm (config.style) kullanılır;
// oluşturucudaki önizlemeler onu geçersiz kılmak için veriyor.
export const Avatar2SVG = React.memo(function Avatar2SVG({
  config,
  mode,
  size = 40,
  showBg = true,
}: {
  config: unknown;
  mode?: Avatar2Mode;
  size?: number;
  showBg?: boolean;
}) {
  // GEÇİCİ ölçüm sayacı — teşhis aracıyla birlikte silinecek (bkz. diagnostics.ts).
  diagMark('AvatarSVG');
  // Kırpma kimlikleri her örnekte benzersiz olmalı; react-native-svg kimlikleri
  // bütün ağaçta paylaşıyor. useId'nin ':' gibi karakterleri url(#…) içinde
  // sorun çıkarmasın diye ayıklanıyor.
  const uid = 'a2' + useId().replace(/[^A-Za-z0-9]/g, '');
  const drawing = useMemo(() => drawingFor(config, mode, showBg), [config, mode, showBg]);

  const body = useMemo(() => {
    if (drawing.mode === 'piksel') {
      return drawing.paths.map((p, i) => <Path key={i} d={p.d} fill={p.fill} />);
    }
    const clipIds = new Map<string, string>();
    const defs: React.ReactElement[] = [];
    const out = drawing.paths.map((p, i) => {
      let clipPath: string | undefined;
      if (p.clip) {
        let id = clipIds.get(p.clip);
        if (!id) {
          id = `${uid}c${clipIds.size}`;
          clipIds.set(p.clip, id);
          defs.push(
            <ClipPath key={id} id={id}>
              <Path d={p.clip} />
            </ClipPath>
          );
        }
        clipPath = `url(#${id})`;
      }
      return p.fill ? (
        <Path key={i} d={p.d} fill={p.fill} opacity={p.op} clipPath={clipPath} />
      ) : (
        <Path
          key={i}
          d={p.d}
          fill="none"
          stroke={p.stroke}
          strokeWidth={p.w}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={p.op}
          clipPath={clipPath}
        />
      );
    });
    return (
      <>
        {defs.length > 0 && <Defs>{defs}</Defs>}
        {out}
      </>
    );
  }, [drawing, uid]);

  // Web'deki shape-rendering="crispEdges" react-native-svg'de yok (15.12'de
  // prop'u bile tanımlı değil); eski piksel avatar da onsuz çiziliyordu.
  return (
    <Svg width={size} height={size} viewBox={drawing.mode === 'piksel' ? '0 0 48 48' : '0 0 100 100'}>
      {body}
    </Svg>
  );
});

export default Avatar2SVG;
