import React, { useCallback, useLayoutEffect, useMemo } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { getRoutes } from './routes';
import { useAppStateEffect, useAsyncEffect, useWebView } from '@hooks';
import { FcmTokenStorage, registerFCMToken, getDeviceLanguage } from '@tools';
import { FirebaseNotification, LocalNotification } from '@libs';
import BootSplash from 'react-native-bootsplash';
import { useTranslation } from 'react-i18next';

const RootNavigator = () => {
  const { ref, postMessage } = useWebView();

  const { i18n } = useTranslation();
  const [notiTranslation] = useTranslation('translation', {
    keyPrefix: 'noti_permission',
  });

  const { routes } = useMemo(() => getRoutes(), []);

  useLayoutEffect(() => {
    FirebaseNotification.initialize();
    FirebaseNotification.checkToken();

    FirebaseNotification.getPermissionEnabled().then((enabled) => {
      if (!enabled) {
        FirebaseNotification.requestPermission(notiTranslation);
      }
    });

    LocalNotification.initialize(ref);

    // 언어 감지 후 언어 셋팅
    // TODO 추후에는 언어 설정에서 직접 설정할 수 있도록
    const language = getDeviceLanguage();
    i18n.changeLanguage(language);
  }, [ref]);

  useAppStateEffect(
    useCallback(
      async (state) => {
        if (state === 'active' || state === 'unknown') {
          // 로컬 스토리지에서 FCM token 확인 후 있으면 서버에 등록
          const { fcmToken } = await FcmTokenStorage.getToken();
          if (!fcmToken) return;
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
