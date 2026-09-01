import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  Bell,
  BadgeHelp,
  HeartHandshake,
  HelpCircle,
  Lightbulb,
  LightbulbOff,
  LogOut,
  Megaphone,
  X,
  type LucideIcon,
} from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { avatarAPI, notificationAPI, userNotificationAPI } from '../../lib/api';
import type { AvatarData } from '../../components/avatar/AvatarDisplay';
import AvatarDisplay from '../../components/avatar/AvatarDisplay';
import DeerIcon from '../../components/icons/DeerIcon';
import type { RootStackParamList } from '../../navigation/types';

interface MenuLinkProps {
  icon: LucideIcon;
  label: string;
  color: string;
  badge?: number;
  onPress: () => void;
}

// Web'in `px-3 py-2 rounded-md` linkleriyle (Navbar.jsx satır ~467-540) birebir
// aynı padding/font-size; ikon rengi web'deki gibi metinle aynı currentColor'ı
// takip ediyor (dark: darktext, light: gray-700) — sabit gri değil.
function MenuLink({ icon: Icon, label, color, badge, onPress }: MenuLinkProps) {
  return (
    <Pressable onPress={onPress} className="flex-row items-center gap-2 px-3 py-2 rounded-md active:bg-gray-100 dark:active:bg-gray-700/40">
      <Icon size={20} color={color} />
      <Text className="text-gray-700 dark:text-darktext text-base">{label}</Text>
      {!!badge && badge > 0 && (
        <View className="ml-auto min-w-[16px] h-4 px-1 rounded-full bg-red-500 items-center justify-center">
          <Text className="text-white text-[10px] font-bold">{badge > 99 ? '99+' : badge}</Text>
        </View>
      )}
    </Pressable>
  );
}

function Divider() {
  return <View className="h-px bg-gray-200 dark:bg-gray-700/60" />;
}

const PANEL_WIDTH = '80%';
const PANEL_MAX_WIDTH = 320;

// Web'in Navbar.jsx `isMenuOpen` panelinin mobil karşılığı — tam ekran bir sayfa
// değil, sağdan kayan, ekranın tamamını kaplamayan bir panel (RootNavigator.tsx'te
// `presentation: 'transparentModal'` — arkadaki ekran donuk bir katmanla görünür
// kalıyor). Boş alana (solda) dokununca da kapanır. Admin linki bilinçli olarak
// yok (PLAN.md: yönetim paneli web'de kalıyor).
export default function MenuScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const iconColor = theme === 'dark' ? '#DFD0B8' : '#374151';
  const brandColor = theme === 'dark' ? '#5A9690' : '#2F5755';

  const [avatar, setAvatar] = useState<AvatarData | null>(null);
  const [broadcastUnread, setBroadcastUnread] = useState(0);
  const [personalUnread, setPersonalUnread] = useState(0);

  useEffect(() => {
    avatarAPI
      .get()
      .then((res) => setAvatar(res.data?.avatar || null))
      .catch(() => setAvatar(null));
    notificationAPI
      .getActive()
      .then((res) => setBroadcastUnread(res.data?.length || 0))
      .catch(() => setBroadcastUnread(0));
    userNotificationAPI
      .getUnreadCount()
      .then((res) => setPersonalUnread(res.data?.count || 0))
      .catch(() => setPersonalUnread(0));
  }, []);

  const close = () => navigation.goBack();

  const go = (fn: () => void) => {
    close();
    fn();
  };

  const handleLogout = async () => {
    close();
    await logout();
  };

  return (
    <View className="flex-1 flex-row">
      <Pressable className="flex-1 bg-black/40" onPress={close} accessibilityLabel="Menüyü kapat" />

      <View style={{ width: PANEL_WIDTH, maxWidth: PANEL_MAX_WIDTH }} className="bg-primary dark:bg-darkbgbutton">
        <SafeAreaView edges={['top', 'right', 'bottom']} style={{ flex: 1 }}>
          <View className="h-14 flex-row items-center justify-between px-3">
            <Text className="text-secondary dark:text-darktext text-base font-bold">Menü</Text>
            <Pressable onPress={close} hitSlop={8} className="p-1.5 rounded-full" accessibilityLabel="Kapat">
              <X size={20} color={iconColor} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={{ padding: 12, gap: 4 }}>
            <Pressable
              onPress={() => go(() => navigation.navigate('Profile'))}
              className="flex-row items-center gap-3 px-3 py-2.5 mb-3 rounded-md active:bg-gray-100 dark:active:bg-gray-700/40"
            >
              <View className="w-12 h-12 rounded-full overflow-hidden items-center justify-center bg-brand/10 dark:bg-brand-light/15">
                {avatar ? <AvatarDisplay avatar={avatar} size={48} showBg={false} /> : <DeerIcon size={26} color={brandColor} />}
              </View>
              <View>
                <Text className="text-secondary dark:text-darktext text-[17px] font-bold">
                  {user?.full_name || user?.username}
                </Text>
                <Text className="text-gray-500 dark:text-gray-400 text-xs mt-0.5">Profili Görüntüle</Text>
              </View>
            </Pressable>

            <MenuLink
              icon={HeartHandshake}
              label="Not İstekleri"
              color={iconColor}
              onPress={() => go(() => navigation.navigate('NoteRequests'))}
            />
            <MenuLink
              icon={HelpCircle}
              label="Sık Sorulan Sorular"
              color={iconColor}
              onPress={() => go(() => navigation.navigate('Faq'))}
            />
            <MenuLink icon={Lightbulb} label="Öneriler" color={iconColor} onPress={() => go(() => navigation.navigate('Suggestions'))} />
            <MenuLink
              icon={Bell}
              label="Bildirimler"
              color={iconColor}
              badge={personalUnread}
              onPress={() => go(() => navigation.navigate('Notifications', { initialTab: 'aktivite' }))}
            />
            <MenuLink
              icon={Megaphone}
              label="Duyurular"
              color={iconColor}
              badge={broadcastUnread}
              onPress={() => go(() => navigation.navigate('Notifications', { initialTab: 'duyurular' }))}
            />
            <MenuLink icon={BadgeHelp} label="Yardım" color={iconColor} onPress={() => go(() => navigation.navigate('Help'))} />

            <Divider />

            <Pressable
              onPress={toggleTheme}
              className="flex-row items-center gap-2 px-3 py-2 rounded-md active:bg-gray-100 dark:active:bg-gray-700/40"
            >
              {theme === 'dark' ? <LightbulbOff size={20} color={iconColor} /> : <Lightbulb size={20} color={iconColor} />}
              <Text className="text-gray-700 dark:text-darktext text-base">Karanlık Mod</Text>
            </Pressable>
            <Pressable
              onPress={handleLogout}
              className="flex-row items-center gap-2 px-3 py-2 rounded-md active:bg-red-50 dark:active:bg-red-900/20"
            >
              <LogOut size={20} color="#dc2626" />
              <Text className="text-red-600 text-base">Çıkış</Text>
            </Pressable>
          </ScrollView>
        </SafeAreaView>
      </View>
    </View>
  );
}
