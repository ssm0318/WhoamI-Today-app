import { APP_CONSTS } from '@constants';
import { MomentType } from '@types';
import RNFetchBlob from 'rn-fetch-blob';

export const getMomentPhotoFileName = (date: Date) => {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return `${year}${month}${day}.png`;
};

const extractExt = (imagePath: string) => {
  const ext = imagePath.split('.').pop();
  return ext || 'jpg';
};

type RNFetchBlobData = {
  name: string;
  filename?: string;
  type?: string;
  data: string | Blob;
}[];

export const momentFormDataSerializer = (
  moment: Partial<MomentType.TodayMoment>,
) => {
  let formData: RNFetchBlobData = [];

  Object.keys(moment).forEach((key) => {
    const _key = key as keyof MomentType.TodayMoment;
    const value = moment[_key];
    if (_key === 'photo') {
      if (!value) return;
      const fileName = getMomentPhotoFileName(new Date());
      const ext = extractExt(value);
      const imageType = `image/${ext}`;

      formData.push({
        name: 'photo',
        filename: fileName,
        type: imageType,
        data: RNFetchBlob.wrap(
          APP_CONSTS.IS_ANDROID ? value : value.replace('file://', ''),
        ),
      });
    } else {
      if (!!value) formData.push({ name: key, data: value || '' });
    }
  });
  return formData;
};
