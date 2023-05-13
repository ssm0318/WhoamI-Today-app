import { RouteType } from '@types';
import AppScreen, { AppScreenRoute } from './AppScreen/AppScreen';
import MomentUploadScreen, {
  MomentUploadScreenRoute,
} from './MomentUploadScreen/MomentUploadScreen';

export const allRoutes: RouteType.RouteObject<ScreenRouteParamList> = {
  // first screen would be initial landing screen
  MomentUploadScreen: {
    Component: MomentUploadScreen,
    type: 'CARD',
  },
  AppScreen: {
    Component: AppScreen,
    type: 'CARD',
  },
};

export type ScreenRouteParamList = AppScreenRoute & MomentUploadScreenRoute;
