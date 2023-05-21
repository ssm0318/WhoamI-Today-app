import styled from 'styled-components/native';
import { SafeAreaView, Text } from 'react-native';

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
