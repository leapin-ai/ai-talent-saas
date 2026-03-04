import { globalInit } from '../preset';
import { getApis } from '@components/Apis';
import { enums } from '@components/EnumLoader';
import { employeeList, employeeDetail, employeeCreate } from './data/employee';
import merge from 'lodash/merge';

const apis = merge({}, getApis(), {
  talentSaas: {
    tenant: {
      employee: {
        list: {
          loader: () => employeeList.data
        },
        detail: {
          loader: () => employeeDetail.data
        },
        create: {
          loader: () => employeeCreate.data
        }
      }
    }
  }
});

const preset = {
  ajax: async ({ loader, ...props }) => {
    if (!loader && props.url) {
      const { ajax } = await globalInit();
      return ajax({ loader, ...props });
    }
    return Promise.resolve({ data: loader ? { code: 0, data: loader() } : { code: 0, data: {} } });
  },
  apis,
  enums: Object.assign({}, enums)
};

export default preset;
