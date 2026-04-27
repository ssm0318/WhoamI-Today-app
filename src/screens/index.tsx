import { RouteType } from '@types';
import AppScreen, { AppScreenRoute } from './AppScreen/AppScreen';
import VideoScreen, { VideoScreenRoute } from './VideoScreen/VideoScreen';

export const allRoutes: RouteType.RouteObject<ScreenRouteParamList> = {
  // first screen would be initial landing screen
  AppScreen: {
    Component: AppScreen,
    type: 'CARD',
  },
  VideoScreen: {
    Component: VideoScreen,
    type: 'CARD',
    options: {
      presentation: 'fullScreenModal',
      animation: 'fade',
    },
  },
};

export type ScreenRouteParamList = AppScreenRoute & VideoScreenRoute;
