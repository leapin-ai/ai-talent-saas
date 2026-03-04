module.exports = ({ DataTypes, options }) => {
  return {
    model: {
      shortTerm: {
        type: DataTypes.JSONB,
        comment: '短期(12 个月)'
      },
      longTerm: {
        type: DataTypes.JSONB,
        comment: '长期'
      },
      matchPosition: {
        type: DataTypes.JSONB,
        comment: '匹配的职位'
      }
    },
    associate: ({ aiSuggest, employee }) => {
      aiSuggest.belongsTo(options.getTenantModels().tenant);
      aiSuggest.belongsTo(employee);
    },
    options: {
      comment: 'AI推荐'
    }
  };
};
