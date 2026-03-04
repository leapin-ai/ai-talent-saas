module.exports = ({ DataTypes }) => {
  return {
    model: {
      conceptType: {
        type: DataTypes.STRING,
        comment: '概念类型'
      },
      conceptUri: {
        type: DataTypes.TEXT,
        comment: '职业URI'
      },
      preferredLabel: {
        type: DataTypes.TEXT,
        comment: '首选标签'
      },
      status: {
        type: DataTypes.STRING,
        comment: '状态'
      },
      altLabels: {
        type: DataTypes.JSONB,
        comment: '替代标签'
      },
      description: {
        type: DataTypes.TEXT,
        comment: '描述'
      },
      broaderConceptUri: {
        type: DataTypes.TEXT,
        comment: '父级概念URI'
      },
      broaderConceptPT: {
        type: DataTypes.TEXT,
        comment: '父级概念首选术语'
      }
    },
    associate: () => {
      // 研究职业集合模型与其他模型的关联关系
    },
    options: {
      comment: '研究职业集合表'
    }
  };
};
