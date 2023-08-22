import { MomentType } from '@types';
import ApiService from './API';
import { momentFormDataSerializer } from '@utils';

const { API, BlobAPI } = ApiService;

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
  const momentFormData = momentFormDataSerializer(moment);
  const { data } = await BlobAPI.fetch(
    'POST',
    `/moment/daily/${year}/${month}/${day}/`,
    momentFormData,
  );
  return data;
};

// PUT today's moment
export const updateTodayMoment = async (
  moment: Partial<MomentType.TodayMoment>,
) => {
  const { year, month, day } = getMomentRequestParams(new Date());
  const momentFormData = momentFormDataSerializer(moment);
  const { data } = await BlobAPI.fetch(
    'PUT',
    `/moment/daily/${year}/${month}/${day}/`,
    momentFormData,
  );
  return data;
};

export const getMomentRequestParams = (date: Date) => {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return { year, month, day };
};
