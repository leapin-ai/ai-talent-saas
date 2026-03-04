module.exports = ({ DataTypes }) => {
  return {
    model: {
      originalSkillUri: {
        type: DataTypes.TEXT,
        comment: '原始技能URI'
      },
      originalSkillType: {
        type: DataTypes.ENUM('KNOWLEDGE', 'SKILL', 'COMPETENCE', 'SKILL_COMPETENCE'),
        comment: '原始技能类型: KNOWLEDGE(知识), SKILL(技能), COMPETENCE(能力), SKILL_COMPETENCE(技能/能力)'
      },
      relationType: {
        type: DataTypes.ENUM('ESSENTIAL', 'OPTIONAL'),
        comment: '关系类型: ESSENTIAL(必需), OPTIONAL(可选)'
      },
      relatedSkillType: {
        type: DataTypes.ENUM('KNOWLEDGE', 'SKILL', 'COMPETENCE', 'SKILL_COMPETENCE'),
        comment: '相关技能类型: KNOWLEDGE(知识), SKILL(技能), COMPETENCE(能力), SKILL_COMPETENCE(技能/能力)'
      },
      relatedSkillUri: {
        type: DataTypes.TEXT,
        comment: '相关技能URI'
      }
    },
    associate: () => {
      // 技能-技能关联模型与其他模型的关联关系
    },
    options: {
      comment: '技能-技能关联表',
      indexes: [
        {
          fields: ['original_skill_uri']
        },
        {
          fields: ['related_skill_uri']
        },
        {
          fields: ['relation_type']
        }
      ]
    }
  };
};
