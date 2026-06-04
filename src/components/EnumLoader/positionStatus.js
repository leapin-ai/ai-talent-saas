const positionStatus = () => {
  return [
    { value: 'draft', description: '草稿', type: 'default' },
    { value: 'published', description: '已发布', type: 'success' },
    { value: 'closed', description: '已关闭', type: 'danger' }
  ];
};

export const createPositionStatus = formatMessage => () => [
  { value: 'draft', description: formatMessage({ id: 'enumLoader.positionStatusDraft' }), type: 'default' },
  { value: 'published', description: formatMessage({ id: 'enumLoader.positionStatusPublished' }), type: 'success' },
  { value: 'closed', description: formatMessage({ id: 'enumLoader.positionStatusClosed' }), type: 'danger' }
];

export default positionStatus;
