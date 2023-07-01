import { MomentType } from '@types';
import API from './API';
import { tsUtils } from '@utils';

// GET today's moment
export const getTodayMoment = async () => {
  const { year, month, day } = getMomentRequestParams(new Date());
  const res = await API.get<MomentType.TodayMoment>(
    `/moment/daily/${year}/${month}/${day}/`,
  );
  return res;
};

// POST today's moment
export const postTodayMoment = async (
  moment: Partial<MomentType.TodayMoment>,
) => {
  const { year, month, day } = getMomentRequestParams(new Date());
  const momentFormData = tsUtils.objectFormDataSerializer(moment);
  const res = await API.post<MomentType.TodayMoment>(
    `/moment/daily/${year}/${month}/${day}/`,
    momentFormData,
    {
      headers: { 'Content-Type': 'multipart/form-data' },
    },
  );
  return res;
};

// PUT today's moment
export const updateTodayMoment = async (
  moment: Partial<MomentType.TodayMoment>,
) => {
  const { year, month, day } = getMomentRequestParams(new Date());
  const momentFormData = tsUtils.objectFormDataSerializer(moment);
  const res = await API.put<MomentType.TodayMoment>(
    `/moment/daily/${year}/${month}/${day}/`,
    momentFormData,
    {
      headers: { 'Content-Type': 'multipart/form-data' },
    },
  );
  return res;
};

export const getMomentRequestParams = (date: Date) => {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return { year, month, day };
};
