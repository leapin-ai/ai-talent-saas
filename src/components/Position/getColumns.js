import React from 'react';
import ChangeMagnitude from './ChangeMagnitude';

const getColumns = ({ onDetail, formatMessage }) => {
  return [
    {
      name: 'name',
      title: formatMessage({ id: 'position.name' }),
      renderType: 'main',
      onClick: onDetail
    },
    {
      name: 'department',
      title: formatMessage({ id: 'position.department' }),
      getValueOf: (item, { context } = {}) => {
        const data = context?.data || {};
        const org = data.orgEnums?.find(target => target.value === item.tenantOrgId);
        return org?.description || '-';
      }
    },
    {
      name: 'changeMagnitude',
      title: formatMessage({ id: 'position.changeMagnitude' }),
      type: 'other',
      getValueOf: item => <ChangeMagnitude value={item.changeMagnitude} />
    },
    {
      name: 'employeeCount',
      title: formatMessage({ id: 'position.employeeCount' }),
      type: 'otherSmall',
      hidden: true,
      getValueOf: item => (item.employeeCount == null ? 0 : item.employeeCount)
    },
    {
      name: 'status',
      title: formatMessage({ id: 'position.status' }),
      renderType: 'tag',
      getValueOf: item => ({
        isEnum: true,
        moduleName: 'positionStatus',
        name: item.status
      })
    },
    {
      name: 'language',
      title: formatMessage({ id: 'position.language' }),
      renderType: 'tag',
      getValueOf: item => ({
        isEnum: true,
        moduleName: 'language',
        name: item.language
      })
    },
    {
      name: 'description',
      title: formatMessage({ id: 'position.description' }),
      renderType: 'description',
      ellipsis: true,
      getValueOf: target => {
        if (!target.description) {
          return '-';
        }
        return target.description.replace(/<[^>]*>/g, '');
      }
    },
    {
      name: 'publishAt',
      title: formatMessage({ id: 'position.publishAt' }),
      format: 'datetime',
      hidden: true
    },
    {
      name: 'createdAt',
      title: formatMessage({ id: 'position.createdAt' }),
      format: 'datetime',
      hidden: true
    }
  ];
};

export default getColumns;
