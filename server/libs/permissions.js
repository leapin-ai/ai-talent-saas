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
              name: '发布',
              code: 'publish'
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
              name: '关联用户',
              code: 'link-user'
            },
            {
              name: '删除',
              code: 'remove'
            }
          ]
        },
        {
          name: '员工档案',
          code: 'employee-archive',
          modules: [
            {
              name: '个人信息',
              code: 'header',
              permissions: [
                {
                  name: '显示',
                  code: 'view'
                }
              ]
            },
            {
              name: '优势',
              code: 'advantages',
              permissions: [
                {
                  name: '显示',
                  code: 'view'
                }
              ]
            },
            {
              name: '任职时长',
              code: 'duration',
              permissions: [
                {
                  name: '显示',
                  code: 'view'
                }
              ]
            },
            {
              name: '证书与执照',
              code: 'certificates',
              permissions: [
                {
                  name: '显示',
                  code: 'view'
                }
              ]
            },
            {
              name: '晋升历史',
              code: 'promotion-history',
              permissions: [
                {
                  name: '显示',
                  code: 'view'
                }
              ]
            },
            {
              name: '技能指标',
              code: 'skill-metrics',
              permissions: [
                {
                  name: '显示',
                  code: 'view'
                }
              ]
            },
            {
              name: '意向岗位',
              code: 'target-position',
              permissions: [
                {
                  name: '显示',
                  code: 'view'
                }
              ]
            },
            {
              name: '流动性偏好',
              code: 'mobility-preference',
              permissions: [
                {
                  name: '显示',
                  code: 'view'
                }
              ]
            },
            {
              name: '兴趣爱好',
              code: 'hobbies',
              permissions: [
                {
                  name: '显示',
                  code: 'view'
                }
              ]
            },
            {
              name: '绩效评价',
              code: 'performance-review',
              permissions: [
                {
                  name: '显示',
                  code: 'view'
                }
              ]
            },
            {
              name: 'AI职业成长规划',
              code: 'career-plan',
              permissions: [
                {
                  name: '显示',
                  code: 'view'
                }
              ]
            },
            {
              name: 'AI 推荐',
              code: 'ai-recommend',
              permissions: [
                {
                  name: '显示',
                  code: 'view'
                }
              ]
            }
          ]
        }
      ]
    },
    {
      name: '设置',
      code: 'setting',
      modules: []
    },
    {
      name: '员工端',
      code: 'tenant-user',
      modules: []
    }
  ]
};
