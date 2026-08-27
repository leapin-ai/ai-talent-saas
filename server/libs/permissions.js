module.exports = {
  modules: [
    {
      name: '管理端',
      code: 'tenant-admin',
      modules: [
        {
          name: '首页',
          code: 'home',
          permissions: [
            {
              name: '查看',
              code: 'view'
            },
            {
              name: '完善档案',
              code: 'complete-profile'
            }
          ]
        },
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
          name: '角色分析',
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
          name: '员工',
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
      name: '设置',
      code: 'setting',
      modules: [
        {
          name: '首页设置',
          code: 'home-setting',
          permissions: [
            {
              name: '查看',
              code: 'view'
            },
            {
              name: '编辑',
              code: 'edit'
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
