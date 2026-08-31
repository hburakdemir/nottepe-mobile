import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import HomeScreen from '../screens/main/HomeScreen';
import DepartmentsScreen from '../screens/main/DepartmentsScreen';
import AddPostScreen from '../screens/main/AddPostScreen';
import ToolsScreen from '../screens/main/ToolsScreen';
import NotificationsScreen from '../screens/main/NotificationsScreen';
import ProfileScreen from '../screens/main/ProfileScreen';
import type { MainTabParamList } from './types';

const Tab = createBottomTabNavigator<MainTabParamList>();

export default function MainNavigator() {
  return (
    <Tab.Navigator screenOptions={{ headerShown: false }}>
      <Tab.Screen name="Home" component={HomeScreen} options={{ title: 'Ana Sayfa' }} />
      <Tab.Screen name="Departments" component={DepartmentsScreen} options={{ title: 'Bölümler' }} />
      <Tab.Screen name="AddPost" component={AddPostScreen} options={{ title: 'Ekle' }} />
      <Tab.Screen name="Tools" component={ToolsScreen} options={{ title: 'Araçlar' }} />
      <Tab.Screen name="Notifications" component={NotificationsScreen} options={{ title: 'Bildirimler' }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ title: 'Profil' }} />
    </Tab.Navigator>
  );
}
