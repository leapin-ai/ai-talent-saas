module.exports = ({ DataTypes, options }) => {
  return {
    model: {
      readiness: {
        type: DataTypes.INTEGER,
        comment: '就绪度 0-100',
        defaultValue: null
      },
      summary: {
        type: DataTypes.TEXT,
        comment: '分析摘要',
        defaultValue: ''
      },
      metrics: {
        type: DataTypes.JSONB,
        comment: '指标 { criticalGaps, atOrAbove, monthsToClose }',
        defaultValue: {}
      },
      skills: {
        type: DataTypes.JSONB,
        comment: '技能对比列表 [{ id, name, current, required, status?, evidence? }]',
        defaultValue: []
      },
      priorityGaps: {
        type: DataTypes.JSONB,
        comment: '优先差距 [{ rank, title, description, current?, required? }]',
        defaultValue: []
      },
      developmentPlan: {
        type: DataTypes.JSONB,
        comment: '发展计划 { subtitle, horizons: [{ label, period, title, tone, items, target }] }',
        defaultValue: null
      }
    },
    associate: ({ positionEmployeeSkillAnalysis, employee, position }) => {
      positionEmployeeSkillAnalysis.belongsTo(employee, {
        allowNull: false
      });
      positionEmployeeSkillAnalysis.belongsTo(position, {
        allowNull: false
      });
      positionEmployeeSkillAnalysis.belongsTo(options.getTenantModels().tenant, {
        allowNull: false
      });
    },
    options: {
      comment: '岗位内员工技能分析',
      indexes: [
        {
          // 须显式短 name：自动生成名超 PG 63 字符会被截断，sync 会与已有索引冲突
          name: 't_position_employee_skill_analysis_unique',
          // underscored: true 时索引 fields 须写库内真实列名
          fields: ['tenant_id', 'employee_id', 'position_id'],
          unique: true,
          where: {
            deleted_at: null
          }
        }
      ]
    }
  };
};
