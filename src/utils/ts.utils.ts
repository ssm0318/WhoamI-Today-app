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
