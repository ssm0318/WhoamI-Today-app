import styled from 'styled-components/native';
import { SafeAreaView, Text } from 'react-native';

export const ScreenContainer = styled(SafeAreaView)`
  flex: 1;
  background-color: #000000;
  display: flex;
  justify-content: space-between;
`;

export const TopContainer = styled.View`
  display: flex;
  flex-direction: row;
  align-items: center;
  width: 100%;
  padding: 18px 24px;
  justify-content: center;
  top: 0px;
`;

export const BackButon = styled.TouchableOpacity`
  width: 32px;
  height: 32px;
  position: absolute;
  left: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
`;

export const ScreenTitle = styled(Text)`
  color: #ffffff;
  font-size: 18px;
  font-weight: 700;
  text-align: center;
  display: flex;
  align-items: center;
`;

export const ResetContainer = styled.View`
  display: flex;
  flex-direction: row;
  width: 100%;
  justify-content: flex-start;
  bottom: 0px;
  margin-bottom: 12px;
  padding-left: 10px;
`;

export const ConfirmContainer = styled.View`
  display: flex;
  flex-direction: row;
  width: 100%;
  justify-content: flex-end;
  bottom: 0px;
  margin-top: 12px;
  padding-right: 6px;
`;

export const ConfirmButton = styled.View`
  background-color: #cecbcb;
  border-radius: 8px;
  padding: 8px;
`;

export const ConfirmText = styled(Text)`
  color: #000000;
  font-size: 18px;
  font-weight: 700;
`;

export const CameraWrapper = styled.View<{
  width: number;
}>`
  width: ${({ width }) => width}px;
  height: ${({ width }) => width}px;
  background-color: transparent;
  border-radius: 14px;
  overflow: hidden;
`;

export const CenterContainer = styled.View`
  display: flex;
`;

export const BottomContainer = styled.View`
  height: 142px;
`;
