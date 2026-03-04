module.exports = ({ DataTypes, options }) => {
  return {
    model: {
      //优势
      advantage: {
        type: DataTypes.JSONB,
        comment: '优势',
        defaultValue: []
      },
      promotionHistory: {
        type: DataTypes.JSONB,
        comment: '晋升历史',
        defaultValue: []
      },
      skills: {
        type: DataTypes.JSONB,
        comment: '技能',
        defaultValue: []
      },
      aiInterviewReport: {
        type: DataTypes.JSONB,
        comment: 'AI面试报告',
        defaultValue: {}
      },
      //意向岗位
      intentionPosition: {
        type: DataTypes.JSONB,
        comment: '意向岗位',
        defaultValue: []
      },
      workPreference: {
        type: DataTypes.JSONB,
        comment: '工作偏好',
        defaultValue: {}
      },
      options: {
        type: DataTypes.JSONB,
        comment: '其他信息'
      }
    },
    associate: ({ profile, employee }) => {
      profile.belongsTo(employee);
      profile.belongsTo(options.getTenantModels().tenant);
    },
    options: {
      comment: '员工档案'
    }
  };
};
