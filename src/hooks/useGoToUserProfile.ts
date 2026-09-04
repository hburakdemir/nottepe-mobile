import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import { goToTab } from '../navigation/navigateApp';
import type { RootStackParamList } from '../navigation/types';

export function useGoToUserProfile() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user } = useAuth();

  return (username?: string) => {
    if (!username) return;
    if (user && user.username === username) {
      goToTab(navigation, 'Profile');
      return;
    }
    navigation.navigate('UserProfile', { username });
  };
}
