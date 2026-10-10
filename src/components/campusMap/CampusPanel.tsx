import React, { useEffect, useMemo, useState } from 'react';
import { Linking, Pressable, Text, TextInput, View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import Animated, { useAnimatedStyle, useSharedValue, withTiming, Easing, FadeInDown } from 'react-native-reanimated';
import { ChevronLeft, ExternalLink, Search, X } from 'lucide-react-native';
import { useTheme, useThemeColors } from '../../context/ThemeContext';
import { tap } from '../../lib/haptics';
import { fmtDistance, turkishLower, type CampusData, type CampusPoi, type CampusRoute } from './campusMapData';

// Web'deki components/campusMap/CampusPanel.jsx'in portu.

const BRAND = { light: '#2F5755', dark: '#5A9690' };
const WALK = { light: '#B45309', dark: '#FB923C' };

export function Segmented({
  options,
  value,
  onChange,
  small,
}: {
  options: readonly { id: string; label: string }[];
  value: string;
  onChange: (id: string) => void;
  small?: boolean;
}) {
  const [w, setW] = useState(0);
  const idx = Math.max(0, options.findIndex((o) => o.id === value));
  const segW = w > 0 ? (w - 6) / options.length : 0;
  const x = useSharedValue(0);
  useEffect(() => {
    x.value = withTiming(idx * segW, { duration: 380, easing: Easing.bezier(0.3, 0.9, 0.35, 1.08) });
  }, [idx, segW, x]);
  const thumb = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  const h = small ? 32 : 36;
  return (
    <View className="flex-row p-[3px] rounded-[10px] bg-inset" onLayout={(e) => setW(e.nativeEvent.layout.width)}>
      {segW > 0 && (
        <Animated.View
          className="absolute bg-surface rounded-lg"
          style={[{ top: 3, left: 3, height: h, width: segW, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 2, shadowOffset: { width: 0, height: 1 }, elevation: 1 }, thumb]}
        />
      )}
      {options.map((o) => {
        const on = o.id === value;
        return (
          <Pressable
            key={o.id}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            onPress={() => {
              if (on) return;
              tap();
              onChange(o.id);
            }}
            className="flex-1 items-center justify-center px-2 rounded-lg"
            style={{ height: h }}
          >
            <Text numberOfLines={1} className={`text-[13px] ${on ? 'font-semibold text-ink' : 'font-medium text-muted'}`}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const CARD = 'bg-surface border border-line rounded-2xl p-4';

export function PlaceCard({ poi, campusName, onRoute, onClose }: { poi: CampusPoi; campusName: string; onRoute: () => void; onClose: () => void }) {
  const { theme } = useTheme();
  const colors = useThemeColors();
  const isDark = theme === 'dark';
  const gmaps = `https://www.google.com/maps/dir/?api=1&destination=${poi.lat},${poi.lon}&travelmode=walking`;
  return (
    <Animated.View entering={FadeInDown.duration(380)} className={`${CARD} gap-3`}>
      <View className="flex-row items-start gap-3">
        <View className="flex-1 gap-1">
          <Text className="text-[11px] font-bold uppercase" style={{ letterSpacing: 0.9, color: BRAND[isDark ? 'dark' : 'light'] }}>
            {poi.cat}
          </Text>
          <Text className="text-lg font-bold text-ink leading-6">{poi.name}</Text>
          <Text className="text-[13px] text-muted">{campusName}</Text>
        </View>
        <Pressable accessibilityLabel="Kapat" onPress={onClose} hitSlop={8} className="-mt-1 -mr-1 w-9 h-9 items-center justify-center rounded-lg">
          <X size={20} color={colors.muted} />
        </Pressable>
      </View>
      <View className="flex-row gap-2">
        <Pressable
          onPress={onRoute}
          className="flex-1 h-10 rounded-[10px] items-center justify-center"
          style={{ backgroundColor: BRAND[isDark ? 'dark' : 'light'] }}
        >
          <Text className="text-sm font-semibold" style={{ color: isDark ? '#11161C' : '#fff' }}>
            Nasıl giderim?
          </Text>
        </Pressable>
        <Pressable onPress={() => Linking.openURL(gmaps)} className="h-10 px-3 rounded-[10px] flex-row items-center gap-1.5 bg-inset">
          <Text className="text-sm text-ink">Google Haritalar</Text>
          <ExternalLink size={14} color={colors.ink} />
        </Pressable>
      </View>
    </Animated.View>
  );
}

interface Step {
  icon: 'rail' | 'stop' | 'dest';
  title: string;
  sub: string;
  conn: 'bus' | 'walk' | null;
}

function stepsOf(route: CampusRoute): Step[] {
  const steps: Step[] = [];
  route.legs.forEach((leg, i) => {
    const icon = leg.from.rail ? 'rail' : 'stop';
    if (leg.kind === 'bus') {
      steps.push({ icon, title: leg.from.name, sub: `${leg.line} ile ${fmtDistance(leg.m)} · ~${leg.min} dk`, conn: 'bus' });
    } else {
      const title = i > 0 ? `${leg.from.name} durağında in` : leg.from.rail ? leg.from.name : `${leg.from.name} durağı`;
      steps.push({ icon, title, sub: `${fmtDistance(leg.m)} yürü · ~${leg.min} dk`, conn: 'walk' });
    }
  });
  steps.push({ icon: 'dest', title: route.legs[route.legs.length - 1].to.name, sub: 'Varış', conn: null });
  return steps;
}

function StepIcon({ kind, color }: { kind: Step['icon']; color: string }) {
  if (kind === 'rail') return <Text style={{ fontSize: 13, fontWeight: '700', color }}>M</Text>;
  if (kind === 'stop')
    return (
      <Svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
        <Rect x="5" y="3" width="14" height="14" rx="2" />
        <Path d="M5 10h14M8 21v-4M16 21v-4" />
      </Svg>
    );
  return (
    <Svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M12 21s-6-5.3-6-10a6 6 0 0 1 12 0c0 4.7-6 10-6 10z" />
      <Circle cx="12" cy="11" r="2" />
    </Svg>
  );
}

export function RouteCard({
  poi,
  data,
  option,
  onOption,
  onBack,
}: {
  poi: CampusPoi;
  data: CampusData;
  option: string;
  onOption: (id: string) => void;
  onBack: () => void;
}) {
  const { theme } = useTheme();
  const colors = useThemeColors();
  const mode = theme === 'dark' ? 'dark' : 'light';
  const route = data.routes[poi.id]?.[option];
  const steps = useMemo(() => (route ? stepsOf(route) : []), [route]);
  if (!route) return null;
  const onIcon = mode === 'dark' ? '#11161C' : '#fff';
  const iconBg = { rail: mode === 'dark' ? '#DFD0B8' : '#111827', stop: BRAND[mode], dest: WALK[mode] };
  return (
    <Animated.View entering={FadeInDown.duration(380)} className={`${CARD} gap-3`}>
      <View className="flex-row items-start gap-2">
        <Pressable accessibilityLabel="Yer kartına dön" onPress={onBack} hitSlop={6} className="-ml-2 w-9 h-9 items-center justify-center rounded-lg">
          <ChevronLeft size={20} color={colors.ink} />
        </Pressable>
        <View className="flex-1">
          <Text className="text-xs text-muted">Nasıl giderim?</Text>
          <Text className="text-[17px] font-bold text-ink leading-6">{poi.name}</Text>
        </View>
        <View className="items-end">
          <Text className="text-2xl font-bold" style={{ color: BRAND[mode], lineHeight: 26 }}>
            ~{route.min} dk
          </Text>
          <Text className="mt-1 text-xs text-muted">{fmtDistance(route.m)}</Text>
        </View>
      </View>
      <Segmented options={data.transit.options} value={option} onChange={onOption} small />
      <View key={option}>
        {steps.map((st, i) => (
          <Animated.View key={i} entering={FadeInDown.delay(80 + i * 70).duration(320)} className="flex-row gap-3" style={{ minHeight: 48 }}>
            <View className="items-center" style={{ width: 26 }}>
              <View className="items-center justify-center rounded-[7px]" style={{ width: 26, height: 26, backgroundColor: iconBg[st.icon] }}>
                <StepIcon kind={st.icon} color={onIcon} />
              </View>
              {st.conn === 'bus' && <View className="flex-1 rounded" style={{ width: 4, marginVertical: 3, backgroundColor: BRAND[mode] }} />}
              {st.conn === 'walk' && (
                <View className="flex-1" style={{ marginVertical: 4, borderLeftWidth: 3, borderStyle: 'dotted', borderColor: WALK[mode] }} />
              )}
            </View>
            <View className="flex-1 pt-[3px] pb-2.5">
              <Text className="text-sm font-semibold text-ink">{st.title}</Text>
              <Text className="text-xs text-muted">{st.sub}</Text>
            </View>
          </Animated.View>
        ))}
      </View>
      <Text className="text-[11px] leading-4 text-muted">
        Süreler yaklaşık ve bekleme hariç: yürüme 75 m/dk
        {data.transit.line ? `, ${data.transit.line.ref} hattı EGO'nun ${data.transit.line.tripMin} dk'lık sefer süresinden` : ''}.
      </Text>
    </Animated.View>
  );
}

export function PoiList({
  data,
  query,
  onQuery,
  category,
  onCategory,
  selectedId,
  onPick,
}: {
  data: CampusData;
  query: string;
  onQuery: (q: string) => void;
  category: string;
  onCategory: (c: string) => void;
  selectedId: string | null;
  onPick: (id: string) => void;
}) {
  const { theme } = useTheme();
  const colors = useThemeColors();
  const mode = theme === 'dark' ? 'dark' : 'light';
  const cats = useMemo(() => [{ id: '', label: 'Tümü' }, ...data.categories.map((k) => ({ id: k, label: k }))], [data]);
  const items = useMemo(() => {
    const q = turkishLower(query.trim());
    return data.pois.filter((p) => (q ? turkishLower(p.name).includes(q) || turkishLower(p.short ?? '').includes(q) : !category || p.cat === category));
  }, [data, query, category]);
  return (
    <View className="bg-surface border border-line rounded-2xl">
      <View className="p-4 pb-2.5 gap-3">
        <View className="flex-row items-center gap-2 px-3 rounded-[10px] bg-inset border border-line" style={{ height: 42 }}>
          <Search size={18} color={BRAND[mode]} />
          <TextInput
            value={query}
            onChangeText={onQuery}
            placeholder="Fakülte, yurt, yemekhane…"
            placeholderTextColor={colors.muted}
            className="flex-1 text-sm text-ink"
            style={{ paddingVertical: 0 }}
            returnKeyType="search"
            autoCorrect={false}
          />
          {!!query && (
            <Pressable accessibilityLabel="Aramayı temizle" onPress={() => onQuery('')} hitSlop={8}>
              <X size={16} color={colors.muted} />
            </Pressable>
          )}
        </View>
        {!query && (
          <View className="flex-row flex-wrap gap-1.5">
            {cats.map((cat) => {
              const on = cat.id === category;
              return (
                <Pressable
                  key={cat.label}
                  onPress={() => onCategory(cat.id)}
                  className={`px-3 rounded-full justify-center border ${on ? '' : 'border-line'}`}
                  style={[{ height: 30 }, on && { backgroundColor: BRAND[mode], borderColor: BRAND[mode] }]}
                >
                  <Text className={`text-[13px] ${on ? '' : 'text-muted'}`} style={on ? { color: mode === 'dark' ? '#11161C' : '#fff' } : undefined}>
                    {cat.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}
      </View>
      <View className="px-2 pb-3">
        {items.map((p) => {
          const on = p.id === selectedId;
          return (
            <Pressable
              key={p.id}
              onPress={() => onPick(p.id)}
              className="px-2.5 rounded-[10px] flex-row items-center gap-3"
              style={[{ minHeight: 48 }, on && { backgroundColor: mode === 'dark' ? 'rgba(90,150,144,0.18)' : 'rgba(47,87,85,0.08)' }]}
            >
              <View className="rounded-full" style={{ width: 8, height: 8, backgroundColor: on ? BRAND[mode] : mode === 'dark' ? '#C9BBA4' : '#374151' }} />
              <Text className="flex-1 text-sm font-medium text-ink">{p.name}</Text>
              <Text className="text-xs text-muted">{p.cat}</Text>
            </Pressable>
          );
        })}
        {!items.length && <Text className="px-3 py-6 text-sm text-center text-muted">Bu aramayla eşleşen yer yok.</Text>}
      </View>
    </View>
  );
}
