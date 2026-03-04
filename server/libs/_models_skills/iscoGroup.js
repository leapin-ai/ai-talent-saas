module.exports = ({ DataTypes }) => {
  return {
    model: {
      conceptUri: {
        type: DataTypes.TEXT,
        comment: 'ISCO分组URI'
      },
      conceptType: {
        type: DataTypes.STRING,
        comment: '概念类型'
      },
      code: {
        type: DataTypes.STRING,
        comment: 'ISCO代码'
      },
      preferredLabel: {
        type: DataTypes.TEXT,
        comment: '首选标签（ISCO职业分类名称）'
      },
      status: {
        type: DataTypes.STRING,
        comment: '状态'
      },
      altLabels: {
        type: DataTypes.JSONB,
        comment: '替代标签（别名列表）'
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
      // ISCO分组模型与其他模型的关联关系
    },
    options: {
      comment: 'ISCO分组表',
      indexes: [
        {
          fields: ['code']
        },
        {
          fields: ['preferred_label']
        }
      ]
    }
  };
};
