import { RouteType } from '@types';
import AppScreen, { AppScreenRoute } from './AppScreen/AppScreen';

export const allRoutes: RouteType.RouteObject<ScreenRouteParamList> = {
  // first screen would be initial landing screen
  AppScreen: {
    Component: AppScreen,
    type: 'CARD',
  },
};

export type ScreenRouteParamList = AppScreenRoute;
