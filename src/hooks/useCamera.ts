import { useCallback, useRef, useState } from 'react';
import { Camera, CameraPosition } from 'react-native-vision-camera';
import { APP_CONSTS } from '@constants';
import { Alert, Linking } from 'react-native';
import { redirectSetting } from '@tools';

export type CameraImage = { uri: string };

const useCamera = () => {
  const cameraRef = useRef<Camera | null>(null);
  const [cameraPreviewUrl, setCameraPreviewUrl] = useState<null | string>(null);
  const [position, setPosition] = useState<CameraPosition>('back');
  const [flash, setFlash] = useState<'on' | 'off'>('off');

  const togglePosition = useCallback(
    () => setPosition((prev) => (prev === 'front' ? 'back' : 'front')),
    [],
  );

  const toggleFlash = useCallback(
    () => setFlash((prev) => (prev === 'on' ? 'off' : 'on')),
    [],
  );

  const takePhoto = useCallback(async (): Promise<CameraImage> => {
    console.log('takePhoto', cameraRef.current);
    if (!cameraRef.current) {
      throw new Error('[useCamera] cameraRef not found');
    }

    let path: null | string = null;

    if (APP_CONSTS.IS_IOS) {
      path = (
        await cameraRef.current.takePhoto({
          qualityPrioritization: 'quality',
          enableAutoStabilization: true,
          flash: 'off',
        })
      ).path;
    } else {
      path = (
        await cameraRef.current.takeSnapshot({
          quality: 100,
          skipMetadata: false,
        })
      ).path;
    }

    if (!path) {
      throw new Error('[useCamera] file path not available');
    }

    return { uri: `file://${path}` };
  }, [cameraRef]);

  const requestPermission = async () => {
    const permission = await Camera.requestCameraPermission();
    if (permission === 'denied') {
      Alert.alert(
        '카메라 권한이 없습니다.',
        '휴대폰 설정에서 카메라 접근 권한을 허용해주세요.',
        [
          {
            text: '닫기',
            style: 'cancel',
          },
          {
            text: '설정으로 이동',
            onPress: redirectSetting,
            style: 'default',
          },
        ],
      );
    }
  };

  return {
    cameraRef,
    position,
    togglePosition,
    flash,
    toggleFlash,
    cameraPreviewUrl,
    setCameraPreviewUrl,
    takePhoto,
    requestPermission,
  };
};

export default useCamera;
