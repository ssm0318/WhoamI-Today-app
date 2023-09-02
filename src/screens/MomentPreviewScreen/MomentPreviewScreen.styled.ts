import styled from 'styled-components/native';
import { Text } from 'react-native';

export const HEADER_HEIGHT = 68;

export const ScreenContainer = styled.View`
  background-color: #f5f5f5;
  flex: 1;
`;

export const TopContainer = styled.View`
  display: flex;
  flex-direction: row;
  align-items: center;
  width: 100%;
  padding: 16px 24px;
  position: relative;
  justify-content: center;
  top: 0px;
  background-color: white;
  height: ${HEADER_HEIGHT}px;
`;

export const CloseButton = styled.TouchableOpacity`
  width: 32px;
  height: 32px;
  position: absolute;
  left: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
`;

export const ScreenTitle = styled(Text)`
  color: black;
  font-size: 18px;
  font-weight: 700;
  text-align: center;
  display: flex;
  align-items: center;
`;

export const PostButton = styled.TouchableOpacity<{
  bgColor: string;
}>`
  padding: 8px 12px;
  background-color: ${({ bgColor }) => bgColor};
  border-radius: 12px;
  position: absolute;
  right: 24px;
`;

export const PostText = styled(Text)<{
  textColor: string;
}>`
  font-size: 16px;
  font-weight: 400;
  text-align: center;
  display: flex;
  align-items: center;
  color: ${({ textColor }) => textColor};
`;

export const ContentWrapper = styled.View`
  flex-direction: column;
  background-color: #f5f5f5;
  padding: 24px 25px;
  display: flex;
`;

export const MoodInputWrapper = styled.View`
  width: 100%;
  padding: 24px 12px;
  background-color: #ffffff;
  border-radius: 14px;
  display: flex;
  flex-direction: row;
  align-items: center;
`;

export const MoodInput = styled.TextInput`
  font-size: 18px;
  margin: 0px 16px;
  display: flex;
  flex: 1;
`;

export const EmojiDeleteIcon = styled.TouchableOpacity`
  position: absolute;
  right: 12px;
`;

export const PhotoWrapper = styled.View`
  border-radius: 14px;
  overflow: hidden;
  width: 100%;
  margin: 16px 0px;
`;

export const DescriptionInputWrapper = styled.View`
  width: 100%;
  padding: 24px 12px;
  background-color: #ffffff;
  border-radius: 14px;
  display: flex;
  flex-direction: row;
  align-items: flex-start;
`;

export const DescriptionInput = styled.TextInput`
  font-size: 18px;
  margin-left: 16px;
  display: flex;
  flex: 1;
`;

export const CompleteModalContent = styled.View`
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
`;

export const CompleteText = styled(Text)`
  color: black;
  font-size: 18px;
  font-weight: 400;
  margin-top: 8px;
`;

export const ViewFriendsFeedButton = styled.TouchableOpacity`
  background-color: black;
  padding: 8px 12px;
  display: flex;
  border-radius: 12px;
  margin-top: 20px;
`;

export const ViewFriendsFeedText = styled(Text)`
  color: white;
  font-size: 16px;
  font-weight: 400;
`;
