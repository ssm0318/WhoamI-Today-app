import { RouteType } from '@types';
import AppScreen, { AppScreenRoute } from './AppScreen/AppScreen';
import MomentPhotoUploadScreen, {
  MomentPhotoUploadScreenRoute,
} from './MomentPhotoUploadScreen/MomentPhotoUploadScreen';

export const allRoutes: RouteType.RouteObject<ScreenRouteParamList> = {
  // first screen would be initial landing screen
  AppScreen: {
    Component: AppScreen,
    type: 'CARD',
  },
  MomentPhotoUploadScreen: {
    Component: MomentPhotoUploadScreen,
    type: 'CARD',
  },
};

export type ScreenRouteParamList = AppScreenRoute &
  MomentPhotoUploadScreenRoute;
