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
import Mood from './components/Mood/Mood';
import Description from './components/Description/Description';
import Photo from './components/Photo/Photo';
import * as S from './MomentUploadScreen.styles';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SvgIcon } from '@components';
import CameraButtons from './components/CameraButtons/CameraButtons';
import { useTranslation } from 'react-i18next';

const MomentUploadScreen: React.FC<MomentUploadScreenProps> = ({ route }) => {
  //TODO 나중에 photo가 아닌 실제 시작 step을 받도록 'mood'로 기본값 변경 (현재는 테스트용)
  const { step = 'photo', state } = route.params;
  const { bottom, top } = useSafeAreaInsets();
  const [currentStep, setCurrentStep] =
    useState<keyof MomentType.MomentData>(step);
  const { width } = useWindowDimensions();
  const [t] = useTranslation('translation', { keyPrefix: 'moment' });

  const TITLE_LABEL: Record<keyof MomentType.MomentData, string | null> = {
    mood: t('mood'),
    photo: t('photo'),
    description: null,
  };

  const { ref, onMessage, postMessage } = useWebView();
  const { cameraPreviewUrl } = useCamera();

  const renderComponent = useCallback(() => {
    switch (step) {
      case 'mood':
        return <Mood />;
      case 'photo':
        return <Photo />;
      case 'description':
        return <Description />;
      default:
        return <></>;
    }
  }, [step]);

  const handleSkip = useCallback(() => {
    //TODO(handleSkip)
  }, []);

  const handleSend = useCallback(() => {
    //TODO(handleSend)
  }, []);

  return (
    <S.ScreenContainer>
      <StatusBar barStyle="light-content" />
      {/* 스크린 타이틀 */}
      <S.TopContainer top={top}>
        <S.ScreenTitle>
          {step === 'description' ? t('20_characters') : t('todays_moments')}
        </S.ScreenTitle>
      </S.TopContainer>
      {/* 컴포넌트 */}
      <S.ComponentContainer size={width}>
        {/* 컴포넌트 상단 (step, skip 버튼) */}
        <S.HeaderContainer>
          {TITLE_LABEL[step] && <S.Step>{TITLE_LABEL[step]}</S.Step>}
          <S.HeaderRight>
            <TouchableOpacity onPress={handleSkip}>
              <S.SkipButton>
                <S.SkipText>{t('skip')}</S.SkipText>
                <SvgIcon name={'moment_skip'} size={16} />
              </S.SkipButton>
            </TouchableOpacity>
          </S.HeaderRight>
        </S.HeaderContainer>
        {renderComponent()}
      </S.ComponentContainer>
      {/* 컴포넌트 하단 (send, 카메라 버튼) */}
      {currentStep === 'photo' && !cameraPreviewUrl ? (
        <CameraButtons />
      ) : (
        <S.FooterContainer bottom={bottom}>
          <TouchableOpacity onPress={handleSend}>
            <S.SendButton>
              <S.SendText>Send</S.SendText>
            </S.SendButton>
          </TouchableOpacity>
        </S.FooterContainer>
      )}
    </S.ScreenContainer>
  );
};

type MomentUploadScreenProps = NativeStackScreenProps<
  ScreenRouteParamList,
  'MomentUploadScreen'
>;

export type MomentUploadScreenRoute = {
  MomentUploadScreen: {
    step: keyof MomentType.MomentData;
    state: MomentType.MomentData;
  };
};

export default MomentUploadScreen;
