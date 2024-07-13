/**
 * @format
 */

import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';
import 'intl-pluralrules';
import './src/i18n';
import messaging from '@react-native-firebase/messaging';
import notifee, { EventType } from '@notifee/react-native';
import NavigationService from './src/libs/NavigationService';

// Background handling with Firebase messaging
messaging().setBackgroundMessageHandler(async (remoteMessage) => {
  //  background 에 대한 실제 로직은 notifee 로 이용
  console.log('[Firebase remote message on background] : ', remoteMessage);
});

notifee.onBackgroundEvent(async ({ type, detail }) => {
  console.log('[Notifee background event]: ', type, detail);
  if (type === EventType.PRESS) {
    const url = detail.notification?.data?.url;
    if (typeof url === 'string') {
      NavigationService.navigate('AppScreen', { url });
    }
  }
});

AppRegistry.registerComponent(appName, () => App);
