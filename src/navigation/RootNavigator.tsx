import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import AuthNavigator from './AuthNavigator';
import MainNavigator from './MainNavigator';
import PostDetailScreen from '../screens/main/PostDetailScreen';
import DepartmentDetailScreen from '../screens/main/DepartmentDetailScreen';
import SavedPostsScreen from '../screens/main/SavedPostsScreen';
import UserProfileScreen from '../screens/main/UserProfileScreen';
import ChecklistsScreen from '../screens/main/ChecklistsScreen';
import AktsCalculatorScreen from '../screens/main/AktsCalculatorScreen';
import ScheduleScreen from '../screens/main/ScheduleScreen';
import NoteRequestsScreen from '../screens/main/NoteRequestsScreen';
import KvkkGateModal from '../components/onboarding/KvkkGateModal';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  const { isAuthenticated, loading, user } = useAuth();

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

  return (
    <>
    <Stack.Navigator>
      <Stack.Screen name="MainTabs" component={MainNavigator} options={{ headerShown: false }} />
      <Stack.Screen name="PostDetail" component={PostDetailScreen} options={{ title: 'Gönderi' }} />
      <Stack.Screen
        name="DepartmentDetail"
        component={DepartmentDetailScreen}
        options={({ route }) => ({ title: route.params.department })}
      />
      <Stack.Screen name="SavedPosts" component={SavedPostsScreen} options={{ title: 'Kaydedilenler' }} />
      <Stack.Screen
        name="UserProfile"
        component={UserProfileScreen}
        options={({ route }) => ({ title: `@${route.params.username}` })}
      />
      <Stack.Screen name="Checklists" component={ChecklistsScreen} options={{ title: 'Checklistler' }} />
      <Stack.Screen
        name="AktsCalculator"
        component={AktsCalculatorScreen}
        options={{ title: 'AKTS / GANO Hesapla' }}
      />
      <Stack.Screen name="Schedule" component={ScheduleScreen} options={{ title: 'Ders Programı' }} />
      <Stack.Screen name="NoteRequests" component={NoteRequestsScreen} options={{ title: 'Not İstekleri' }} />
    </Stack.Navigator>
    {needsOnboardingGate && <KvkkGateModal />}
    </>
  );
}
