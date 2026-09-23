module.exports = ({ DataTypes, options }) => {
  return {
    model: {
      reason: {
        type: DataTypes.STRING(64),
        allowNull: false,
        comment: 'level_too_low|level_too_high|evidence_incorrect|requirement_incorrect|other'
      },
      comment: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: '补充说明'
      },
      taskTitle: {
        type: DataTypes.STRING(255),
        allowNull: true,
        comment: '反馈时任务标题快照'
      },
      activityGroup: {
        type: DataTypes.STRING(200),
        allowNull: true,
        comment: '反馈时活动分组快照'
      },
      taskId: {
        type: DataTypes.BIGINT,
        allowNull: true,
        comment: '关联岗位任务（可空）'
      },
      positionId: {
        type: DataTypes.BIGINT,
        allowNull: true,
        comment: '关联岗位'
      },
      current: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: '反馈时当前水平快照 0-5'
      },
      required: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: '反馈时要求水平快照 0-5'
      },
      readinessStatus: {
        type: DataTypes.STRING(16),
        allowNull: true,
        comment: '反馈时就绪状态快照 critical|gap|onTarget|above'
      },
      confidence: {
        type: DataTypes.STRING(16),
        allowNull: true,
        comment: '反馈时置信度快照'
      },
      reportedBy: {
        type: DataTypes.BIGINT,
        allowNull: true,
        comment: '提交人 tenant_user id'
      },
      status: {
        type: DataTypes.STRING(16),
        allowNull: false,
        defaultValue: 'open',
        comment: 'open|resolved|closed'
      },
      resolvedAt: {
        type: DataTypes.DATE,
        allowNull: true
      },
      resolvedBy: {
        type: DataTypes.BIGINT,
        allowNull: true,
        comment: '处理人 tenant_user id'
      },
      resolveNote: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: '处理备注'
      }
    },
    associate: ({ readinessIssue, employee, position, positionTask }) => {
      readinessIssue.belongsTo(employee, { allowNull: false });
      readinessIssue.belongsTo(position, { allowNull: true });
      readinessIssue.belongsTo(positionTask, { foreignKey: 'taskId', allowNull: true, onDelete: 'SET NULL' });
      readinessIssue.belongsTo(options.getTenantModels().tenant, { allowNull: false });
    },
    options: {
      comment: '未来任务就绪纠错反馈（It does not look right）',
      indexes: [
        {
          name: 't_readiness_issue_emp',
          fields: ['tenant_id', 'employee_id'],
          where: { deleted_at: null }
        },
        {
          name: 't_readiness_issue_pos',
          fields: ['tenant_id', 'position_id'],
          where: { deleted_at: null }
        },
        {
          name: 't_readiness_issue_task',
          fields: ['tenant_id', 'task_id'],
          where: { deleted_at: null }
        },
        {
          name: 't_readiness_issue_status',
          fields: ['tenant_id', 'status'],
          where: { deleted_at: null }
        }
      ]
    }
  };
};
