module.exports = ({ DataTypes, definePrimaryType }) => {
  return {
    model: {
      relationType: {
        type: DataTypes.ENUM('ESSENTIAL', 'OPTIONAL'),
        comment: '关系类型: ESSENTIAL(必需), OPTIONAL(可选)'
      },
      originalSkillId: definePrimaryType('originalSkillId', {
        comment: '原始技能ID'
      }),
      relatedSkillId: definePrimaryType('relatedSkillId', {
        comment: '相关技能ID'
      }),
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
    associate: ({ skill, skillRelation }) => {
      skillRelation.belongsTo(skill, {
        foreignKey: 'originalSkillId',
        as: 'originalSkill'
      });
      skillRelation.belongsTo(skill, {
        foreignKey: 'relatedSkillId',
        as: 'relatedSkill'
      });
    },
    options: {
      comment: '技能-技能关联表',
      indexes: [
        {
          fields: ['relation_type'],
          where: {
            deleted_at: null
          }
        }
      ]
    }
  };
};
