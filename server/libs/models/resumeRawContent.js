module.exports = ({ DataTypes, options }) => {
  return {
    model: {
      rawContent: {
        type: DataTypes.JSONB,
        comment: '简历解析原始文本信息'
      }
    },
    options: {
      comment: '简历解析原始文本信息'
    }
  };
};
