module.exports = ({ DataTypes, definePrimaryType, options }) => {
  return {
    model: {
      name: {
        type: DataTypes.STRING,
        comment: '名称',
        allowNull: false
      },
      description: {
        type: DataTypes.TEXT,
        comment: '岗位描述'
      },
      requirement: {
        type: DataTypes.TEXT,
        comment: '岗位要求'
      },
      language: {
        type: DataTypes.ENUM('zh-CN', 'en-US'),
        comment: '语言要求'
      },
      locationType: {
        type: DataTypes.ENUM('on-site', 'remote'),
        comment: '工作地点类型'
      },
      location: {
        type: DataTypes.JSON,
        comment: '工作地点'
      },
      capacity: {
        type: DataTypes.STRING,
        comment: '职能'
      },
      skill: {
        type: DataTypes.JSON,
        comment: '所需技能'
      },
      verdict: {
        type: DataTypes.JSON,
        comment: '技能洞察结论（The Verdict）'
      },
      salary: {
        type: DataTypes.JSON,
        comment: '薪资'
      },
      status: {
        type: DataTypes.ENUM('draft', 'published', 'closed'),
        comment: '状态'
      },
      publishAt: {
        type: DataTypes.DATE,
        comment: '发布时间'
      },
      analysisStatus: {
        type: DataTypes.STRING(32),
        allowNull: false,
        defaultValue: 'idle',
        comment: 'AI岗位分析状态 idle|generating|completed（独立于发布状态）'
      },
      analysisProgress: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: 'AI岗位分析进度 0-100'
      },
      analysisTaskId: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: 'AI岗位分析手动任务ID'
      },
      changeMagnitude: {
        type: DataTypes.STRING(16),
        allowNull: false,
        defaultValue: 'low',
        comment: '岗位变化幅度 low|medium|high（由 skill.change 汇总）'
      }
    },
    associate: ({ position }) => {
      position.belongsTo(options.getTenantModels().tenant, {
        allowNull: false
      });
      position.belongsTo(options.getTenantModels().tenantOrg, {
        allowNull: true
      });
    },
    options: {
      comment: '岗位信息',
      indexes: [
        {
          fields: ['name'],
          where: {
            deleted_at: null
          }
        },
        {
          fields: ['tenant_org_id'],
          where: {
            deleted_at: null
          }
        }
      ]
    }
  };
};
