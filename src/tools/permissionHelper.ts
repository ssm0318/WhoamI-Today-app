import { Linking } from 'react-native';

// 휴대폰의 설정 화면으로 이동하는 함수
export const redirectSetting = () => {
  Linking.openSettings();
};
