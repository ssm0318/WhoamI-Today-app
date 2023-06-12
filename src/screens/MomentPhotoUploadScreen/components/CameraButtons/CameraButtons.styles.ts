import styled from 'styled-components/native';

export const ButtonContainer = styled.View<{ bottom: number }>`
  position: absolute;
  align-items: center;
  justify-content: space-between;
  flex-direction: row;
  padding: 0px 42px;
  width: 100%;
  bottom: ${({ bottom }) => bottom + 60}px;
`;

export const SubButton = styled.View`
  align-items: center;
  justify-content: center;
`;

export const CameraButton = styled.View`
  justify-content: center;
  align-items: center;
`;
