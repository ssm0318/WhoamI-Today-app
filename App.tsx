import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  NavigationContainer,
  NavigationState,
  useNavigationContainerRef,
} from '@react-navigation/native';
import { RootNavigator } from '@navigation';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { RouteType } from '@types';
import NavigationService from '@libs/NavigationService';

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

export default React.memo(App);
