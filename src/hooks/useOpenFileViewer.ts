import { useCallback } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';

/**
 * Gönderi eklerini uygulama içi görüntüleyicide açar.
 *
 * Daha önce her çağrı yeri `Linking.openURL(getFileUrl(...))` diyordu: dosya
 * harici tarayıcıya devredilip kullanıcı uygulamadan çıkıyordu. Yönlendirme
 * artık tek yerden geçiyor ki akış, gönderi detayı ve ileride eklenecek başka
 * ek listeleri birbirinden ayrışmasın.
 */
export function useOpenFileViewer() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  return useCallback(
    (files: string[], index = 0, postTitle?: string) => {
      if (files.length === 0) return;
      navigation.navigate('FileViewer', { files, index, postTitle });
    },
    [navigation]
  );
}
