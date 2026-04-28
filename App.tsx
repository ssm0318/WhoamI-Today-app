import React, { useMemo, useRef } from 'react';
import { Linking, NativeModules, Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  NavigationContainer,
  useNavigationContainerRef,
  LinkingOptions,
  CommonActions,
} from '@react-navigation/native';
import crashlytics from '@react-native-firebase/crashlytics';
import { RootNavigator } from '@navigation';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { RouteType } from '@types';
import NavigationService from '@libs/NavigationService';
import { triggerWidgetRefresh } from './src/native/WidgetDataModule';

if (!__DEV__) {
  crashlytics().setCrashlyticsCollectionEnabled(true);

  const defaultHandler = ErrorUtils.getGlobalHandler();
  ErrorUtils.setGlobalHandler((error, isFatal) => {
    crashlytics().recordError(error);
    defaultHandler(error, isFatal);
  });

  const originalConsoleError = console.error;
  console.error = (...args: unknown[]) => {
    const first = args[0];
    if (first instanceof Error) crashlytics().recordError(first);
    originalConsoleError(...args);
  };
}

const PREFIXES = ['whoami://', 'https://whoami-admin-group.gina-park.site'];

const WIDGET_REFRESH_URL = 'whoami://widget/refresh-checkin';

/** Parse deep link URL to AppScreen url param (same as linking config parse). */
function getAppScreenUrlParamFromDeepLink(fullUrl: string): string | null {
  for (const prefix of PREFIXES) {
    if (fullUrl.startsWith(prefix)) {
      const path = fullUrl.slice(prefix.length).replace(/^\/+/, '') || '';
      const webPath = path.startsWith('app/') ? path.slice(4) : path;
      return `/${webPath}`;
    }
  }
  return null;
}

function buildLinking(
  navigationRef: React.RefObject<RouteType.AppNavigation | null>,
  pendingDeepLinkRef: React.MutableRefObject<string | null>,
): LinkingOptions<RouteType.RoutesParamsList> {
  return {
    prefixes: PREFIXES,
    config: {
      screens: {
        AppScreen: {
          path: ':url*',
          parse: {
            url: (url: string) => {
              const path = url || '';
              const webPath = path.startsWith('app/') ? path.slice(4) : path;
              return `/${webPath}`;
            },
          },
        },
      },
    },
    async getInitialURL() {
      let url = await Linking.getInitialURL();
      // iOS: when app is cold-started from widget, URL is often delivered via openURL
      // *after* we run. Use stored URL from InitialURLModule with short polling; return quickly if not found.
      if (Platform.OS === 'ios' && !url && NativeModules.InitialURLModule) {
        const delays = [0, 50, 100, 150];
        for (const delayMs of delays) {
          if (delayMs > 0) {
            await new Promise((r) => setTimeout(r, delayMs));
          }
          const stored =
            await NativeModules.InitialURLModule.getStoredInitialURL();
          if (stored && stored !== null && typeof stored === 'string') {
            url = stored;
            console.log('[Deep Link] getInitialURL (from stored):', url);
            break;
          }
        }
      }
      // Android: fallback when Linking.getInitialURL() is null (e.g. cold start edge case)
      if (Platform.OS === 'android' && !url && NativeModules.InitialURLModule) {
        const stored =
          await NativeModules.InitialURLModule.getStoredInitialURL();
        if (stored && stored !== null && typeof stored === 'string') {
          url = stored;
          console.log('[Deep Link] getInitialURL (Android from module):', url);
        }
      }
      console.log('[Deep Link] getInitialURL:', url);

      // Widget refresh only – reload widget timelines, do not navigate
      if (url === WIDGET_REFRESH_URL) {
        void triggerWidgetRefresh();
        return null;
      }

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

        // Widget refresh only – reload widget timelines, do not navigate
        if (url === WIDGET_REFRESH_URL) {
          void triggerWidgetRefresh();
          return;
        }

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

        // Ensure AppScreen gets the URL when subscribe fires (e.g. cold start from widget)
        const urlParam = getAppScreenUrlParamFromDeepLink(url);
        if (urlParam == null) return;
        if (navigationRef.current) {
          navigationRef.current.dispatch(
            CommonActions.reset({
              index: 0,
              routes: [{ name: 'AppScreen', params: { url: urlParam } }],
            }),
          );
        } else {
          pendingDeepLinkRef.current = urlParam;
        }
      });
      return () => subscription.remove();
    },
  };
}

const App: React.FC = () => {
  const navigationRef = useNavigationContainerRef<RouteType.RoutesParamsList>();
  const pendingDeepLinkRef = useRef<string | null>(null);
  const linking = useMemo(
    () => buildLinking(navigationRef, pendingDeepLinkRef),
    [navigationRef],
  );

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <NavigationContainer<RouteType.RoutesParamsList>
          ref={navigationRef}
          linking={linking}
          onReady={() => {
            if (!navigationRef.current) return;
            NavigationService.setNavigation(navigationRef.current);
            const pending = pendingDeepLinkRef.current;
            if (pending != null) {
              pendingDeepLinkRef.current = null;
              navigationRef.current.dispatch(
                CommonActions.reset({
                  index: 0,
                  routes: [{ name: 'AppScreen', params: { url: pending } }],
                }),
              );
            }
            // iOS: delayed re-check for URL that arrived after getInitialURL (cold start from widget)
            if (Platform.OS === 'ios' && NativeModules.InitialURLModule) {
              setTimeout(async () => {
                try {
                  const stored =
                    await NativeModules.InitialURLModule.getStoredInitialURL();
                  if (stored && stored !== null && typeof stored === 'string') {
                    const urlParam = getAppScreenUrlParamFromDeepLink(stored);
                    if (urlParam != null && navigationRef.current) {
                      const route = navigationRef.current.getCurrentRoute();
                      const currentUrl = (
                        route?.params as { url?: string } | undefined
                      )?.url;
                      const isHome =
                        route?.name === 'AppScreen' &&
                        (currentUrl === '/' ||
                          currentUrl === '' ||
                          currentUrl == null);
                      if (isHome) {
                        navigationRef.current.dispatch(
                          CommonActions.reset({
                            index: 0,
                            routes: [
                              {
                                name: 'AppScreen',
                                params: { url: urlParam },
                              },
                            ],
                          }),
                        );
                      }
                    }
                  }
                } catch {
                  // ignore
                }
              }, 400);
            }
          }}
        >
          <RootNavigator />
        </NavigationContainer>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
};

export default React.memo(App);
