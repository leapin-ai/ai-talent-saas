const getColumns = ({ onDetail, formatMessage }) => {
  return [
    {
      name: 'name',
      title: formatMessage({ id: 'position.name' }),
      onClick: onDetail,
      type: 'mainInfo'
    },
    {
      name: 'status',
      title: formatMessage({ id: 'position.status' }),
      type: 'tag',
      valueOf: item => ({
        isEnum: true,
        moduleName: 'positionStatus',
        name: item.status
      })
    },
    {
      name: 'language',
      title: formatMessage({ id: 'position.language' }),
      type: 'tag',
      valueOf: item => ({
        isEnum: true,
        moduleName: 'language',
        name: item.language
      })
    },
    {
      name: 'description',
      title: formatMessage({ id: 'position.description' }),
      type: 'description'
    },
    {
      name: 'publishAt',
      title: formatMessage({ id: 'position.publishAt' }),
      type: 'datetime'
    },
    {
      name: 'createdAt',
      title: formatMessage({ id: 'position.createdAt' }),
      type: 'datetime'
    }
  ];
};

module.exports = getColumns;
