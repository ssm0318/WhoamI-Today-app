import React from 'react';
import { Image, StyleSheet, useWindowDimensions } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { Camera, useCameraDevices } from 'react-native-vision-camera';
import * as S from './CameraView.styles';
import { useAsyncEffect, useCamera } from '@hooks';
import { useTranslation } from 'react-i18next';

const CameraView: React.FC = () => {
  const devices = useCameraDevices();
  const device = devices.back;

  const isFocused = useIsFocused();
  const { width } = useWindowDimensions();
  const [cameraTranslation] = useTranslation('translation', {
    keyPrefix: 'camera_permission',
  });

  const { cameraRef, flash, requestPermission, cameraPreviewUrl } = useCamera();

  // 최초에 한번만 카메라 권한 요청
  useAsyncEffect(async () => {
    await requestPermission(cameraTranslation);
  }, []);

  if (!device || !isFocused) return <></>;
  return (
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
  );
};

export default CameraView;
