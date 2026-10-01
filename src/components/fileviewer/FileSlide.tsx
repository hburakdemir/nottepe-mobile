import React, { useCallback, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { getFileUrl } from '../../lib/config';
import { fileExtension, fileKind } from '../../theme/feedTokens';
import HandoffSlide from './HandoffSlide';
import ImageSlide from './ImageSlide';
import IosDocSlide from './IosDocSlide';
import OfficeSlide, { OFFICE_EXTENSIONS } from './OfficeSlide';
import PdfSlide from './PdfSlide';
import { VIEWER_BG } from './viewerTokens';

interface Props {
  fileName: string;
  fileIndex: number;
  width: number;
  height: number;
  active: boolean;
  onZoomChange: (zoomed: boolean) => void;
  onShare: (fileName: string, index: number) => void;
  sharing: boolean;
  /** Gönderi başlığı — iPhone'da Quick Look ekranının başlığı. */
  postTitle?: string;
}

// Tek slaytın beyni: türe göre hangi görüntüleyicinin çizileceğine burada karar
// veriliyor.
//
// Tür kararının TEK mercii `fileKind()` (theme/feedTokens.ts). Akıştaki dosya
// kutucuğunun ikonu ve etiketi de oradan geliyor; ikinci bir tür listesi
// yazmak, kutucukta "PDF" yazarken burada başka bir şey açılması demekti.
export default function FileSlide({
  fileName,
  fileIndex,
  width,
  height,
  active,
  onZoomChange,
  onShare,
  sharing,
  postTitle,
}: Props) {
  const kind = fileKind(fileName);
  // Cihaz resmi çözemediyse (Android'de HEIC'in sistem kod çözücüsü yok)
  // devretme ekranına düşüyoruz. Aynı emniyet ileride eklenebilecek svg/tiff
  // gibi türler için de geçerli — hiçbir dosya boş bir ekranla bitmiyor.
  const [imageFailed, setImageFailed] = useState(false);

  const handoff = useCallback(() => onShare(fileName, fileIndex), [onShare, fileName, fileIndex]);

  const url = getFileUrl(fileName);
  if (!url) {
    return (
      <View style={[styles.slide, { width, height }]}>
        <HandoffSlide
          fileName={fileName}
          onOpen={handoff}
          busy={sharing}
          reason="Bu dosyanın adresi çözülemedi."
        />
      </View>
    );
  }

  if (kind === 'image' && !imageFailed) {
    return (
      <ImageSlide
        uri={url}
        width={width}
        height={height}
        active={active}
        onZoomChange={onZoomChange}
        onError={() => setImageFailed(true)}
      />
    );
  }

  // iPhone'da PDF ve Office tek yoldan: diske indir, WKWebView çizsin.
  // Gerekçesi IosDocSlide.tsx'te.
  if (Platform.OS === 'ios' && (kind === 'pdf' || OFFICE_EXTENSIONS.has(fileExtension(fileName)))) {
    return (
      <IosDocSlide
        fileName={fileName}
        title={postTitle}
        width={width}
        height={height}
        active={active}
        onOpenExternally={handoff}
      />
    );
  }

  if (OFFICE_EXTENSIONS.has(fileExtension(fileName))) {
    return (
      <OfficeSlide
        fileName={fileName}
        url={url}
        width={width}
        height={height}
        active={active}
        onOpenExternally={handoff}
        sharing={sharing}
      />
    );
  }

  if (kind === 'pdf') {
    return (
      <PdfSlide
        fileName={fileName}
        width={width}
        height={height}
        active={active}
        onOpenExternally={handoff}
        sharing={sharing}
      />
    );
  }

  return (
    <View style={[styles.slide, { width, height }]}>
      <HandoffSlide
        fileName={fileName}
        onOpen={handoff}
        busy={sharing}
        reason={imageFailed ? 'Bu resim biçimini cihazın açamıyor.' : undefined}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  slide: { backgroundColor: VIEWER_BG },
});
