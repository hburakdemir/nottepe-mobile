import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import AuthNavigator from './AuthNavigator';
import { withAppShell } from '../components/layout/AppShell';
import HomeScreen from '../screens/main/HomeScreen';
import DepartmentsScreen from '../screens/main/DepartmentsScreen';
import AddPostScreen from '../screens/main/AddPostScreen';
import ToolsScreen from '../screens/main/ToolsScreen';
import PostDetailScreen from '../screens/main/PostDetailScreen';
import DepartmentDetailScreen from '../screens/main/DepartmentDetailScreen';
import SavedPostsScreen from '../screens/main/SavedPostsScreen';
import UserProfileScreen from '../screens/main/UserProfileScreen';
import ChecklistsScreen from '../screens/main/ChecklistsScreen';
import AktsCalculatorScreen from '../screens/main/AktsCalculatorScreen';
import ScheduleScreen from '../screens/main/ScheduleScreen';
import NoteRequestsScreen from '../screens/main/NoteRequestsScreen';
import FaqScreen from '../screens/main/FaqScreen';
import FaqDetailScreen from '../screens/main/FaqDetailScreen';
import SuggestionsScreen from '../screens/main/SuggestionsScreen';
import SuggestionDetailScreen from '../screens/main/SuggestionDetailScreen';
import CafeteriaMenuScreen from '../screens/main/CafeteriaMenuScreen';
import LeaderboardScreen from '../screens/main/LeaderboardScreen';
import HelpScreen from '../screens/main/HelpScreen';
import NotificationsScreen from '../screens/main/NotificationsScreen';
import MenuScreen from '../screens/main/MenuScreen';
import ProfileScreen from '../screens/main/ProfileScreen';
import KvkkGateModal from '../components/onboarding/KvkkGateModal';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  const { isAuthenticated, loading, user } = useAuth();
  const { theme } = useTheme();

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color="#1d4ed8" />
      </View>
    );
  }

  if (!isAuthenticated) {
    return <AuthNavigator />;
  }

  const needsOnboardingGate = !!user && (!user.kvkkConsentAt || !user.faculty || !user.department);

  // Push edilen ekranların (Bildirimler, Faq vb.) native başlığı web'de hiç yok
  // — mobile-özel bir eklenti. AppHeader'ın koyu markasıyla tutarlı olsun diye
  // varsayılan beyaz native-stack başlığı yerine tema token'larıyla eşleniyor.
  const headerBg = theme === 'dark' ? '#222831' : '#FFFFFF';
  const headerTint = theme === 'dark' ? '#DFD0B8' : '#111827';

  return (
    <>
    {/* Web'de Navbar + MobileTabBar, Layout.jsx üzerinden HER rotada (Ana Sayfa,
        Ekle, Profil, Faq — hepsi) sabit kalıyor. Burada artık ayrı bir
        Tab.Navigator yok — tek düz bir stack, her ekran `withAppShell` ile
        AppHeader+WaveTabBar'a sarmalanıyor (Menu hariç: o kendi sağdan kayan
        panel tasarımını koruyor, aşağıda `presentation: 'transparentModal'`). */}
    <Stack.Navigator
      initialRouteName="Home"
      screenOptions={{
        animation: 'slide_from_right',
        headerStyle: { backgroundColor: headerBg },
        headerTintColor: headerTint,
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen name="Home" component={withAppShell(HomeScreen)} options={{ headerShown: false }} />
      <Stack.Screen name="Departments" component={withAppShell(DepartmentsScreen)} options={{ headerShown: false }} />
      <Stack.Screen name="Tools" component={withAppShell(ToolsScreen)} options={{ headerShown: false }} />
      <Stack.Screen name="AddPost" component={withAppShell(AddPostScreen)} options={{ headerShown: false }} />
      <Stack.Screen name="PostDetail" component={withAppShell(PostDetailScreen)} options={{ title: 'Gönderi' }} />
      <Stack.Screen
        name="DepartmentDetail"
        component={withAppShell(DepartmentDetailScreen)}
        options={({ route }) => ({ title: route.params.department })}
      />
      <Stack.Screen name="SavedPosts" component={withAppShell(SavedPostsScreen)} options={{ title: 'Kaydedilenler' }} />
      <Stack.Screen
        name="UserProfile"
        component={withAppShell(UserProfileScreen)}
        options={({ route }) => ({ title: `@${route.params.username}` })}
      />
      <Stack.Screen name="Checklists" component={withAppShell(ChecklistsScreen)} options={{ title: 'Checklistler' }} />
      <Stack.Screen
        name="AktsCalculator"
        component={withAppShell(AktsCalculatorScreen)}
        options={{ title: 'AKTS / GANO Hesapla' }}
      />
      <Stack.Screen name="Schedule" component={withAppShell(ScheduleScreen)} options={{ title: 'Ders Programı' }} />
      <Stack.Screen name="NoteRequests" component={withAppShell(NoteRequestsScreen)} options={{ title: 'Not İstekleri' }} />
      <Stack.Screen name="Faq" component={withAppShell(FaqScreen)} options={{ title: 'Sık Sorulan Sorular' }} />
      <Stack.Screen name="FaqDetail" component={withAppShell(FaqDetailScreen)} options={{ title: 'Soru' }} />
      <Stack.Screen name="Suggestions" component={withAppShell(SuggestionsScreen)} options={{ title: 'Öneriler' }} />
      <Stack.Screen name="SuggestionDetail" component={withAppShell(SuggestionDetailScreen)} options={{ title: 'Öneri' }} />
      <Stack.Screen name="CafeteriaMenu" component={withAppShell(CafeteriaMenuScreen)} options={{ title: 'Yemek Listesi' }} />
      <Stack.Screen name="Leaderboard" component={withAppShell(LeaderboardScreen)} options={{ title: 'Liderlik Tablosu' }} />
      <Stack.Screen name="Help" component={withAppShell(HelpScreen)} options={{ title: 'Yardım' }} />
      <Stack.Screen name="Notifications" component={withAppShell(NotificationsScreen)} options={{ title: 'Bildirimler' }} />
      <Stack.Screen
        name="Menu"
        component={MenuScreen}
        options={{ headerShown: false, presentation: 'transparentModal', animation: 'slide_from_right' }}
      />
      <Stack.Screen name="Profile" component={withAppShell(ProfileScreen)} options={{ title: 'Profil' }} />
    </Stack.Navigator>
    {needsOnboardingGate && <KvkkGateModal />}
    </>
  );
}
