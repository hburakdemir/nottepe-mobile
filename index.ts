import { registerRootComponent } from 'expo';

// Yan etkili modül: bildirim handler'ı React ağacından ÖNCE kurulmalı,
// aksi hâlde uygulama ön plandayken gelen ilk bildirim hiç gösterilmez
// (bkz. src/lib/push/handler.ts).
import './src/lib/push/handler';
import App from './App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
