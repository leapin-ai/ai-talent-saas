module.exports = ({ DataTypes, definePrimaryType }) => {
  return {
    model: {
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
    associate: ({ occupation, occupationGroup }) => {
      occupation.belongsTo(occupationGroup, {
        foreignKey: 'iscoGroupId',
        as: 'iscoGroup'
      });
    },
    options: {
      comment: 'ESCO职业表',
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
