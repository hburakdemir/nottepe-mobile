import React, { useCallback, useEffect, useRef, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, View } from 'react-native';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import FileSlide from '../../components/fileviewer/FileSlide';
import FileViewerHeader from '../../components/fileviewer/FileViewerHeader';
import { VIEWER_BG } from '../../components/fileviewer/viewerTokens';
import { useShareFile } from '../../hooks/useShareFile';
import { trimFileCache } from '../../lib/fileCache';
import { useDrawerSwipeEnabled } from '../../navigation/drawerConstants';
import type { RootStackParamList } from '../../navigation/types';
import { fileExtension } from '../../theme/feedTokens';

// ═══════════════════════════════════════════════════════════════════════════
// Bu ekran `withAppShell` OLMADAN kaydediliyor — MainTabs dışında bunu yapan
// ilk ekran. Sebebi kabuğun dayattığı üç şeyin de burada zararlı olması:
//
//   • AppHeader    → sağında her ekranda sabit duran bildirim zili ve "not
//                    ekle" butonu var; bir PDF okurken ikisinin de işi yok ve
//                    paylaşım butonuna koyacak yer bırakmıyor.
//   • ContentContainer → tablette içeriği 720 px'e kısıyor. Tam ekran bir
//                    görüntüleyicide istenen tam tersi.
//   • WaveTabBar   → altta ~80 px yiyor, üstelik buzlu cam; koyu zeminde hem
//                    gereksiz hem görsel gürültü.
//
// Emsali AvatarBuilderScreen: o da kabuksuz ve tam ekran. Aradaki fark, onun
// bir RN `Modal`'ının içinde yaşaması — biz gerçek bir stack ekranıyız, bu
// sayede iOS'un kenardan geri jesti bedavaya geliyor ve ProfileScreen.tsx'te
// belgelenen "Modal içinde ikinci SafeAreaProvider gerekiyor" tuzağına hiç
// girmiyoruz.
// ═══════════════════════════════════════════════════════════════════════════

function clampIndex(value: number, length: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(Math.max(Math.trunc(value), 0), Math.max(length - 1, 0));
}

export default function FileViewerScreen() {
  const route = useRoute<RouteProp<RootStackParamList, 'FileViewer'>>();
  const navigation = useNavigation();
  const { files, index = 0, postTitle } = route.params;
  const insets = useSafeAreaInsets();
  const { share, openInDeviceApp, sharing } = useShareFile();

  // AppShell'in yaptığı tek işi elle devralıyoruz. Kabuk olmadığı için çekmece
  // jesti bir önceki ekranın bıraktığı değerde kalıyor; MainTabs'ten
  // gelindiğinde AÇIK oluyor ve sol kenardan çekiş menüyü açıyordu. Bu satır
  // gereksiz görünüp silinirse o hata geri gelir.
  useDrawerSwipeEnabled(false);

  const scrollRef = useRef<ScrollView>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [active, setActive] = useState(() => clampIndex(index, files.length));
  // Yakınlaştırılmış bir resimde yatay kaydırma SAYFA DEĞİŞTİRMEMELİ.
  const [pagerLocked, setPagerLocked] = useState(false);
  const lastWidth = useRef(0);

  // Görüntüleyici her açılışta önbelleği buduyor: yaşlı ekler ve bir önceki
  // paylaşımın okunaklı adlı kopyaları siliniyor. Ateşle-unut.
  useEffect(() => {
    trimFileCache();
  }, []);

  // Olmaması gereken durum; yine de çökmek yerine sessizce geri dön.
  useEffect(() => {
    if (files.length === 0) navigation.goBack();
  }, [files.length, navigation]);

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize((prev) => (prev.width === width && prev.height === height ? prev : { width, height }));
  }, []);

  // Konum yalnızca ÖLÇÜ DEĞİŞTİĞİNDE kuruluyor: ilk layout'ta (0 → genişlik)
  // ve ekran döndüğünde (app.json: orientation "default").
  //
  // `contentOffset` prop'u yerine bunun kullanılma sebebi Android: orada prop
  // ilk layout'tan önce uygulanmıyor ve kullanıcı üçüncü dosyanın kutucuğuna
  // basmışken birinci dosyayı görüyordu.
  //
  // `active` bilerek tetikleyici DEĞİL, yalnızca okunuyor — kullanıcı
  // kaydırdığında `active` değişiyor ve buradan ikinci bir scrollTo göndermek
  // parmağın altındaki hareketle yarışırdı.
  useEffect(() => {
    if (size.width === 0 || size.width === lastWidth.current) return;
    lastWidth.current = size.width;
    scrollRef.current?.scrollTo({ x: active * size.width, y: 0, animated: false });
  }, [size.width, active]);

  const onMomentumEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (size.width === 0) return;
      const next = Math.round(e.nativeEvent.contentOffset.x / size.width);
      setActive(clampIndex(next, files.length));
    },
    [size.width, files.length]
  );

  const handleShare = useCallback(
    (fileName: string, fileIndex: number) => share(fileName, fileIndex, postTitle),
    [share, postTitle]
  );

  if (files.length === 0) return <View style={styles.root} />;

  const activeName = files[active] ?? files[0];

  return (
    <View style={styles.root}>
      {/* Zemin her iki temada koyu, durum çubuğu da o yüzden açık renkli.
          Ekrandan çıkınca App.tsx'teki ThemedStatusBar devralıyor. */}
      <StatusBar style="light" />

      <FileViewerHeader
        fileName={activeName}
        position={active + 1}
        total={files.length}
        topInset={insets.top}
        sharing={sharing}
        onShare={() => handleShare(activeName, active)}
        // Uygulama içi görüntüleme varsayılan; PDF'lerde telefonun kendi PDF
        // uygulamasına geçme seçeneği başlıkta duruyor.
        onOpenInDeviceApp={
          fileExtension(activeName) === 'pdf' ? () => openInDeviceApp(activeName, active, postTitle) : undefined
        }
      />

      <View style={styles.pager} onLayout={onLayout}>
        {size.width > 0 && (
          // ScrollView react-native-gesture-handler'dan geliyor, RN'inkinden
          // değil: RNGH'ın sarmalayıcısı slaytların içindeki pinch/pan
          // jestleriyle aynı arbitrasyon sistemini paylaşıyor, RN'inki
          // paylaşmıyor ve yakınlaştırma sırasında ikisi birbirini yiyordu.
          <ScrollView
            ref={scrollRef}
            horizontal
            pagingEnabled
            scrollEnabled={!pagerLocked && files.length > 1}
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={onMomentumEnd}
          >
            {files.map((fileName, i) => (
              <FileSlide
                key={`${fileName}-${i}`}
                fileName={fileName}
                fileIndex={i}
                width={size.width}
                height={size.height}
                // Ağır işi (indirme, WebView mount) yalnızca görünen slayt
                // yapıyor. Beş dosyalı bir gönderide hepsi birden yüklenirse
                // düşük RAM'li Android cihazlarda uygulama ölüyor.
                active={i === active}
                onZoomChange={setPagerLocked}
                onShare={handleShare}
                sharing={sharing}
              />
            ))}
          </ScrollView>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: VIEWER_BG },
  pager: { flex: 1 },
});
