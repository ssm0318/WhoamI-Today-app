import { MomentType } from '@types';
import { Platform } from 'react-native';
import RNFS from 'react-native-fs';
import RNFetchBlob from 'rn-fetch-blob';

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
  console.log(14, moment);
  Object.keys(moment).forEach(async (key) => {
    const _key = key as keyof MomentType.TodayMoment;
    const value = moment[_key];
    if (_key === 'photo') {
      if (!value) return;
      const fileName = getMomentPhotoFileName(new Date());

      formData.append('photo', {
        uri: Platform.OS === 'android' ? value : value.replace('file://', ''),
        type: 'multipart/form-data',
        name: fileName,
      });
    } else {
      if (!!value) formData.append(key, value || '');
    }
  });
  console.log(26, formData);
  return formData;
};
