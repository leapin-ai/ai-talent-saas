import merge from 'lodash/merge';
import { toSavePayload } from './payload';

export const savePosition = async ({ ajax, apis, payload, record }) => {
  const body = toSavePayload(payload);
  const { data: resData } = await ajax(
    typeof apis.save === 'function'
      ? apis.save({ formData: body, data: record, options: {} })
      : merge({}, apis.save, {
          data: Object.assign({}, body, { id: record.id })
        })
  );
  return resData;
};
