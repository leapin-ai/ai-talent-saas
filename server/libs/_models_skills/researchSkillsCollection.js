module.exports = ({ DataTypes }) => {
  return {
    model: {
      conceptType: {
        type: DataTypes.STRING,
        comment: '概念类型'
      },
      conceptUri: {
        type: DataTypes.TEXT,
        comment: '技能URI'
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
        comment: '首选标签'
      },
      status: {
        type: DataTypes.STRING,
        comment: '状态'
      },
      altLabels: {
        type: DataTypes.JSONB,
        comment: '替代标签'
      },
      description: {
        type: DataTypes.TEXT,
        comment: '描述'
      },
      broaderConceptUri: {
        type: DataTypes.TEXT,
        comment: '父级概念URI'
      },
      broaderConceptPT: {
        type: DataTypes.TEXT,
        comment: '父级概念首选术语'
      }
    },
    associate: () => {
      // 研究技能集合模型与其他模型的关联关系
    },
    options: {
      comment: '研究技能集合表'
    }
  };
};
