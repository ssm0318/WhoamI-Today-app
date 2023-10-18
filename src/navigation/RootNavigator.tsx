import React, { useLayoutEffect, useMemo } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { getRoutes } from './routes';
import { useAsyncEffect, useFirebaseMessage, useLocalMessage } from '@hooks';
import { getDeviceLanguage } from '@tools';
import BootSplash from 'react-native-bootsplash';
import { useTranslation } from 'react-i18next';

const RootNavigator = () => {
  const { i18n } = useTranslation();

  const { initialize: initializeFirebaseMessage } = useFirebaseMessage();
  const { initialize: initializeLocalMessage } = useLocalMessage();

  const { routes } = useMemo(() => getRoutes(), []);

  useLayoutEffect(() => {
    // initialize FirebaseNotification
    initializeFirebaseMessage();
    initializeLocalMessage();

    // initialize language
    // TODO 추후에는 언어 설정에서 직접 설정할 수 있도록
    const language = getDeviceLanguage();
    i18n.changeLanguage(language);
  }, []);

  // initialize with async handlers
  useAsyncEffect(async () => {
    try {
      // 비동기 동작 필요한 것들은 Bootsplash 상태인 동안 처리
      // ex. async storage, ...
    } catch (error) {
      console.log(error);
    } finally {
      await BootSplash.hide({ fade: true });
    }
  }, []);

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {routes.map(({ name, Component, initialParams, options }) => (
        <Stack.Screen
          key={name}
          name={name}
          component={Component}
          initialParams={{ ...initialParams }}
          options={options}
        />
      ))}
    </Stack.Navigator>
  );
};

const Stack = createNativeStackNavigator();

export default RootNavigator;
