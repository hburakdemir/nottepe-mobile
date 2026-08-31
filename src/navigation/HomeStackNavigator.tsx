import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import HomeScreen from '../screens/main/HomeScreen';
import PostDetailScreen from '../screens/main/PostDetailScreen';
import type { HomeStackParamList } from './types';

const Stack = createNativeStackNavigator<HomeStackParamList>();

export default function HomeStackNavigator() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="Home" component={HomeScreen} options={{ title: 'Ana Sayfa' }} />
      <Stack.Screen name="PostDetail" component={PostDetailScreen} options={{ title: 'Gönderi' }} />
    </Stack.Navigator>
  );
}
