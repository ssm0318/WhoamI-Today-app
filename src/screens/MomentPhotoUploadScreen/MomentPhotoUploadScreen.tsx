import React, { useCallback } from 'react';
import { StatusBar, TouchableOpacity, useWindowDimensions } from 'react-native';
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
import { momentApis } from '@apis';
import { tsUtils } from '@utils';

//TODO PHOTO가 첫 단계라고 가정한 뒤 수정했고, 기획 확정 후 수정이 필요할 수도!
const MomentPhotoUploadScreen: React.FC<MomentPhotoUploadScreenProps> = ({
  route,
}) => {
  const { state } = route.params;
  const { bottom, top } = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [t] = useTranslation('translation', { keyPrefix: 'moment' });

  const { postMessage } = useWebView();
  const { cameraPreviewUrl } = useCamera();

  const goToNextStep = useCallback(() => {
    // photo -> mood -> description
    if (!!state.mood) return postMessage('REDIRECT', 'moment/mood');
    if (!!state.description)
      return postMessage('REDIRECT', 'moment/description');
    // 앞으로 업로드 할 것이 없으면 home으로 이동
    return postMessage('REDIRECT', '/home');
  }, [state]);

  const handleSend = useCallback(async () => {
    goToNextStep();
    // 처음 업로드 하는거면 POST
    if (tsUtils.isObjectValueNull(state)) {
      return await momentApis.uploadMoment({
        ...state,
        photo: cameraPreviewUrl,
      });
    }
    // 아니면 update
    return await momentApis.updateMoment({
      photo: cameraPreviewUrl,
    });
  }, [cameraPreviewUrl, state]);

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
            <TouchableOpacity onPress={goToNextStep}>
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
      {!cameraPreviewUrl ? (
        <CameraButtons />
      ) : (
        <S.FooterContainer bottom={bottom}>
          <TouchableOpacity onPress={handleSend}>
            <S.SendButton>
              <S.SendText>{t('send')}</S.SendText>
            </S.SendButton>
          </TouchableOpacity>
        </S.FooterContainer>
      )}
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
