module.exports = ({ DataTypes, definePrimaryType, options }) => {
  return {
    model: {
      positionId: definePrimaryType('positionId', {
        comment: '关联岗位ID',
        allowNull: true
      }),
      roleName: {
        type: DataTypes.STRING,
        comment: '岗位名称',
        allowNull: false
      },
      language: {
        type: DataTypes.ENUM('zh-CN', 'en-US'),
        comment: '语言',
        defaultValue: 'zh-CN'
      },
      jd: {
        type: DataTypes.TEXT,
        comment: '岗位 JD 全文',
        allowNull: false
      },
      hasStaffQuestionnaire: {
        type: DataTypes.BOOLEAN,
        comment: '是否有员工卷',
        defaultValue: true,
        allowNull: false
      },
      managerRecipients: {
        type: DataTypes.JSONB,
        comment: '新建时预选的经理收件人 [{ tenantUserId, name, email, employeeId? }]',
        allowNull: false,
        defaultValue: []
      },
      stage: {
        type: DataTypes.STRING(32),
        comment: 'Role 当前阶段',
        defaultValue: 'draft',
        allowNull: false
      },
      status: {
        type: DataTypes.STRING(16),
        comment: 'running|blocked|failed|done|canceled',
        defaultValue: 'running',
        allowNull: false
      },
      createdUserId: definePrimaryType('createdUserId', {
        comment: '创建人',
        allowNull: true
      })
    },
    associate: ({ readinessRun }) => {
      readinessRun.belongsTo(options.getTenantModels().tenant, { allowNull: false });
    },
    options: {
      comment: 'Readiness 流程（一个 Role 一次评估）',
      indexes: [{ fields: ['tenant_id', 'status'], where: { deleted_at: null } }]
    }
  };
};
