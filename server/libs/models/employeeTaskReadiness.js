module.exports = ({ DataTypes, options }) => {
  return {
    model: {
      current: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: '当前水平 0-5'
      },
      required: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: '要求水平 0-5'
      },
      status: {
        type: DataTypes.STRING(16),
        allowNull: false,
        defaultValue: 'gap',
        comment: 'critical|gap|onTarget|above'
      },
      confidence: {
        type: DataTypes.STRING(16),
        allowNull: false,
        defaultValue: 'medium',
        comment: 'high|medium|low'
      }
    },
    associate: ({ employeeTaskReadiness, employee, position, positionTask }) => {
      employeeTaskReadiness.belongsTo(employee, { allowNull: false });
      employeeTaskReadiness.belongsTo(position, { allowNull: false });
      employeeTaskReadiness.belongsTo(positionTask, { foreignKey: 'taskId', allowNull: false, onDelete: 'CASCADE' });
      employeeTaskReadiness.belongsTo(options.getTenantModels().tenant, { allowNull: false });
    },
    options: {
      comment: '员工×任务就绪',
      indexes: [
        {
          name: 't_employee_task_readiness_unique',
          fields: ['tenant_id', 'employee_id', 'task_id'],
          unique: true,
          where: { deleted_at: null }
        },
        {
          name: 't_employee_task_readiness_pos_emp',
          fields: ['tenant_id', 'position_id', 'employee_id'],
          where: { deleted_at: null }
        }
      ]
    }
  };
};
