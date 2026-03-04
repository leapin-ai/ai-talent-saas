module.exports = ({ DataTypes, definePrimaryType, options }) => {
  return {
    model: {
      date: {
        type: DataTypes.DATE,
        comment: '绩效提交时间',
        allowNull: false
      },
      score: {
        type: DataTypes.DECIMAL(4, 0),
        comment: '绩效分数',
        allowNull: false
      },
      //评价人
      evaluatorId: definePrimaryType('evaluatorId', {
        comment: '评价人租户用户ID'
      }),
      evaluatorName: {
        type: DataTypes.STRING,
        comment: '评价人姓名',
        allowNull: false
      },
      comment: {
        type: DataTypes.TEXT,
        comment: '绩效评价'
      }
    },
    associate: ({ performance, employee }) => {
      performance.belongsTo(employee);
      performance.belongsTo(options.getTenantModels().tenant);
      performance.belongsTo(options.getTenantModels().tenantUser, {
        foreignKey: 'evaluatorId',
        allowNull: false
      });
    },
    options: {
      comment: '绩效评价'
    }
  };
};
