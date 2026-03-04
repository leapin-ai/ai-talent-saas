module.exports = ({ DataTypes }) => {
  return {
    model: {
      conceptUri: {
        type: DataTypes.TEXT,
        comment: '技能URI'
      },
      conceptType: {
        type: DataTypes.STRING,
        comment: '概念类型'
      },
      skillType: {
        type: DataTypes.ENUM('KNOWLEDGE', 'SKILL', 'COMPETENCE', 'SKILL_COMPETENCE'),
        comment: '技能类型: KNOWLEDGE(知识), SKILL(技能), COMPETENCE(能力), SKILL_COMPETENCE(技能/能力)'
      },
      reuseLevel: {
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
      status: {
        type: DataTypes.STRING,
        comment: '状态'
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
      inScheme: {
        type: DataTypes.JSONB,
        comment: '所属方案'
      },
      description: {
        type: DataTypes.TEXT,
        comment: '描述'
      }
    },
    associate: () => {
      // 技能模型与其他模型的关联关系
    },
    options: {
      comment: 'ESCO技能表',
      indexes: [
        {
          fields: ['skill_type']
        },
        {
          fields: ['reuse_level']
        },
        {
          fields: ['preferred_label']
        }
      ]
    }
  };
};
