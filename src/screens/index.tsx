import { RouteType } from '@types';
import AppScreen, { AppScreenRoute } from './AppScreen/AppScreen';

export const allRoutes: RouteType.RouteObject<ScreenRouteParamList> = {
  AppScreen: {
    Component: AppScreen,
    type: 'CARD',
  },
};

export type ScreenRouteParamList = AppScreenRoute;
