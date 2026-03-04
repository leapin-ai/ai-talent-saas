module.exports = {
  modules: [
    {
      name: '管理端',
      code: 'tenant-admin',
      modules: [
        {
          name: '内部人才市场',
          code: 'talent-marketplace'
        }
      ]
    },
    {
      name: '员工端',
      code: 'tenant-user',
      modules: []
    }
  ]
};
