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
import { SvgIcon } from '@components';
import CameraButtons from './components/CameraButtons/CameraButtons';
import { useTranslation } from 'react-i18next';
import { momentApis } from '@apis';
import { useIsFocused } from '@react-navigation/native';
import { Camera, useCameraDevices } from 'react-native-vision-camera';

const MomentPhotoUploadScreen: React.FC<MomentPhotoUploadScreenProps> = ({
  route,
}) => {
  const { todayMoment, draft } = route.params;
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

  const handleBack = useCallback(() => {
    navigation.goBack();
  }, []);

  const handleResetPreview = useCallback(() => {
    setCameraPreviewUrl('');
  }, []);

  const handleConfirm = async () => {
    if (!cameraPreviewUrl) return;
    navigation.navigate('MomentPreviewScreen', {
      todayMoment,
      draft,
      photoPreviewUrl: cameraPreviewUrl,
    });
  };

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
      <S.TopContainer>
        {cameraPreviewUrl ? (
          <></>
        ) : (
          <>
            <S.BackButon onPress={handleBack}>
              <SvgIcon name={'navigation_left_white'} size={20} />
            </S.BackButon>
            <S.ScreenTitle>{t('todays_moments_photo')}</S.ScreenTitle>
          </>
        )}
      </S.TopContainer>
      {/* 카메라 */}
      <S.CenterContainer>
        {/* after */}
        {cameraPreviewUrl ? (
          <>
            <S.ResetContainer>
              <TouchableOpacity onPress={handleResetPreview}>
                <SvgIcon name={'close_white'} size={26} />
              </TouchableOpacity>
            </S.ResetContainer>
            <Image
              source={{ uri: cameraPreviewUrl }}
              style={{
                width: width,
                height: width,
              }}
              fadeDuration={0}
            />
            <S.ConfirmContainer>
              <TouchableOpacity onPress={handleConfirm}>
                <S.ConfirmButton>
                  <S.ConfirmText>{t('confirm')}</S.ConfirmText>
                </S.ConfirmButton>
              </TouchableOpacity>
            </S.ConfirmContainer>
          </>
        ) : (
          <>
            {/* before */}
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
            </S.CameraWrapper>
          </>
        )}
      </S.CenterContainer>
      <S.BottomContainer>
        {!cameraPreviewUrl && (
          <CameraButtons
            togglePosition={togglePosition}
            toggleFlash={toggleFlash}
            takePhoto={takePhoto}
            setCameraPreviewUrl={setCameraPreviewUrl}
            flash={flash}
          />
        )}
      </S.BottomContainer>
    </S.ScreenContainer>
  );
};

type MomentPhotoUploadScreenProps = NativeStackScreenProps<
  ScreenRouteParamList,
  'MomentPhotoUploadScreen'
>;

export type MomentPhotoUploadScreenRoute = {
  MomentPhotoUploadScreen: {
    todayMoment: MomentType.TodayMoment;
    draft: MomentType.TodayMoment;
  };
};

export default MomentPhotoUploadScreen;
