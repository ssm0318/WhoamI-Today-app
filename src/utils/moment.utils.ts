import { MomentType } from '@types';

export const getMomentPhotoFileName = (date: Date) => {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return `${year}${month}${day}.jpg`;
};

export const momentFormDataSerializer = (
  moment: Partial<MomentType.TodayMoment>,
) => {
  const formData = new FormData();
  Object.keys(moment).forEach((key) => {
    const _key = key as keyof MomentType.TodayMoment;
    const value = moment[_key];
    if (_key === 'photo') {
      formData.append('photo', {
        fileName: getMomentPhotoFileName(new Date()),
        type: 'image/jpeg',
        uri: value,
      });
    } else formData.append(key, value || '');
  });
  return formData;
};
