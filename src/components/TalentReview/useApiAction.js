import { useCallback, useState } from 'react';
import { App } from 'antd';

/** ajax + 错误提示；返回 [run, loading]，run 成功返回 data，失败返回 undefined */
export const useApiAction = usePreset => {
  const { ajax } = usePreset();
  const { message } = App.useApp();
  const [loading, setLoading] = useState(false);
  const run = useCallback(
    async (api, data, successText) => {
      setLoading(true);
      try {
        const { data: resData } = await ajax(Object.assign({}, api, api.method === 'GET' ? { params: data } : { data }));
        if (resData.code !== 0) {
          throw new Error(resData.msg);
        }
        successText && message.success(successText);
        return resData.data ?? true;
      } catch (e) {
        message.error(e.message);
      } finally {
        setLoading(false);
      }
    },
    [ajax, message]
  );
  return [run, loading];
};
