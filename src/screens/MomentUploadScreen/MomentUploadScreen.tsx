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

const TITLE_LABEL: Record<keyof MomentType.MomentData, string | null> = {
  mood: 'Mood',
  photo: 'Photo',
  description: null,
};

const MomentUploadScreen: React.FC<MomentUploadScreenProps> = ({ route }) => {
  const { step = 'photo', state } = route.params;
  const { bottom, top } = useSafeAreaInsets();
  const [currentStep, setCurrentStep] =
    useState<keyof MomentType.MomentData>(step);
  const { width } = useWindowDimensions();

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
          {step === 'description'
            ? 'How would you describe\nyour day in 20 characters?'
            : `Today's Moment`}
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
                <S.SkipText>Skip</S.SkipText>
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
