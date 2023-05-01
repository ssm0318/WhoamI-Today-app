import { NativeStackNavigationOptions } from '@react-navigation/native-stack';
import { ScreenRouteParamList } from '@screens';

export type ScreenOptions = {
  options?: NativeStackNavigationOptions;
  initialParams?: Record<string, unknown>;
};

export type RoutesParamsList = ScreenRouteParamList;

export type RouteKeys = keyof RoutesParamsList;

export type InitialRoute = {
  screeName: RouteKeys | undefined;
  screenParams: RoutesParamsList[RouteKeys] | undefined;
};

export type MessageRoute = {
  screenName: RouteKeys;
  screenParams?: {
    [key: string]: any;
  };
};

export type RouteObject<T> = { [key in keyof T]: RouteInfo };

/**
 * CARD: 일반적인 카드 스크린 -> 좌, 우 애니메이션
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
