import { NavigationContainerRef } from '@react-navigation/native';
import { NativeStackNavigationOptions } from '@react-navigation/native-stack';
import { ScreenRouteParamList } from '@screens';

export type ScreenOptions = {
  options?: NativeStackNavigationOptions;
  initialParams?: Record<string, unknown>;
};

export type RoutesParamsList = ScreenRouteParamList;

export type RouteKeys = keyof RoutesParamsList;

export type RouteObject<T> = { [key in keyof T]: RouteInfo };

/**
 * CARD: General card screen -> left, right animation
 */
export type ScreenType = 'CARD';

export type RouteInfo = {
  Component: React.ComponentType<any>;
  type: ScreenType;
  options?: NativeStackNavigationOptions;
};

export type ResultRoute = {
  Component: React.ComponentType<any>;
  initialParams?: Record<string, unknown>;
  name: string;
  options?: NativeStackNavigationOptions;
  allowMaintenance?: boolean;
};

export type AppNavigation = NavigationContainerRef<RoutesParamsList>;
