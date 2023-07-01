export const typedObjectKeys = <T extends Record<string, unknown>>(obj: T) => {
  return Object.keys(obj) as (keyof typeof obj)[];
};

// 어떤 object의 모든 value 값이 null인지 확인
export const isObjectValueNull = <T>(obj: T): boolean => {
  for (const key in obj) {
    if (obj[key] !== null) {
      return false;
    }
  }
  return true;
};

// object를 FormData 형태로 변환하는 serializer
export const objectFormDataSerializer = (object: Record<string, any>) => {
  const formData = new FormData();
  Object.keys(object).forEach((key) => {
    const value = object[key];
    formData.append(key, value || '');
  });
  return formData;
};
