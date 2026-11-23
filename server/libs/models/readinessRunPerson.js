module.exports = ({ DataTypes, definePrimaryType, options }) => {
  return {
    model: {
      runId: definePrimaryType('runId', {
        comment: '流程ID',
        allowNull: false
      }),
      employeeId: definePrimaryType('employeeId', {
        comment: '员工ID',
        allowNull: true
      }),
      name: {
        type: DataTypes.STRING,
        comment: '姓名',
        defaultValue: ''
      },
      email: {
        type: DataTypes.STRING,
        comment: '邮箱',
        defaultValue: ''
      },
      respondentType: {
        type: DataTypes.STRING(16),
        comment: 'employee|line_manager',
        defaultValue: 'employee',
        allowNull: false
      },
      materials: {
        type: DataTypes.JSONB,
        comment: '材料 resume/projects/reviews',
        defaultValue: {}
      },
      stage: {
        type: DataTypes.STRING(32),
        comment: 'Person 当前阶段；pending 表示员工卷尚未发送',
        defaultValue: 'pending',
        allowNull: false
      },
      status: {
        type: DataTypes.STRING(16),
        comment: 'pending|running|blocked|failed|done',
        defaultValue: 'pending',
        allowNull: false
      },
      profileCompletionPct: {
        type: DataTypes.INTEGER,
        comment: '档案完整度 0-100',
        allowNull: true
      }
    },
    associate: ({ readinessRunPerson }) => {
      readinessRunPerson.belongsTo(options.getTenantModels().tenant, { allowNull: false });
    },
    options: {
      comment: 'Readiness 流程参与人',
      indexes: [{ fields: ['tenant_id', 'run_id'], where: { deleted_at: null } }]
    }
  };
};
