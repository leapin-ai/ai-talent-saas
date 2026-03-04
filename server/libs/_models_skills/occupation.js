module.exports = ({ DataTypes }) => {
  return {
    model: {
      conceptUri: {
        type: DataTypes.TEXT,
        comment: '职业URI'
      },
      conceptType: {
        type: DataTypes.TEXT,
        comment: '概念类型'
      },
      iscoGroup: {
        type: DataTypes.TEXT,
        comment: 'ISCO职业分类代码'
      },
      preferredLabel: {
        type: DataTypes.TEXT,
        comment: '首选标签（职业名称）'
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
        type: DataTypes.TEXT,
        comment: '状态'
      },
      modifiedDate: {
        type: DataTypes.DATE,
        comment: '修改日期'
      },
      regulatedProfessionNote: {
        type: DataTypes.TEXT,
        comment: '监管职业说明'
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
      },
      code: {
        type: DataTypes.TEXT,
        comment: '职业代码'
      },
      naceCode: {
        type: DataTypes.TEXT,
        comment: 'NACE代码'
      }
    },
    associate: () => {
      // 职业模型与其他模型的关联关系
    },
    options: {
      comment: 'ESCO职业表',
      indexes: [
        {
          fields: ['isco_group']
        },
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
