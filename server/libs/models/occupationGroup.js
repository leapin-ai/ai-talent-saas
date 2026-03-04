module.exports = ({ DataTypes, definePrimaryType }) => {
  return {
    model: {
      label: {
        type: DataTypes.TEXT,
        comment: '名称'
      },
      broaderGroupPath: {
        type: DataTypes.JSONB,
        comment: '上级职业组路径',
        defaultValue: []
      },
      broaderGroupId: {
        type: definePrimaryType('broaderGroupId', {
          comment: '上级职业组ID',
          defaultValue: null
        })
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
    associate: ({ occupationGroup }) => {
      occupationGroup.belongsTo(occupationGroup, {
        foreignKey: 'broaderGroupId',
        as: 'broaderGroup'
      });
    },
    options: {
      comment: '职业层级关系表'
    }
  };
};
