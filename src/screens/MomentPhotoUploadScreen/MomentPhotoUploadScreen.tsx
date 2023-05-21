import React, { useCallback, useState } from 'react';
import {
  StatusBar,
  TouchableOpacity,
  useWindowDimensions,
  Image,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScreenRouteParamList } from '@screens';
import { useCamera, useWebView } from '@hooks';
import { MomentType } from '@types';
import Photo from './components/Photo/Photo';
import * as S from './MomentPhotoUploadScreen.styled';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SvgIcon } from '@components';
import CameraButtons from './components/CameraButtons/CameraButtons';
import { useTranslation } from 'react-i18next';

const MomentPhotoUploadScreen: React.FC<MomentPhotoUploadScreenProps> = ({
  route,
}) => {
  // state가 나중에는 사라질 수도 있음 (Photo 업로드 단계가 1단계면 필요없음)
  const { state } = route.params;
  const { bottom, top } = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [t] = useTranslation('translation', { keyPrefix: 'moment' });

  const { ref, onMessage, postMessage } = useWebView();
  const { cameraPreviewUrl } = useCamera();

  const handleSkip = useCallback(() => {
    //TODO(handleSkip)
    // 아무것도 전달하지 않고 바로 web에 메시지
  }, []);

  const handleSend = useCallback(() => {
    //TODO(handleSend)
    console.log(cameraPreviewUrl);
    // 아무것도 전달하지 않고 바로 web에 메시지
  }, [cameraPreviewUrl]);

  return (
    <S.ScreenContainer>
      <StatusBar barStyle="light-content" />
      {/* 스크린 타이틀 */}
      <S.TopContainer top={top}>
        <S.ScreenTitle>{t('todays_moments')}</S.ScreenTitle>
      </S.TopContainer>
      {/* 컴포넌트 */}
      <S.ComponentContainer size={width}>
        {/* 컴포넌트 상단 (step, skip 버튼) */}
        <S.HeaderContainer>
          <S.Step>{t('photo')}</S.Step>
          <S.HeaderRight>
            <TouchableOpacity onPress={handleSkip}>
              <S.SkipButton>
                <S.SkipText>{t('skip')}</S.SkipText>
                <SvgIcon name={'moment_skip'} size={16} />
              </S.SkipButton>
            </TouchableOpacity>
          </S.HeaderRight>
        </S.HeaderContainer>
        <Photo />
      </S.ComponentContainer>
      {/* 컴포넌트 하단 (send, 카메라 버튼) */}
      {!cameraPreviewUrl && <CameraButtons />}
    </S.ScreenContainer>
  );
};

type MomentPhotoUploadScreenProps = NativeStackScreenProps<
  ScreenRouteParamList,
  'MomentPhotoUploadScreen'
>;

export type MomentPhotoUploadScreenRoute = {
  MomentPhotoUploadScreen: {
    state: MomentType.MomentData;
  };
};

export default MomentPhotoUploadScreen;
