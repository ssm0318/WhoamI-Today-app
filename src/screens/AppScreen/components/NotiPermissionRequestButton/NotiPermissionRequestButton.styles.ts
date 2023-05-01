import styled from 'styled-components/native';

export const ButtonWrapper = styled.View`
  padding: 12px 14px;
  background-color: #f12c56;
  bottom: 100px;
  align-self: center;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 25px;
  position: absolute;
`;

export const ButtonContent = styled.View`
  display: flex;
  flex-direction: row;
  align-items: center;
`;

export const ButtonIcon = styled.Image`
  width: 12px;
  height: 12px;
  margin-right: 2px;
`;

export const ButtonText = styled.Text`
  color: #ffffff;
  font-size: 13px;
  text-align: center;
`;
