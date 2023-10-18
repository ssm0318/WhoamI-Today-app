/**
 * @format
 */

import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';
import 'intl-pluralrules';
import './src/i18n';
import messaging from '@react-native-firebase/messaging';
import useFirebaseMessage from './src/hooks/useFirebaseMessage';

import { useEffect } from 'react';

const AppWrapper = () => {
  const { handleOnMessage } = useFirebaseMessage();

  useEffect(() => {
    const unsubscribeBackgroundMessage =
      messaging().setBackgroundMessageHandler((remoteMessage) => {
        console.log(
          '[Firebase remote message on background] : ',
          remoteMessage,
        );
        handleOnMessage(remoteMessage);
      });

    return () => {
      unsubscribeBackgroundMessage();
    };
  }, []);

  return <App />;
};

AppRegistry.registerComponent(appName, () => AppWrapper);
