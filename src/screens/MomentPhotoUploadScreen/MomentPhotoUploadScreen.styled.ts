import styled from 'styled-components/native';
import { SafeAreaView, StyleSheet, Text } from 'react-native';

export const ScreenContainer = styled(SafeAreaView)`
  flex: 1;
  background-color: #000000;
  align-items: center;
  justify-content: center;
`;

export const TopContainer = styled.View<{ top: number }>`
  display: flex;
  position: absolute;
  top: ${({ top }) => top}px;
`;

export const ScreenTitle = styled(Text)`
  color: #ffffff;
  font-size: 24px;
  font-weight: 700;
  text-align: center;
`;

export const ComponentContainer = styled.View<{ size: number }>`
  width: ${({ size }) => size}px;
  height: ${({ size }) => size}px;
  border-radius: 14px;
`;

export const HeaderContainer = styled.View`
  display: flex;
  flex-direction: row;
  margin-bottom: 17px;
  align-items: center;
  position: absolute;
  top: -45px;
  width: 100%;
  justify-content: center;
`;

export const Step = styled(Text)`
  color: #ffffff;
  font-size: 18px;
  font-weight: 700;
`;

export const HeaderRight = styled.View`
  position: absolute;
  right: 24px;
  justify-content: flex-end;
`;

export const SkipButton = styled.View`
  background-color: #ffffff;
  border: 1px solid #d9d9d9;
  border-radius: 13px;
  padding: 4px 12px;
  gap: 4px;
  display: flex;
  flex-direction: row;
`;

export const SkipText = styled(Text)`
  color: #000000;
  font-size: 14px;
  font-weight: 400;
`;

export const FooterContainer = styled.View<{ bottom: number }>`
  display: flex;
  flex-direction: row;
  width: 100%;
  justify-content: flex-end;
  padding-right: 24px;
  position: absolute;
  bottom: ${({ bottom }) => bottom + 80}px;
`;

export const SendButton = styled.View`
  background-color: #cecbcb;
  border-radius: 8px;
  padding: 6px 20px;
`;

export const SendText = styled(Text)`
  color: #000000;
  font-size: 18px;
  font-weight: 700;
`;

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
