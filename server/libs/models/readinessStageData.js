module.exports = ({ DataTypes, definePrimaryType, options }) => {
  return {
    model: {
      runId: definePrimaryType('runId', {
        comment: '流程ID',
        allowNull: false
      }),
      personId: definePrimaryType('personId', {
        comment: '参与人ID，Role 级阶段为空',
        allowNull: true
      }),
      stage: {
        type: DataTypes.STRING(32),
        comment: '阶段',
        allowNull: false
      },
      version: {
        type: DataTypes.INTEGER,
        comment: '版本号，同一 run+person+stage 自增',
        allowNull: false,
        defaultValue: 1
      },
      isCurrent: {
        type: DataTypes.BOOLEAN,
        comment: '是否当前版本',
        allowNull: false,
        defaultValue: true
      },
      status: {
        type: DataTypes.STRING(16),
        comment: 'running|succeeded|failed|superseded',
        allowNull: false,
        defaultValue: 'running'
      },
      source: {
        type: DataTypes.STRING(16),
        comment: 'api|manual',
        allowNull: false,
        defaultValue: 'api'
      },
      input: {
        type: DataTypes.JSONB,
        comment: '输入（API 为 {path, params}）',
        defaultValue: {}
      },
      output: {
        type: DataTypes.JSONB,
        comment: '输出',
        defaultValue: null
      },
      taskId: {
        type: DataTypes.STRING,
        comment: 'Readiness 任务ID'
      },
      error: {
        type: DataTypes.TEXT,
        comment: '错误信息'
      },
      operatorId: definePrimaryType('operatorId', {
        comment: '人工操作人',
        allowNull: true
      })
    },
    associate: ({ readinessStageData }) => {
      readinessStageData.belongsTo(options.getTenantModels().tenant, { allowNull: false });
    },
    options: {
      comment: 'Readiness 阶段数据（版本化）',
      indexes: [
        { fields: ['run_id', 'stage', 'person_id'], where: { deleted_at: null } },
        { fields: ['task_id'], where: { deleted_at: null } }
      ]
    }
  };
};
