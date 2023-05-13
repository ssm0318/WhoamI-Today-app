import { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, CameraPosition } from 'react-native-vision-camera';
import { Platform } from 'react-native';

export type CameraImage = { uri: string };

const useCamera = () => {
  const cameraRef = useRef<Camera | null>(null);

  const [position, setPosition] = useState<CameraPosition>('back');

  const togglePosition = useCallback(
    () => setPosition((prev) => (prev === 'front' ? 'back' : 'front')),
    [],
  );

  const takePhoto = useCallback(async (): Promise<CameraImage> => {
    if (!cameraRef.current) {
      throw new Error('[useCamera] cameraRef not found');
    }

    let path: null | string = null;

    if (Platform.OS === 'ios') {
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
  }, []);

  return {
    cameraRef,
    position,
    togglePosition,
    takePhoto,
  };
};

export default useCamera;