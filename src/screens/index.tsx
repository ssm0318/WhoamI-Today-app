import { RouteType } from '@types';
import AppScreen, { AppScreenRoute } from './AppScreen/AppScreen';
import MomentUploadScreen, {
  MomentUploadScreenRoute,
} from './MomentUploadScreen/MomentUploadScreen';

export const allRoutes: RouteType.RouteObject<ScreenRouteParamList> = {
  // first screen would be initial landing screen
  AppScreen: {
    Component: AppScreen,
    type: 'CARD',
  },
  MomentUploadScreen: {
    Component: MomentUploadScreen,
    type: 'CARD',
  },
};

export type ScreenRouteParamList = AppScreenRoute & MomentUploadScreenRoute;
