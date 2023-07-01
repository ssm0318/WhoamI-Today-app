import React, { useCallback, useEffect } from 'react';
import {
  Image,
  StatusBar,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScreenRouteParamList } from '@screens';
import { useAsyncEffect, useCamera, useNavigation } from '@hooks';
import { MomentType } from '@types';
import * as S from './MomentPhotoUploadScreen.styled';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SvgIcon } from '@components';
import CameraButtons from './components/CameraButtons/CameraButtons';
import { useTranslation } from 'react-i18next';
import { momentApis } from '@apis';
import { tsUtils } from '@utils';
import { useIsFocused } from '@react-navigation/native';
import { Camera, useCameraDevices } from 'react-native-vision-camera';

const MomentPhotoUploadScreen: React.FC<MomentPhotoUploadScreenProps> = ({
  route,
}) => {
  const { state } = route.params;
  const { bottom, top } = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [t] = useTranslation('translation', { keyPrefix: 'moment' });
  const navigation = useNavigation();

  const {
    cameraRef,
    takePhoto,
    flash,
    position,
    requestPermission,
    cameraPreviewUrl,
    setCameraPreviewUrl,
    togglePosition,
    toggleFlash,
  } = useCamera();

  const isFocused = useIsFocused();
  const [cameraTranslation] = useTranslation('translation', {
    keyPrefix: 'camera_permission',
  });
  const devices = useCameraDevices();
  const device = devices[position];

  const handleSkip = useCallback(() => {
    // photo -> mood -> description
    return navigation.navigate('AppScreen', { url: '/home' });
  }, [state]);

  const handleSend = useCallback(async () => {
    // 처음 업로드 하는거면 POST, 아니면 PUT
    try {
      if (tsUtils.isObjectValueNull(state)) {
        await momentApis.postTodayMoment({
          ...state,
          photo: cameraPreviewUrl,
        });
      } else {
        await momentApis.updateTodayMoment({
          photo: cameraPreviewUrl,
        });
      }
      navigation.navigate('AppScreen', { url: '/home' });
    } catch (err) {
      console.error(err);
      navigation.navigate('AppScreen', { url: '/home' });
    }
  }, [cameraPreviewUrl, state]);

  // 최초에 한번만 카메라 권한 요청
  useAsyncEffect(async () => {
    await requestPermission(cameraTranslation);
  }, []);

  useEffect(() => {
    StatusBar.setBarStyle('light-content');
    return () => {
      StatusBar.setBarStyle('dark-content');
    };
  }, []);

  if (!device || !isFocused) return <></>;
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
        {/* 카메라 */}
        <S.CameraWrapper width={width}>
          <Camera
            ref={cameraRef}
            device={device}
            style={StyleSheet.absoluteFill}
            photo
            isActive={isFocused}
            enableZoomGesture={false}
            preset="high"
            orientation="portrait"
            torch={flash}
          />
          {!!cameraPreviewUrl && (
            <Image
              source={{ uri: cameraPreviewUrl }}
              style={StyleSheet.absoluteFill}
              fadeDuration={0}
            />
          )}
        </S.CameraWrapper>
      </S.ComponentContainer>
      {/* 컴포넌트 하단 (send, 카메라 버튼) */}
      {!cameraPreviewUrl ? (
        <CameraButtons
          togglePosition={togglePosition}
          toggleFlash={toggleFlash}
          takePhoto={takePhoto}
          setCameraPreviewUrl={setCameraPreviewUrl}
          flash={flash}
        />
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
    state: MomentType.TodayMoment;
  };
};

export default MomentPhotoUploadScreen;
