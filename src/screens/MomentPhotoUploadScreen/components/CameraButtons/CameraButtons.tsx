import React, { useCallback } from 'react';
import * as S from './CameraButtons.styles';
import { TouchableWithoutFeedback } from 'react-native';
import { SvgIcon } from '@components';
import { CameraImage } from '@hooks';

export type CameraButtonsProps = {
  togglePosition: () => void;
  toggleFlash: () => void;
  takePhoto: () => Promise<CameraImage>;
  setCameraPreviewUrl: (url: string | null) => void;
  flash: 'on' | 'off';
};

const CameraButtons: React.FC<CameraButtonsProps> = ({
  togglePosition,
  toggleFlash,
  takePhoto,
  setCameraPreviewUrl,
  flash,
}) => {
  const handlePressCameraButton = useCallback(async () => {
    try {
      const { uri } = await takePhoto();
      if (!uri) throw new Error('[Error] no uri found');
      setCameraPreviewUrl(uri);
    } catch (error) {
      console.log(error);
    }
  }, []);

  return (
    <S.ButtonContainer>
      {/* 플래시 */}
      <TouchableWithoutFeedback onPress={toggleFlash}>
        <S.SubButton>
          <SvgIcon name={`camera_flash_${flash}`} size={36} />
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

export default CameraButtons;
