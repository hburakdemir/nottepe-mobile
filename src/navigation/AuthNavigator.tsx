import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import BackButton from '../components/layout/BackButton';
import LoginScreen from '../screens/auth/LoginScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';
import VerifyEmailScreen from '../screens/auth/VerifyEmailScreen';
import ForgotPasswordScreen from '../screens/auth/ForgotPasswordScreen';
import ResetPasswordScreen from '../screens/auth/ResetPasswordScreen';
import { useTheme } from '../context/ThemeContext';
import { STACK_ANIMATION } from './stackAnimation';
import type { AuthStackParamList } from './types';

const Stack = createNativeStackNavigator<AuthStackParamList>();

export default function AuthNavigator() {
  const { theme } = useTheme();
  const headerBg = theme === 'dark' ? '#222831' : '#FFFFFF';
  const headerTint = theme === 'dark' ? '#DFD0B8' : '#111827';

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animation: STACK_ANIMATION,
        headerStyle: { backgroundColor: headerBg },
        headerTintColor: headerTint,
        headerShadowVisible: false,
        headerLeft: (props) => <BackButton tintColor={props.tintColor} />,
      }}
    >
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} />
      <Stack.Screen name="VerifyEmail" component={VerifyEmailScreen} options={{ headerShown: true, title: 'Email Doğrulama' }} />
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} options={{ headerShown: true, title: 'Şifremi Unuttum' }} />
      <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} options={{ headerShown: true, title: 'Yeni Şifre' }} />
    </Stack.Navigator>
  );
}
