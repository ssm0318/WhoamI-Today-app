import React, { useLayoutEffect, useMemo } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { getRoutes } from './routes';
import { useAsyncEffect, useFirebaseMessage } from '@hooks';
import { getDeviceLanguage } from '@tools';
import BootSplash from 'react-native-bootsplash';
import { useTranslation } from 'react-i18next';

const RootNavigator = () => {
  const { i18n } = useTranslation();

  const { initialize: initializeFirebaseMessage } = useFirebaseMessage();

  const { routes } = useMemo(() => getRoutes(), []);

  useLayoutEffect(() => {
    initializeFirebaseMessage();

    // initialize language from device settings
    const language = getDeviceLanguage();
    i18n.changeLanguage(language);
  }, []);

  // initialize with async handlers
  useAsyncEffect(async () => {
    try {
      // Handle asynchronous operations needed during Bootsplash state
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
