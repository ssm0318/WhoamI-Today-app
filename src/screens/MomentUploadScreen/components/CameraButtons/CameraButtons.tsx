import React, { useCallback } from 'react';
import * as S from './CameraButtons.styles';
import { TouchableWithoutFeedback } from 'react-native';
import { SvgIcon } from '@components';
import { useCamera } from '@hooks';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const CameraButtons = () => {
  const {
    cameraRef,
    position,
    togglePosition,
    takePhoto,
    setCameraPreviewUrl,
  } = useCamera();

  const { bottom, top } = useSafeAreaInsets();

  const handlePressCameraButton = useCallback(async () => {
    try {
      // LoadingIndicator.show();

      const { uri } = await takePhoto();

      if (!uri) throw new Error('[CommonCameraView] no uri found');

      setCameraPreviewUrl(uri);
    } catch (error) {
      console.log(error);
      // LoadingIndicator.hide();
    }
  }, []);

  return (
    <S.ButtonContainer bottom={bottom}>
      {/* 플래시 */}
      <TouchableWithoutFeedback onPress={togglePosition}>
        <S.SubButton>
          <SvgIcon name={'camera_flash_off'} size={36} />
        </S.SubButton>
      </TouchableWithoutFeedback>

      {/* 사진 촬영 */}
      <TouchableWithoutFeedback onPress={handlePressCameraButton}>
        <S.CameraButton>
          <SvgIcon name={'camera_photo'} size={86} />
        </S.CameraButton>
      </TouchableWithoutFeedback>

      {/* 모드 전환 */}
      <TouchableWithoutFeedback onPress={togglePosition}>
        <S.SubButton>
          <SvgIcon name={'camera_switch'} size={36} />
        </S.SubButton>
      </TouchableWithoutFeedback>
    </S.ButtonContainer>
  );
};

export default React.memo(CameraButtons);
