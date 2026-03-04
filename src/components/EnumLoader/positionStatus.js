const positionStatus = () => {
  return [
    { value: 'draft', description: '草稿', type: 'default' },
    { value: 'published', description: '已发布', type: 'success' },
    { value: 'closed', description: '已关闭', type: 'danger' }
  ];
};

export default positionStatus;
