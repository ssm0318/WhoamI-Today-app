export const typedObjectKeys = <T extends Record<string, unknown>>(obj: T) => {
  return Object.keys(obj) as (keyof typeof obj)[];
};

// Check if all value properties of an object are null
export const isObjectValueNull = <T>(obj: T): boolean => {
  for (const key in obj) {
    if (obj[key] !== null) {
      return false;
    }
  }
  return true;
};
