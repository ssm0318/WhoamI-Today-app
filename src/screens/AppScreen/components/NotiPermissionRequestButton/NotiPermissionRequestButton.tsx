import { APP_CONSTS } from '@constants';
import React from 'react';
import { Linking, TouchableWithoutFeedback } from 'react-native';
import * as S from './NotiPermissionRequestButton.styles';

const NotiPermissionRequestButton: React.FC = () => {
  // 설정 화면으로 이동
  const handlePress = () => {
    if (APP_CONSTS.IS_ANDROID) Linking.openURL('App-Prefs:root');
    else Linking.openURL('app-settings:');
  };

  return (
    <S.ButtonWrapper>
      <TouchableWithoutFeedback onPress={handlePress}>
        <S.ButtonContent>
          <S.ButtonIcon
            source={require('../../../../../assets/icons/noti_white.png')}
          />
          <S.ButtonText>알림 권한 허용</S.ButtonText>
        </S.ButtonContent>
      </TouchableWithoutFeedback>
    </S.ButtonWrapper>
  );
};

export default NotiPermissionRequestButton;
