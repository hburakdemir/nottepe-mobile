import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BackHandler, ScrollView, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useReducedMotion } from 'react-native-reanimated';
import { useTheme } from '../../context/ThemeContext';
import { KeyboardAwareScroll } from '../../components/layout/KeyboardAvoider';
import { useSetAppShellChromeHidden } from '../../components/layout/AppShell';
import { TAB_BAR_SAFE_PADDING } from '../../components/layout/tabBarMetrics';
import VectorCampusMap from '../../components/campusMap/VectorCampusMap';
import { PlaceCard, PoiList, RouteCard, Segmented } from '../../components/campusMap/CampusPanel';
import { CAMPUSES, MAP_PALETTE, loadCampus, type CampusKey } from '../../components/campusMap/campusMapData';

// Kampüs haritası — web'deki /kampus-haritasi (CampusMapPage.jsx). Şimdilik
// yalnızca Çizim modu; web'in Sokak modu MapLibre ile, mobilde yok.
//
// Düzen telefona göre: harita üstte sabit (kaydırılan sayfanın içinde olsa
// harita jestleri dikey kaydırmayla çakışırdı), kart ve yer listesi altta.
// Tam ekranda kabuğun üst barı ve sekme çubuğu gizleniyor, harita tüm ekranı
// alıyor ve kart haritanın altında yüzüyor (web'in masaüstü düzeni gibi).
// Ekran yeniden mount edilmediği için kamera ve seçim korunuyor.

export default function CampusMapScreen() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const reducedMotion = useReducedMotion();
  const { height } = useWindowDimensions();
  const scrollRef = useRef<React.ElementRef<typeof KeyboardAwareScroll>>(null);

  const [campus, setCampus] = useState<CampusKey>('beytepe');
  const data = useMemo(() => loadCampus(campus), [campus]);
  const [selId, setSelId] = useState<string | null>(null);
  const [routeOn, setRouteOn] = useState(false);
  const [option, setOption] = useState<string | null>(null);
  const [category, setCategory] = useState('');
  const [query, setQuery] = useState('');
  const [fullscreen, setFullscreen] = useState(false);
  const [overlayH, setOverlayH] = useState(0);
  const setChromeHidden = useSetAppShellChromeHidden();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    setChromeHidden?.(fullscreen);
  }, [fullscreen, setChromeHidden]);
  // Tam ekrandayken geri jestiyle ekrandan çıkılırsa kabuk gizli kalmasın.
  useEffect(() => () => setChromeHidden?.(false), [setChromeHidden]);
  // Android geri tuşu önce tam ekrandan çıkarıyor.
  useEffect(() => {
    if (!fullscreen) return undefined;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      setFullscreen(false);
      return true;
    });
    return () => sub.remove();
  }, [fullscreen]);

  useEffect(() => {
    setSelId(null);
    setRouteOn(false);
    setOption(null);
    setCategory('');
    setQuery('');
  }, [campus]);

  const opt = option && data.transit.options.some((o) => o.id === option) ? option : (data.transit.options[0]?.id ?? '');
  const selected = selId ? (data.pois.find((p) => p.id === selId) ?? null) : null;
  const route = routeOn && selected ? (data.routes[selected.id]?.[opt] ?? null) : null;
  // Rota kapalıyken de seçenek dolu olduğu için anahtar rota durumunu
  // taşımalı; yoksa "Nasıl giderim?"e basınca değişmiyor, animasyon başlamıyor.
  const routeKey = route ? `${campus}:${selId}:${opt}` : 'kapali';

  const pick = useCallback((id: string | null) => {
    setSelId(id);
    setRouteOn(false);
  }, []);
  const pickFromList = (id: string) => {
    pick(id);
    // Kart listenin üstünde; seçimi görsün diye başa kaydır.
    scrollRef.current?.scrollTo({ y: 0, animated: !reducedMotion });
  };

  const card = selected
    ? routeOn
      ? <RouteCard poi={selected} data={data} option={opt} onOption={setOption} onBack={() => setRouteOn(false)} />
      : <PlaceCard poi={selected} campusName={data.name} onRoute={() => setRouteOn(true)} onClose={() => pick(null)} />
    : null;
  // Tam ekranda gizlenen parçalar mount'lu kalıyor (arama metni, liste
  // kaydırması kaybolmasın) — yalnızca düzenden çıkıyorlar.
  const hiddenInFullscreen = fullscreen ? { display: 'none' as const } : undefined;

  return (
    <View className="flex-1 bg-ground">
      <View className="px-4 pt-3 pb-3" style={hiddenInFullscreen}>
        <Segmented options={CAMPUSES} value={campus} onChange={(id) => setCampus(id as CampusKey)} />
      </View>
      <View
        className={fullscreen ? 'overflow-hidden' : 'mx-4 rounded-2xl overflow-hidden border border-line'}
        style={fullscreen ? { flex: 1 } : { height: Math.round(height * 0.46) }}
      >
        <VectorCampusMap
          key={campus}
          data={data}
          palette={MAP_PALETTE[isDark ? 'dark' : 'light']}
          selectedId={selId}
          onSelect={pick}
          category={category}
          route={route}
          routeKey={routeKey}
          reducedMotion={reducedMotion}
          fullscreen={fullscreen}
          onToggleFullscreen={() => setFullscreen((v) => !v)}
          safeTop={fullscreen ? insets.top : 0}
          safeBottom={fullscreen ? insets.bottom : 0}
          bottomObstruction={fullscreen && card ? insets.bottom + 30 + overlayH : 0}
        />
        {fullscreen && !!card && (
          // Altta atıf satırına yer bırakılıyor (ODbL atfı görünür kalmalı).
          // "Nasıl giderim?" de burada açılıyor — tam ekrandan çıkılmıyor.
          <View
            onLayout={(e) => setOverlayH(Math.round(e.nativeEvent.layout.height))}
            style={{ position: 'absolute', left: 12, right: 12, bottom: insets.bottom + 30, maxHeight: '50%' }}
          >
            <ScrollView bounces={false} showsVerticalScrollIndicator={false}>
              {card}
            </ScrollView>
          </View>
        )}
      </View>
      <KeyboardAwareScroll
        ref={scrollRef}
        className="flex-1"
        style={hiddenInFullscreen}
        contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: TAB_BAR_SAFE_PADDING }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {!fullscreen && card}
        <PoiList
          data={data}
          query={query}
          onQuery={setQuery}
          category={category}
          onCategory={setCategory}
          selectedId={selId}
          onPick={pickFromList}
        />
      </KeyboardAwareScroll>
    </View>
  );
}
