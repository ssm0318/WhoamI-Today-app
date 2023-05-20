import { APP_CONSTS } from '@constants';
import { Linking } from 'react-native';

// 휴대폰의 설정 화면으로 이동하는 함수
export const redirectSetting = () => {
  if (APP_CONSTS.IS_ANDROID) Linking.openURL('App-Prefs:root');
  else Linking.openURL('app-settings:');
};
