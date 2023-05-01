import React, { useCallback, useLayoutEffect, useMemo } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { getRoutes } from './routes';
import { useAppStateEffect, useAsyncEffect, useWebView } from '@hooks';
import { FcmTokenStorage, registerFCMToken, TokenStorage } from '@tools';
import { FirebaseNotification, LocalNotification } from '@libs';
import BootSplash from 'react-native-bootsplash';

const RootNavigator = () => {
  const { ref, postMessage } = useWebView();

  const { routes } = useMemo(() => getRoutes(), []);

  useLayoutEffect(() => {
    FirebaseNotification.initialize();
    FirebaseNotification.requestUserPermission();
    LocalNotification.initialize(ref);
  }, [ref]);

  useAppStateEffect(
    useCallback(
      async (state) => {
        if (state === 'active' || state === 'unknown') {
          // 로컬 스토리지에서 token 확인 후 postMessage
          const token = await TokenStorage.getToken();
          postMessage('SET_TOKEN', token);

          // 로컬 스토리지에서 FCM token 확인 후 있으면 서버에 등록
          const { fcmToken } = await FcmTokenStorage.getToken();
          if (!fcmToken || !token.access || !token.refresh) return;
          await registerFCMToken(fcmToken, true);
        }
      },
      [postMessage],
    ),
    [],
  );

  useAsyncEffect(async () => {
    try {
      // 맨 처음에 FCM 토큰 무조건 로컬 스토리지에 저장 후 서버에 전송
      const fcmToken = await FirebaseNotification.getToken();
      await FcmTokenStorage.setToken({
        fcmToken,
      });
      await registerFCMToken(fcmToken, true);
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
