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

  const { cameraRef } = useCamera();

  useAsyncEffect(async () => {
    const permission = await Camera.requestCameraPermission();
    if (permission === 'denied') {
      Alert.alert(
        '카메라와 사진첩 권한이 없습니다.',
        '휴대폰 설정에서 사진첩과 카메라 접근 권한을 허용해주세요.',
        [
          {
            text: '닫기',
            style: 'cancel',
          },
          {
            text: '설정으로 이동',
            onPress: () => {
              if (APP_CONSTS.IS_ANDROID) Linking.openURL('App-Prefs:root');
              else Linking.openURL('app-settings:');
            },
            style: 'default',
          },
        ],
      );
    }
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
