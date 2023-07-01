import { useCallback, useRef, useState } from 'react';
import { Camera, CameraPosition } from 'react-native-vision-camera';
import { APP_CONSTS } from '@constants';
import { Alert } from 'react-native';
import { redirectSetting } from '@tools';
import { TFunction } from 'i18next';

export type CameraImage = { uri: string };

const useCamera = () => {
  const cameraRef = useRef<Camera | null>(null);
  const [cameraPreviewUrl, setCameraPreviewUrl] = useState<null | string>(null);
  const [position, setPosition] = useState<CameraPosition>('back');
  const [flash, setFlash] = useState<'on' | 'off'>('off');

  const togglePosition = useCallback(() => {
    setPosition((prev) => (prev === 'front' ? 'back' : 'front'));
  }, []);

  const toggleFlash = useCallback(
    () => setFlash((prev) => (prev === 'on' ? 'off' : 'on')),
    [],
  );

  const takePhoto = useCallback(async (): Promise<CameraImage> => {
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

  const requestPermission = async (t: TFunction) => {
    const permission = await Camera.requestCameraPermission();
    if (permission === 'denied') {
      Alert.alert(String(t('title')), String(t('description')), [
        {
          text: String(t('cancel')),
          style: 'cancel',
        },
        {
          text: String(t('redirect_setting')),
          onPress: redirectSetting,
          style: 'default',
        },
      ]);
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
