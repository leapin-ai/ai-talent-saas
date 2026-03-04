module.exports = ({ DataTypes, definePrimaryType, options }) => {
  return {
    model: {
      name: {
        type: DataTypes.STRING,
        comment: '名称',
        allowNull: false
      },
      description: {
        type: DataTypes.TEXT,
        comment: '描述'
      },
      requirement: {
        type: DataTypes.TEXT,
        comment: '职位要求'
      },
      language: {
        type: DataTypes.ENUM('zh-CN', 'en-US'),
        comment: '语言要求'
      },
      locationType: {
        type: DataTypes.ENUM('on-site', 'remote'),
        comment: '工作地点类型'
      },
      location: {
        type: DataTypes.JSON,
        comment: '工作地点'
      },
      capacity: {
        type: DataTypes.JSON,
        comment: '职能'
      },
      salary: {
        type: DataTypes.JSON,
        comment: '薪资'
      },
      recruitCount: {
        type: DataTypes.INTEGER,
        comment: '招聘数量'
      },
      status: {
        type: DataTypes.ENUM('draft', 'published', 'closed'),
        comment: '状态'
      },
      publishAt: {
        type: DataTypes.DATE,
        comment: '发布时间'
      },
      ownerUserId: definePrimaryType('ownerUserId', {
        comment: '负责人'
      })
    },
    associate: ({ position }) => {
      position.belongsTo(options.getTenantModels().tenant, {
        allowNull: false
      });
      position.belongsTo(options.getTenantModels().tenantOrg, {
        allowNull: false
      });
      position.belongsTo(options.getTenantModels().user, {
        allowNull: false,
        foreignKey: 'ownerUserId'
      });
    },
    options: {
      comment: '职位信息',
      indexes: []
    }
  };
};
