module.exports = ({ DataTypes }) => {
  return {
    model: {
      level0Uri: {
        type: DataTypes.TEXT,
        comment: 'Level 0技能URI'
      },
      level0PreferredTerm: {
        type: DataTypes.TEXT,
        comment: 'Level 0首选术语'
      },
      level1Uri: {
        type: DataTypes.TEXT,
        comment: 'Level 1技能URI'
      },
      level1PreferredTerm: {
        type: DataTypes.TEXT,
        comment: 'Level 1首选术语'
      },
      level2Uri: {
        type: DataTypes.TEXT,
        comment: 'Level 2技能URI'
      },
      level2PreferredTerm: {
        type: DataTypes.TEXT,
        comment: 'Level 2首选术语'
      },
      level3Uri: {
        type: DataTypes.TEXT,
        comment: 'Level 3技能URI'
      },
      level3PreferredTerm: {
        type: DataTypes.TEXT,
        comment: 'Level 3首选术语'
      },
      description: {
        type: DataTypes.TEXT,
        comment: '描述'
      },
      scopeNote: {
        type: DataTypes.TEXT,
        comment: '范围说明'
      },
      level0Code: {
        type: DataTypes.STRING,
        comment: 'Level 0代码'
      },
      level1Code: {
        type: DataTypes.STRING,
        comment: 'Level 1代码'
      },
      level2Code: {
        type: DataTypes.STRING,
        comment: 'Level 2代码'
      },
      level3Code: {
        type: DataTypes.STRING,
        comment: 'Level 3代码'
      }
    },
    associate: () => {
      // 技能层级模型与其他模型的关联关系
    },
    options: {
      comment: '技能层级结构表'
    }
  };
};
