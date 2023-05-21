import { StyleSheet } from 'react-native';
import styled from 'styled-components/native';

export const { fill } = StyleSheet.create({
  fill: { width: '100%', height: '100%' },
});

export const CameraWrapper = styled.View<{
  width: number;
}>`
  width: ${({ width }) => width}px;
  height: ${({ width }) => width}px;
  background-color: 'transparent';
  border-radius: 14px;
  overflow: hidden;
`;

export const ButtonContainer = styled.View<{ bottomInset: number }>`
  position: absolute;
  bottom: ${({ bottomInset }) => bottomInset || 0}px;
  left: 0;
  right: 0;
  align-items: center;
  justify-content: space-between;
  flex-direction: row;
  padding: 0px 42px;
`;

const SUB_BUTTON_SIZE = 36;
const CAMERA_BUTTON_SIZE = 86;

export const SubButton = styled.View`
  align-items: center;
  justify-content: center;
  border-radius: ${SUB_BUTTON_SIZE / 2}px;
  width: ${SUB_BUTTON_SIZE}px;
  height: ${SUB_BUTTON_SIZE}px;
`;

export const CameraButton = styled.View`
  width: ${CAMERA_BUTTON_SIZE}px;
  height: ${CAMERA_BUTTON_SIZE}px;
  justify-content: center;
  align-items: center;
`;
