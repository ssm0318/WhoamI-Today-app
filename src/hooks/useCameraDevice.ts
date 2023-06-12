import { useMemo } from 'react';
import {
  CameraPosition,
  PhysicalCameraDeviceType,
  useCameraDevices,
  Camera,
} from 'react-native-vision-camera';

/**
 * 기기가 지원하는 카메라 중 우선순위에 따라 device 반환
 */
const useCameraDevice = async (position: CameraPosition) => {
  const devices = (await Camera.getAvailableCameraDevices()).filter(
    (d) => d.position === position,
  );

  const deviceType: PhysicalCameraDeviceType = useMemo(() => {
    const availableDeviceTypeList = devices.flatMap((d) => d.devices);
    for (const deviceType of CAMERA_DEVICE_PRIORITY) {
      if (availableDeviceTypeList.includes(deviceType)) {
        return deviceType;
      }
    }
    return availableDeviceTypeList[0];
  }, [devices]);

  return useCameraDevices(deviceType)[position];
};

const CAMERA_DEVICE_PRIORITY: PhysicalCameraDeviceType[] = [
  'wide-angle-camera',
  'ultra-wide-angle-camera',
  'telephoto-camera',
];

export default useCameraDevice;
