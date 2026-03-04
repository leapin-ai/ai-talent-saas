module.exports = ({ DataTypes, definePrimaryType }) => {
  return {
    model: {
      type: {
        type: DataTypes.ENUM('KNOWLEDGE', 'SKILL', 'COMPETENCE', 'SKILL_COMPETENCE'),
        comment: '技能类型: KNOWLEDGE(知识), SKILL(技能), COMPETENCE(能力), SKILL_COMPETENCE(技能/能力)'
      },
      level: {
        type: DataTypes.ENUM('CROSS_SECTOR', 'SECTOR_SPECIFIC', 'OCCUPATION_SPECIFIC', 'TRANSVERSAL'),
        comment: '复用级别: CROSS_SECTOR(跨行业), SECTOR_SPECIFIC(行业特定), OCCUPATION_SPECIFIC(职业特定), TRANSVERSAL(通用)'
      },
      preferredLabel: {
        type: DataTypes.TEXT,
        comment: '首选标签（技能名称）'
      },
      altLabels: {
        type: DataTypes.JSONB,
        comment: '替代标签（别名列表）'
      },
      hiddenLabels: {
        type: DataTypes.JSONB,
        comment: '隐藏标签'
      },
      modifiedDate: {
        type: DataTypes.DATE,
        comment: '修改日期'
      },
      scopeNote: {
        type: DataTypes.TEXT,
        comment: '范围说明'
      },
      definition: {
        type: DataTypes.TEXT,
        comment: '定义'
      },
      description: {
        type: DataTypes.TEXT,
        comment: '描述'
      },
      language: {
        type: DataTypes.STRING,
        comment: '语言',
        defaultValue: 'en-US'
      },
      targetId: definePrimaryType('targetId', {
        type: DataTypes.STRING,
        comment: '目标ID'
      }),
      conceptType: {
        type: DataTypes.ENUM('SkillGroup', 'KnowledgeSkillCompetence')
      },
      skillType: {
        type: DataTypes.ENUM('KNOWLEDGE', 'SKILL_COMPETENCE')
      },
      broaderPath: {
        type: DataTypes.JSONB,
        comment: '上级技能路径',
        defaultValue: []
      },
      broaderId: definePrimaryType('broaderId', {
        comment: '上级技能ID',
        defaultValue: null
      })
    },
    associate: ({ skill }) => {
      skill.belongsTo(skill, {
        foreignKey: 'broaderId',
        as: 'broader'
      });
    },
    options: {
      comment: 'ESCO技能表',
      indexes: [
        {
          fields: ['type'],
          where: {
            deleted_at: null
          }
        },
        {
          fields: ['level'],
          where: {
            deleted_at: null
          }
        },
        {
          fields: ['preferred_label'],
          where: {
            deleted_at: null
          }
        }
      ]
    }
  };
};
