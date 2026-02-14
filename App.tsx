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
  prefixes: ['whoami://', 'https://whoami-admin-group.gina-park.site'],
  config: {
    screens: {
      AppScreen: {
        path: ':url*',
        parse: {
          url: (url: string) => `/${url || ''}`,
        },
      },
    },
  },
  async getInitialURL() {
    const url = await Linking.getInitialURL();
    console.log('[Deep Link] getInitialURL:', url);

    // Handle Spotify URIs - open in Spotify app instead of our app
    if (url?.startsWith('spotify:')) {
      console.log('[Deep Link] Opening Spotify URL:', url);
      try {
        const canOpen = await Linking.canOpenURL(url);
        if (canOpen) {
          await Linking.openURL(url);
          console.log('[Deep Link] Spotify app opened successfully');
        } else {
          console.log(
            '[Deep Link] Cannot open Spotify URL - app not installed?',
          );
        }
      } catch (error) {
        console.error('[Deep Link] Failed to open Spotify URL:', error);
      }
      return null; // Don't navigate within our app
    }

    return url;
  },
  subscribe(listener) {
    const subscription = Linking.addEventListener('url', ({ url }) => {
      console.log('[Deep Link] Received URL:', url);

      // Handle Spotify URIs - open in Spotify app instead of our app
      if (url?.startsWith('spotify:')) {
        console.log('[Deep Link] Opening Spotify URL:', url);
        Linking.canOpenURL(url)
          .then((canOpen) => {
            if (canOpen) {
              Linking.openURL(url);
              console.log('[Deep Link] Spotify app opened successfully');
            } else {
              console.log(
                '[Deep Link] Cannot open Spotify URL - app not installed?',
              );
            }
          })
          .catch((error) => {
            console.error('[Deep Link] Failed to open Spotify URL:', error);
          });
        return; // Don't notify listener
      }

      console.log('[Deep Link] Passing URL to navigation:', url);
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
