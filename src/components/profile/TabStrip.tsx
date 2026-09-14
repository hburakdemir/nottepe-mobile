import React, { useCallback, useEffect, useRef } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { useMyAktsCalcs, useMyChecklists, useMyFollows, useMySchedule } from '../../hooks/profile/useProfileLists';
import { SHADOW_MD, TABS, type TabKey } from './profileCommon';

// Profil'in yatay sekme şeridi — sayaçlar ve aktif sekmeyi ortalama mantığı.
//
// SAYAÇLAR NEDEN BURADA ÇEKİLİYOR: "sekme sayaçları tıklamadan dolmalı" daha
// önce bildirilmiş bir kullanıcı şikayeti; tembel yükleme tam bu yüzden bilerek
// geri alınmıştı. Veri sekme bileşenlerinin kendi state'ine indirilseydi şerit
// sayacı bilemezdi. react-query ile ikisi AYNI anahtarı okuyor: şerit sayaç
// için, sekme liste için, ve ikinci bir ağ isteği atılmıyor.
//
// Dört liste burada, iki gönderi sekmesi prop olarak: onların sayacı sunucunun
// söylediği TOPLAM ("ekranda kaç satır var" değil) ve o durum makinesi
// ProfileScreen'de yaşıyor.
function TabStrip({
  activeTab,
  postsCount,
  savedCount,
  onTabPress,
  onHeightChange,
}: {
  activeTab: TabKey;
  postsCount: number;
  savedCount: number;
  onTabPress: (index: number) => void;
  onHeightChange: (height: number) => void;
}) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const { data: checklists } = useMyChecklists();
  const { data: aktsCalcs } = useMyAktsCalcs();
  const { data: schedule } = useMySchedule();
  const { data: follows } = useMyFollows();

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
        {TABS.map(({ key, label, icon: Icon }, index) => {
          // Sayaç ancak veri geldiğinde gösteriliyor; aksi hâlde açılışta hepsi
          // yanıltıcı "(0)" görünürdü.
          const count =
            key === 'posts'
              ? postsCount
              : key === 'saved'
                ? savedCount
                : key === 'lists'
                  ? (checklists?.length ?? null)
                  : key === 'akts'
                    ? (aktsCalcs?.length ?? null)
                    : key === 'schedule'
                      ? (schedule?.length ?? null)
                      : key === 'follows'
                        ? (follows?.length ?? null)
                        : null;
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
