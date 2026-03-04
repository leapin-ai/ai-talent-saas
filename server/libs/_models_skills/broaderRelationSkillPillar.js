module.exports = ({ DataTypes }) => {
  return {
    model: {
      conceptType: {
        type: DataTypes.STRING,
        comment: '概念类型'
      },
      conceptUri: {
        type: DataTypes.TEXT,
        comment: '子技能URI'
      },
      conceptLabel: {
        type: DataTypes.TEXT,
        comment: '子技能名称'
      },
      broaderType: {
        type: DataTypes.STRING,
        comment: '父级类型'
      },
      broaderUri: {
        type: DataTypes.TEXT,
        comment: '父级URI'
      },
      broaderLabel: {
        type: DataTypes.TEXT,
        comment: '父级名称'
      }
    },
    associate: () => {
      // 技能层级关系模型与其他模型的关联关系
    },
    options: {
      comment: '技能层级关系表',
      indexes: [
        {
          fields: ['concept_uri']
        },
        {
          fields: ['broader_uri']
        }
      ]
    }
  };
};
