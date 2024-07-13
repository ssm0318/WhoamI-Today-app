/**
 * @format
 */

import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';
import 'intl-pluralrules';
import './src/i18n';
import messaging from '@react-native-firebase/messaging';

// Background handling with Firebase messaging
messaging().setBackgroundMessageHandler(async (remoteMessage) => {
  console.log('[Firebase remote message on background] : ', remoteMessage);
});

function HeadlessCheck({ isHeadless }) {
  if (isHeadless) {
    // App has been launched in the background by iOS, ignore
    return null;
  }

  return <App />;
}

AppRegistry.registerComponent(appName, () => HeadlessCheck);
