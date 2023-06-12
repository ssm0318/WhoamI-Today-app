import { useNavigation as useNavigationContext } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ScreenRouteParamList } from '@screens';

const useNavigation = () => {
  return useNavigationContext<
    NativeStackNavigationProp<ScreenRouteParamList>
  >();
};

export default useNavigation;
