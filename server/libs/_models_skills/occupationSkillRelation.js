module.exports = ({ DataTypes }) => {
  return {
    model: {
      occupationUri: {
        type: DataTypes.TEXT,
        comment: '职业URI'
      },
      occupationLabel: {
        type: DataTypes.TEXT,
        comment: '职业名称'
      },
      skillUri: {
        type: DataTypes.TEXT,
        comment: '技能URI'
      },
      skillLabel: {
        type: DataTypes.TEXT,
        comment: '技能名称'
      },
      skillType: {
        type: DataTypes.ENUM('KNOWLEDGE', 'SKILL', 'COMPETENCE', 'SKILL_COMPETENCE'),
        comment: '技能类型: KNOWLEDGE(知识), SKILL(技能), COMPETENCE(能力), SKILL_COMPETENCE(技能/能力)'
      },
      relationType: {
        type: DataTypes.ENUM('ESSENTIAL', 'OPTIONAL'),
        comment: '关系类型: ESSENTIAL(必需), OPTIONAL(可选)'
      }
    },
    associate: () => {
      // 职业-技能关联模型与其他模型的关联关系
    },
    options: {
      comment: '职业-技能关联表',
      indexes: [
        {
          fields: ['occupation_uri']
        },
        {
          fields: ['skill_uri']
        },
        {
          fields: ['relation_type']
        }
      ]
    }
  };
};
