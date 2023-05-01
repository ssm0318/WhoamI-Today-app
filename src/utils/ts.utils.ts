export const typedObjectKeys = <T extends Record<string, unknown>>(obj: T) => {
  return Object.keys(obj) as (keyof typeof obj)[];
};
