import React from 'react';
import { Linking } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  NavigationContainer,
  useNavigationContainerRef,
  LinkingOptions,
} from '@react-navigation/native';
import { RootNavigator } from '@navigation';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { RouteType } from '@types';
import NavigationService from '@libs/NavigationService';

// Deep linking configuration for widget
const linking: LinkingOptions<RouteType.RoutesParamsList> = {
  prefixes: ['whoami://'],
  config: {
    screens: {
      AppScreen: {
        path: 'app/:path*',
        parse: {
          path: (path: string) => `/${path || ''}`,
        },
      },
    },
  },
  async getInitialURL() {
    const url = await Linking.getInitialURL();
    return url;
  },
  subscribe(listener) {
    const subscription = Linking.addEventListener('url', ({ url }) => {
      listener(url);
    });
    return () => subscription.remove();
  },
};

const App: React.FC = () => {
  const navigationRef = useNavigationContainerRef<RouteType.RoutesParamsList>();

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <NavigationContainer<RouteType.RoutesParamsList>
          ref={navigationRef}
          linking={linking}
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

export default React.memo(App);
