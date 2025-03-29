import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  NavigationContainer,
  useNavigationContainerRef,
} from '@react-navigation/native';
import { RootNavigator } from '@navigation';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { RouteType } from '@types';
import NavigationService from '@libs/NavigationService';
import * as Sentry from '@sentry/react-native';

Sentry.init({
  dsn: 'https://3c8ac3927da72e0a4daeefec838adfcf@o4508942221705216.ingest.us.sentry.io/4508942227603456',
});

const App: React.FC = () => {
  const navigationRef = useNavigationContainerRef<RouteType.RoutesParamsList>();

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <NavigationContainer<RouteType.RoutesParamsList>
          ref={navigationRef}
          onReady={() => {
            if (!navigationRef.current) return;
            NavigationService.setNavigation(navigationRef.current);
          }}
        >
          <RootNavigator />
        </NavigationContainer>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
};

export default Sentry.wrap(React.memo(App));
