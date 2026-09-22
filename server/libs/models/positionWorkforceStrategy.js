module.exports = ({ DataTypes, options }) => {
  return {
    model: {
      action: {
        type: DataTypes.STRING(16),
        allowNull: false,
        comment: 'BUILD|MOVE|BUY|AUGMENT'
      },
      title: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: ''
      },
      detail: {
        type: DataTypes.TEXT,
        comment: '策略说明'
      },
      peopleCount: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      sortOrder: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
      }
    },
    associate: ({ positionWorkforceStrategy, position }) => {
      positionWorkforceStrategy.belongsTo(position, { allowNull: false, onDelete: 'CASCADE' });
      positionWorkforceStrategy.belongsTo(options.getTenantModels().tenant, { allowNull: false });
    },
    options: {
      comment: '岗位劳动力策略卡',
      indexes: [
        {
          name: 't_position_workforce_strategy_pos',
          fields: ['tenant_id', 'position_id', 'sort_order'],
          where: { deleted_at: null }
        }
      ]
    }
  };
};
