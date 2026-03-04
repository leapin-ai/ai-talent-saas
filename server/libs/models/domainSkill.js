module.exports = ({ DataTypes, definePrimaryType }) => {
  return {
    model: {
      type: {
        type: DataTypes.ENUM('DIGITAL_SKILLS', 'GREEN_SKILLS', 'TRANSVERSAL_SKILLS', 'LANGUAGE_SKILLS', 'NUMERIC_TALENT_SKILLS', 'RESEARCH_SKILLS'),
        comment: '类型: DIGITAL_SKILLS(数字技能集合), GREEN_SKILLS(绿色技能集合), TRANSVERSAL_SKILLS(通用技能集合), LANGUAGE_SKILLS(语言技能集合), NUMERIC_TALENT_SKILLS(数字素养技能集合), RESEARCH_SKILLS(研究技能集合)'
      },
      language: {
        type: DataTypes.STRING,
        comment: '语言',
        defaultValue: 'en-US'
      },
      targetId: definePrimaryType('targetId', {
        type: DataTypes.STRING,
        comment: '目标ID'
      })
    },
    associate: ({ domainSkill, skill }) => {
      domainSkill.belongsTo(skill);
    },
    options: {
      comment: '专题技能集合',
      indexes: [
        {
          fields: ['type'],
          where: {
            deleted_at: null
          }
        }
      ]
    }
  };
};
