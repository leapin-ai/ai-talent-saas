module.exports = {
  modules: [
    {
      name: '管理端',
      code: 'tenant-admin',
      modules: [
        {
          name: '内部人才市场',
          code: 'talent-marketplace',
          permissions: [
            {
              name: '查看',
              code: 'view'
            }
          ]
        },
        {
          name: '岗位管理',
          code: 'position-management',
          permissions: [
            {
              name: '创建',
              code: 'create'
            },
            {
              name: '查看',
              code: 'view'
            },
            {
              name: '编辑',
              code: 'edit'
            },
            {
              name: 'AI岗位分析',
              code: 'analyze'
            },
            {
              name: '删除',
              code: 'remove'
            }
          ]
        },
        {
          name: '员工档案',
          code: 'employee-profile',
          permissions: [
            {
              name: '创建',
              code: 'create'
            },
            {
              name: '查看',
              code: 'view'
            },
            {
              name: '编辑',
              code: 'edit'
            },
            {
              name: '删除',
              code: 'remove'
            }
          ]
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
