module.exports = ({ DataTypes, options }) => {
  return {
    model: {
      activityGroup: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: '',
        comment: '活动分组，如 A01'
      },
      sortOrder: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: '排序'
      },
      title: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: '任务标题'
      },
      description: {
        type: DataTypes.TEXT,
        comment: '任务描述'
      },
      importanceNow: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1,
        comment: '当前重要性 1-5'
      },
      importanceFuture: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1,
        comment: '未来重要性 1-5'
      },
      changeTag: {
        type: DataTypes.STRING(32),
        allowNull: false,
        defaultValue: 'stable',
        comment: 'critical_to_build|ai_emerging|new|increasing|stable|decreasing'
      },
      confidence: {
        type: DataTypes.STRING(16),
        allowNull: false,
        defaultValue: 'medium',
        comment: 'high|medium|low'
      },
      workforceAction: {
        type: DataTypes.STRING(16),
        allowNull: true,
        comment: 'BUILD|MOVE|BUY|AUGMENT'
      },
      detail: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: {},
        comment: 'whyToday, whyFuture, citations'
      }
    },
    associate: ({ positionTask, position }) => {
      positionTask.belongsTo(position, { allowNull: false, onDelete: 'CASCADE' });
      positionTask.belongsTo(options.getTenantModels().tenant, { allowNull: false });
    },
    options: {
      comment: '岗位任务（Role Insights）',
      indexes: [
        {
          name: 't_position_task_pos_sort',
          fields: ['tenant_id', 'position_id', 'sort_order'],
          where: { deleted_at: null }
        },
        {
          name: 't_position_task_change_tag',
          fields: ['tenant_id', 'change_tag'],
          where: { deleted_at: null }
        },
        {
          name: 't_position_task_activity',
          fields: ['tenant_id', 'activity_group'],
          where: { deleted_at: null }
        }
      ]
    }
  };
};
