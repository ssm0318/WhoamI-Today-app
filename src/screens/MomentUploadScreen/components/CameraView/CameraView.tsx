import React from 'react';
import { Alert, Linking, StyleSheet, useWindowDimensions } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { Camera, useCameraDevices } from 'react-native-vision-camera';
import * as S from './CameraView.styles';
import { useAsyncEffect, useCamera } from '@hooks';
import { APP_CONSTS } from '@constants';

const CameraView: React.FC = () => {
  const devices = useCameraDevices();
  const device = devices.back;

  const isFocused = useIsFocused();
  const { width } = useWindowDimensions();

  const { cameraRef, flash, requestPermission } = useCamera();

  useAsyncEffect(async () => {
    await requestPermission();
  }, []);

  if (!device || !isFocused) return <></>;
  return (
    <S.CameraWrapper width={width}>
      {device && (
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
      )}

      {/* {!!cameraPreviewUrl && (
          <Image
            source={{ uri: cameraPreviewUrl }}
            style={StyleSheet.absoluteFill}
            onLoad={onLoadPreview}
            fadeDuration={0}
          />
        )} */}
    </S.CameraWrapper>
  );
};

export default CameraView;
