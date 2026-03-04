module.exports = ({ DataTypes }) => {
  return {
    model: {
      conceptUri: {
        type: DataTypes.TEXT,
        comment: '职业URI'
      },
      code: {
        type: DataTypes.STRING,
        comment: 'ISCO代码'
      },
      greenShare: {
        type: DataTypes.DECIMAL(5, 2),
        comment: '绿色技能占比(0-1之间)'
      }
    },
    associate: () => {
      // 绿色职业关联模型与其他模型的关联关系
    },
    options: {
      comment: '绿色职业关联表',
      indexes: [
        {
          fields: ['concept_uri']
        },
        {
          fields: ['code']
        },
        {
          fields: ['green_share']
        }
      ]
    }
  };
};
