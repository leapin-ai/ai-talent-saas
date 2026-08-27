module.exports = ({ DataTypes, definePrimaryType, options }) => {
  return {
    model: {
      tenantUserId: definePrimaryType('tenantUserId', {
        comment: '租户用户ID',
        allowNull: false
      }),
      profileData: {
        type: DataTypes.JSONB,
        comment: '完善档案提交的信息',
        defaultValue: {}
      },
      status: {
        type: DataTypes.STRING,
        comment: 'pending|interviewing|generating|submitted|approved|closed',
        defaultValue: 'pending',
        allowNull: false
      },
      projectId: {
        type: DataTypes.STRING,
        comment: 'AI面试项目ID'
      },
      projectName: {
        type: DataTypes.STRING,
        comment: 'AI面试项目名称'
      },
      inviteId: {
        type: DataTypes.STRING,
        comment: '邀请记录ID'
      },
      inviteCode: {
        type: DataTypes.STRING,
        comment: '邀请码'
      },
      shorten: {
        type: DataTypes.STRING,
        comment: '免登录 shorten'
      },
      shortenExpiresAt: {
        type: DataTypes.DATE,
        comment: 'shorten 过期时间'
      },
      clientUserId: {
        type: DataTypes.STRING,
        comment: 'AI面试候选人ID'
      },
      interviewData: {
        type: DataTypes.JSONB,
        comment: '面试同步信息',
        defaultValue: {}
      },
      reviewData: {
        type: DataTypes.JSONB,
        comment: '生成任务完成后写入的审核用档案数据',
        defaultValue: {}
      },
      generateTaskId: {
        type: DataTypes.STRING,
        comment: '完善档案生成审核手动任务ID'
      }
    },
    associate: ({ assessment }) => {
      assessment.belongsTo(options.getTenantModels().tenant);
      assessment.belongsTo(options.getTenantModels().tenantUser, {
        foreignKey: 'tenantUserId',
        allowNull: false
      });
    },
    options: {
      comment: 'AI面试评估记录',
      indexes: [
        {
          // underscored: true 时表字段为 snake_case；索引 fields 不会自动转换，须写库内真实列名
          fields: ['tenant_id', 'tenant_user_id'],
          unique: true,
          where: {
            deleted_at: null
          }
        }
      ]
    }
  };
};
