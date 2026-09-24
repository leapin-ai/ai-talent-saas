module.exports = ({ DataTypes, options }) => {
  return {
    model: {},
    associate: ({ evidenceTaskLink, evidenceItem, positionTask }) => {
      evidenceTaskLink.belongsTo(evidenceItem, { allowNull: false, onDelete: 'CASCADE' });
      evidenceTaskLink.belongsTo(positionTask, { allowNull: false, onDelete: 'CASCADE' });
      evidenceTaskLink.belongsTo(options.getTenantModels().tenant, { allowNull: false });
    },
    options: {
      comment: '证据与岗位任务关联',
      indexes: [
        {
          name: 't_evidence_task_link_unique',
          fields: ['evidence_item_id', 'position_task_id'],
          unique: true,
          where: { deleted_at: null }
        }
      ]
    }
  };
};
