module.exports = ({ DataTypes, options }) => {
  return {
    model: {
      sourceType: {
        type: DataTypes.STRING(32),
        allowNull: false,
        comment: 'cv|linkedin|ai_interview|project|certification|jd|performance|external'
      },
      title: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: ''
      },
      summary: {
        type: DataTypes.TEXT
      },
      fileId: {
        type: DataTypes.STRING,
        allowNull: true
      },
      uri: {
        type: DataTypes.STRING,
        allowNull: true
      },
      confidence: {
        type: DataTypes.STRING(16),
        allowNull: true
      },
      capturedAt: {
        type: DataTypes.DATE,
        allowNull: true
      }
    },
    associate: ({ evidenceItem, employee }) => {
      evidenceItem.belongsTo(employee, { allowNull: false });
      evidenceItem.belongsTo(options.getTenantModels().tenant, { allowNull: false });
    },
    options: {
      comment: '员工证据',
      indexes: [
        {
          name: 't_evidence_item_emp_source',
          fields: ['tenant_id', 'employee_id', 'source_type'],
          where: { deleted_at: null }
        }
      ]
    }
  };
};
