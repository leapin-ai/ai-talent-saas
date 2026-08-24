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
        comment: 'pending|interviewing|generating',
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
          fields: ['tenantId', 'tenantUserId'],
          unique: true
        }
      ]
    }
  };
};
