module.exports = ({ DataTypes, definePrimaryType, options }) => {
  return {
    model: {
      kind: {
        type: DataTypes.STRING(16),
        comment: 'manager|staff|reassess；confirm:xxx 为确认问卷邮件',
        allowNull: false
      },
      runIds: {
        type: DataTypes.JSONB,
        comment: '涉及的流程',
        defaultValue: []
      },
      recipients: {
        type: DataTypes.JSONB,
        comment: '收件人',
        defaultValue: []
      },
      subject: {
        type: DataTypes.STRING,
        comment: '邮件主题'
      },
      result: {
        type: DataTypes.JSONB,
        comment: '发送结果 success/failed/skipped',
        defaultValue: {}
      },
      createdUserId: definePrimaryType('createdUserId', {
        comment: '发送人',
        allowNull: true
      })
    },
    associate: ({ readinessSendBatch }) => {
      readinessSendBatch.belongsTo(options.getTenantModels().tenant, { allowNull: false });
    },
    options: {
      comment: 'Readiness 批量发送记录'
    }
  };
};
