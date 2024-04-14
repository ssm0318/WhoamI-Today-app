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
