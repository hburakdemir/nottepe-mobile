import { Dimensions } from 'react-native';

// Menü panelinin genişliği — RootNavigator'daki Drawer.Navigator'ın
// `drawerStyle.width`'i VE PushableStack'in itme mesafesi (translateX hedefi)
// bu tek sabitten türetiliyor, ikisi asla birbirinden sapmasın diye.
export const DRAWER_WIDTH = Math.min(Dimensions.get('window').width * 0.8, 320);
