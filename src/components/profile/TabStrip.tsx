import React, { useCallback, useEffect, useRef } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { SHADOW_MD, type TabDef, type TabKey } from './profileCommon';

/** Sekme başına sayaç. Bir anahtar `null` ise "veri henüz gelmedi" demek ve
 *  sayaç çizilmiyor — aksi hâlde açılışta hepsi yanıltıcı "(0)" görünürdü. */
export type TabCounts = Partial<Record<TabKey, number | null>>;

// Profil'in yatay sekme şeridi — sayaçlar ve aktif sekmeyi ortalama mantığı.
//
// SAYAÇLAR ARTIK PROP: eskiden dört liste hook'u (`useMyChecklists` vd.) bu
// bileşenin İÇİNDE çağrılıyordu, yani şerit yapısal olarak yalnızca oturum
// sahibinin sayaçlarını gösterebiliyordu. Sayım artık `useProfileCounts` ile
// şablonda (bkz. ProfileTemplate.tsx) ve "sekme sayaçları tıklamadan dolmalı"
// değişmezi korunuyor: o hook AYNI react-query anahtarlarını okuyor, yani
// sekmeye basıldığında ikinci bir ağ isteği atılmıyor.
//
// AKTİF RENK DAİMA MARKA. Herkese açık profilin şeridi eskiden lacivert
// (`#1e40af` alt çizgi, `#60a5fa`/`#1e3a8a` ikon, `text-info` metin)
// kullanıyordu — testçi şikâyetinin ("tablardaki renkler kendi profilini
// görüntülediğin gibi olmalı") somut karşılığı buydu. O üç değer kod tabanından
// tamamen silindi; tek şerit, tek palet.
//
// ÇAĞIRAN TARAF `tabs` VE `counts` NESNELERİNİ STABİL TUTMAK ZORUNDA (`tabs`
// için `makeTabs`/`visibleTabs` + `useMemo`, `counts` için `useMemo`), yoksa
// `React.memo` hiçbir zaman bail-out yapamaz.
function TabStrip({
  tabs,
  activeTab,
  counts,
  onTabPress,
  onHeightChange,
}: {
  tabs: readonly TabDef[];
  activeTab: TabKey;
  /** `undefined` → hiç sayaç çizilmiyor (herkese açık profilde sayaç yok). */
  counts?: TabCounts;
  onTabPress: (index: number) => void;
  onHeightChange: (height: number) => void;
}) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  // --- Şeridi aktif sekmeye ortalama --------------------------------------
  // Eskiden şeridin ne `ref`'i ne `onLayout`'u ne de bir `scrollTo` çağrısı
  // vardı — sekmeler hiçbir zaman ortalanmıyordu, 5-7. sekmeler ekran dışında
  // kalıyordu ("tablar asla olması gereken yerde ortada render olmuyor").
  const stripRef = useRef<ScrollView>(null);
  const stripWidthRef = useRef(0);
  const stripContentWidthRef = useRef(0);
  const tabLayoutsRef = useRef<Partial<Record<TabKey, { x: number; width: number }>>>({});

  const centerStripOn = useCallback((key: TabKey) => {
    const item = tabLayoutsRef.current[key];
    const stripWidth = stripWidthRef.current;
    if (!item || stripWidth <= 0) return;
    const maxScroll = Math.max(0, stripContentWidthRef.current - stripWidth);
    const target = Math.min(Math.max(item.x + item.width / 2 - stripWidth / 2, 0), maxScroll);
    stripRef.current?.scrollTo({ x: target, animated: true });
  }, []);

  useEffect(() => {
    centerStripOn(activeTab);
  }, [activeTab, centerStripOn]);

  return (
    // Şerit bilinçli olarak kendi kutusunda: altında ince bir çizgi ve gölge
    // var ki profil kartından ayrı, kendi başına bir yapı olduğu görünsün
    // (kullanıcı isteği).
    <View
      onLayout={(e) => onHeightChange(e.nativeEvent.layout.height)}
      className="bg-surface rounded-lg mx-4 mb-5 border-b border-line-soft"
      style={SHADOW_MD}
    >
      <ScrollView
        ref={stripRef}
        showsVerticalScrollIndicator={false}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerClassName="px-3"
        onLayout={(e) => {
          stripWidthRef.current = e.nativeEvent.layout.width;
          centerStripOn(activeTab);
        }}
        onContentSizeChange={(w) => {
          stripContentWidthRef.current = w;
        }}
      >
        {tabs.map(({ key, label, icon: Icon }, index) => {
          const count = counts?.[key] ?? null;
          const active = activeTab === key;
          return (
            <Pressable
              key={key}
              className={`flex-row items-center gap-[5px] py-3 mr-[18px] border-b-2 ${active ? 'border-b-brand' : 'border-b-transparent'}`}
              onPress={() => onTabPress(index)}
              onLayout={(e) => {
                tabLayoutsRef.current[key] = { x: e.nativeEvent.layout.x, width: e.nativeEvent.layout.width };
                if (active) centerStripOn(key);
              }}
            >
              {/* lucide ikonu ham renk alıyor (className değil) — marka rengi
                  temadan bağımsız, pasif gri de öyle. */}
              <Icon size={14} color={active ? (isDark ? '#5A9690' : '#2F5755') : '#9ca3af'} />
              <Text className={`text-[12.5px] font-semibold ${active ? 'text-accent' : 'text-muted2'}`}>
                {label}
                {count !== null ? ` (${count})` : ''}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

export default React.memo(TabStrip);
