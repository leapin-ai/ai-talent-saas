module.exports = ({ DataTypes }) => {
  return {
    model: {
      conceptUri: {
        type: DataTypes.TEXT,
        comment: '技能组URI'
      },
      conceptType: {
        type: DataTypes.STRING,
        comment: '概念类型'
      },
      preferredLabel: {
        type: DataTypes.TEXT,
        comment: '首选标签（技能组名称）'
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
      inScheme: {
        type: DataTypes.JSONB,
        comment: '所属方案'
      },
      description: {
        type: DataTypes.TEXT,
        comment: '描述'
      },
      code: {
        type: DataTypes.STRING,
        comment: '代码'
      }
    },
    associate: () => {
      // 技能组模型与其他模型的关联关系
    },
    options: {
      comment: 'ESCO技能组表',
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
