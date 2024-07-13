import React from 'react';

type AsyncFunction = () => Promise<void>;

const useAsyncEffect = (func: AsyncFunction, dependency: Array<any>) => {
  React.useEffect(() => {
    (async () => {
      await func();
    })();
  }, [func, dependency]);
};

export default useAsyncEffect;
