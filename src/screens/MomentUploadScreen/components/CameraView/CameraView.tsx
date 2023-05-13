import React, { useCallback, useState } from 'react';
import {
  Alert,
  Image,
  Linking,
  StyleSheet,
  TouchableWithoutFeedback,
  useWindowDimensions,
} from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import {
  Camera,
  CameraPosition,
  useCameraDevices,
} from 'react-native-vision-camera';
import * as S from './CameraView.styles';
import { useAsyncEffect, useCamera } from '@hooks';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { APP_CONSTS } from '@constants';

const CameraView: React.FC<CameraViewProps> = (props) => {
  const { onPreviewReady } = props;
  const [cameraPreviewUrl, setCameraPreviewUrl] = useState<null | string>(null);
  const devices = useCameraDevices();
  const device = devices.back;
  const { bottom } = useSafeAreaInsets();

  const isFocused = useIsFocused();
  const { width } = useWindowDimensions();

  const { cameraRef, togglePosition, takePhoto } = useCamera();

  const handlePressCameraButton = useCallback(async () => {
    try {
      const { uri } = await takePhoto();

      if (!uri) throw new Error('[CommonCameraView] no uri found');

      setCameraPreviewUrl(uri);
    } catch (error) {
      console.log(error);
    }
  }, []);

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
      {/* {!!cameraPreviewUrl && (
          <Image
            source={{ uri: cameraPreviewUrl }}
            style={StyleSheet.absoluteFill}
            onLoad={onLoadPreview}
            fadeDuration={0}
          />
        )} */}
      {/* {children} */}
      {/* 버튼 컨테이너 */}
      <S.ButtonContainer bottomInset={bottom}>
        {/* 플래시 */}
        <TouchableWithoutFeedback onPress={togglePosition}>
          <S.SubButton>
            <Image
              source={{
                uri: '/icons/camera_flash_off.svg',
              }}
              style={{
                width: '100%',
                height: '100%',
              }}
            />
          </S.SubButton>
        </TouchableWithoutFeedback>

        {/* 사진 촬영 */}
        <TouchableWithoutFeedback onPress={handlePressCameraButton}>
          <S.CameraButton />
        </TouchableWithoutFeedback>

        {/* 모드 전환 */}
        <TouchableWithoutFeedback onPress={togglePosition}>
          <S.SubButton>
            <Image
              source={{
                uri: '/icons/camera_switch.svg',
              }}
              style={{
                width: '100%',
                height: '100%',
              }}
            />
          </S.SubButton>
        </TouchableWithoutFeedback>
      </S.ButtonContainer>
    </S.CameraWrapper>
  );
};

type CameraViewProps = {
  children?: React.ReactNode;
  onPreviewReady?: (imageUrl: string) => void | Promise<void>;
};

export default React.memo(CameraView);
