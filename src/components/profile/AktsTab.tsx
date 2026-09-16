import React, { useCallback } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useQueryClient } from '@tanstack/react-query';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Calculator, Trash2 } from 'lucide-react-native';
import { aktsAPI } from '../../lib/api';
import { formatGpa } from '../../utils/gano';
import type { RootStackParamList } from '../../navigation/types';
import { MY_AKTS_KEY, useMyAktsCalcs, type AktsCalc } from '../../hooks/profile/useProfileLists';
import { useDelayedLoading } from '../../hooks/useDelayedLoading';
import PagerPage, { type ProfileTabProps } from './PagerPage';
import { EmptyState, SHADOW_SM, TabLoading, formatDate } from './profileCommon';

// Tek bir AKTS hesaplaması satırı. `React.memo`: bir hesaplama silindiğinde
// listedeki diğerleri yeniden çizilmesin.
const AktsRow = React.memo(function AktsRow({
  calc,
  onEdit,
  onDelete,
}: {
  calc: AktsCalc;
  onEdit: (id: number) => void;
  onDelete: (id: number) => void;
}) {
  const semesterCount = calc.data?.semesters?.length || 0;
  const courseCount = calc.data?.semesters?.reduce((sum, s) => sum + (s.courses?.length || 0), 0) || 0;

  return (
    <View className="flex-row items-center bg-surface rounded-lg p-3.5 mb-3" style={SHADOW_SM}>
      <View className="flex-1">
        <Text className="text-sm font-bold text-ink" numberOfLines={1}>
          {calc.title}
        </Text>
        <Text className="text-[11.5px] text-muted2 mt-0.5">
          {semesterCount} dönem · {courseCount} ders · {formatDate(calc.updated_at)}
        </Text>
      </View>
      <View className="items-center mr-2.5">
        <Text className="text-lg font-extrabold text-accent">{formatGpa(calc.gpa)}</Text>
        <Text className="text-xs text-muted2 uppercase">GANO</Text>
      </View>
      <Pressable className="bg-brand rounded-lg px-2.5 py-[7px]" onPress={() => onEdit(calc.id)}>
        <Text className="text-white text-xs font-bold">Düzenle</Text>
      </Pressable>
      <Pressable onPress={() => onDelete(calc.id)} hitSlop={8} className="ml-2">
        <Trash2 size={17} color="#dc2626" />
      </Pressable>
    </View>
  );
});

// Profil > AKTS sekmesi.
function AktsTab({ active, width, headerHeight, scrollY, onRememberOffset }: ProfileTabProps) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const queryClient = useQueryClient();
  const { data: calcs, isPending } = useMyAktsCalcs();
  // bkz. ChecklistsTab.tsx — aynı gecikmeli yükleme kuralı.
  const showLoading = useDelayedLoading(isPending);

  const handleEdit = useCallback(
    (id: number) => navigation.navigate('AktsCalculator', { loadId: id }),
    [navigation]
  );

  const handleDelete = useCallback(
    (id: number) => {
      Alert.alert('Hesaplamayı sil', 'Bu hesaplamayı silmek istediğinize emin misiniz?', [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Sil',
          style: 'destructive',
          onPress: async () => {
            try {
              await aktsAPI.delete(id);
              queryClient.setQueryData<AktsCalc[]>(MY_AKTS_KEY, (prev) => prev?.filter((c) => c.id !== id));
            } catch {
              Alert.alert('Hata', 'Silinemedi.');
            }
          },
        },
      ]);
    },
    [queryClient]
  );

  const goToCalculator = useCallback(() => navigation.navigate('AktsCalculator'), [navigation]);

  return (
    <PagerPage
      tabKey="akts"
      width={width}
      headerHeight={headerHeight}
      scrollY={scrollY}
      onRememberOffset={onRememberOffset}
    >
      {active &&
        (showLoading ? (
          <TabLoading />
        ) : isPending ? null : !calcs || calcs.length === 0 ? (
          <EmptyState
            icon={Calculator}
            text="Henüz kayıtlı AKTS hesaplaman yok."
            actionLabel="Hesaplayıcıya Git"
            onAction={goToCalculator}
          />
        ) : (
          calcs.map((calc) => <AktsRow key={calc.id} calc={calc} onEdit={handleEdit} onDelete={handleDelete} />)
        ))}
    </PagerPage>
  );
}

export default React.memo(AktsTab);
