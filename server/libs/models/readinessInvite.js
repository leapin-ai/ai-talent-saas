module.exports = ({ DataTypes, definePrimaryType, options }) => {
  return {
    model: {
      runId: definePrimaryType('runId', {
        comment: '流程ID',
        allowNull: false
      }),
      personId: definePrimaryType('personId', {
        comment: '参与人ID，经理卷为空',
        allowNull: true
      }),
      batchId: definePrimaryType('batchId', {
        comment: '批量发送ID',
        allowNull: true
      }),
      kind: {
        type: DataTypes.STRING(16),
        comment: 'manager|staff|reassess',
        allowNull: false
      },
      questionnaireVersion: {
        type: DataTypes.INTEGER,
        comment: '对应问卷阶段数据版本',
        defaultValue: 1
      },
      name: {
        type: DataTypes.STRING,
        comment: '收件人姓名',
        defaultValue: ''
      },
      email: {
        type: DataTypes.STRING,
        comment: '收件人邮箱',
        defaultValue: ''
      },
      projectId: {
        type: DataTypes.STRING,
        comment: 'AI 面试项目ID'
      },
      collectInviteId: definePrimaryType('collectInviteId', {
        comment: '人才采集邀请 ID（经理/员工走 /collect-profile；AI 面试 shorten 延后到进入面试步）',
        allowNull: true
      }),
      inviteId: {
        type: DataTypes.STRING,
        comment: 'AI 面试邀请ID（采集页 ensureInvite 后写入）'
      },
      shorten: {
        type: DataTypes.STRING,
        comment: 'AI 面试免登录 shorten（采集页 ensureInvite 后写入）'
      },
      url: {
        type: DataTypes.TEXT,
        comment: '免登录链接（经理/员工为 /collect-profile?code=…）'
      },
      expiresAt: {
        type: DataTypes.DATE,
        comment: '链接过期时间'
      },
      status: {
        type: DataTypes.STRING(16),
        comment: 'pending|sent|failed|answered',
        defaultValue: 'pending',
        allowNull: false
      },
      answers: {
        type: DataTypes.JSONB,
        comment: '回收的答卷',
        defaultValue: null
      },
      answeredAt: {
        type: DataTypes.DATE,
        comment: '答卷时间'
      },
      isCurrent: {
        type: DataTypes.BOOLEAN,
        comment: '是否有效（退回重发后旧邀请置为 false）',
        defaultValue: true,
        allowNull: false
      },
      error: {
        type: DataTypes.TEXT,
        comment: '失败原因'
      }
    },
    associate: ({ readinessInvite }) => {
      readinessInvite.belongsTo(options.getTenantModels().tenant, { allowNull: false });
    },
    options: {
      comment: 'Readiness 问卷发送记录',
      indexes: [{ fields: ['tenant_id', 'run_id'], where: { deleted_at: null } }]
    }
  };
};
