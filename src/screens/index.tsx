import { RouteType } from '@types';
import AppScreen, { AppScreenRoute } from './AppScreen/AppScreen';
import MomentPhotoUploadScreen, {
  MomentPhotoUploadScreenRoute,
} from './MomentPhotoUploadScreen/MomentPhotoUploadScreen';
import MomentPreviewScreen, {
  MomentPreviewScreenRoute,
} from './MomentPreviewScreen/MomentPreviewScreen';

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
  MomentPreviewScreen: {
    Component: MomentPreviewScreen,
    type: 'CARD',
  },
};

export type ScreenRouteParamList = AppScreenRoute &
  MomentPhotoUploadScreenRoute &
  MomentPreviewScreenRoute;
