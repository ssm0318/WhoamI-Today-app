import { RouteType } from '@types';
import { ScreenRouteParamList } from '@screens';

class NavigationService {
  private navigation: RouteType.AppNavigation | null = null;

  public setNavigation(_navigation: RouteType.AppNavigation): void {
    this.navigation = _navigation;
  }

  public navigate<T extends keyof ScreenRouteParamList>(
    ...args: T extends unknown
      ? undefined extends ScreenRouteParamList[T]
        ? [screen: T] | [screen: T, params: ScreenRouteParamList[T]]
        : [screen: T, params: ScreenRouteParamList[T]]
      : never
  ): void {
    if (!this.navigation) {
      return console.log('[Router] setNavigation before request navigate');
    }

    this.navigation.navigate(...args);
  }
}

export default new NavigationService();
