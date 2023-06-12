import { MomentType } from '@types';
import API from './API';

// moment 업로드
export const uploadMoment = (params: MomentType.MomentData) =>
  API.post('/moment/today', params);

// moment 수정
export const updateMoment = (params: MomentType.MomentData) =>
  API.put('/moment/today', params);
