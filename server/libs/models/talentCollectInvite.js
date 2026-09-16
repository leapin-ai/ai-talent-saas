module.exports = ({ DataTypes, definePrimaryType, options }) => {
  return {
    model: {
      inviteType: {
        type: DataTypes.STRING,
        comment: 'employee|manager',
        allowNull: false
      },
      positionId: definePrimaryType('positionId', {
        comment: '岗位ID',
        allowNull: false
      }),
      employeeId: definePrimaryType('employeeId', {
        comment: '员工ID（经理邀请可空）',
        allowNull: true
      }),
      name: {
        type: DataTypes.STRING,
        comment: '邀请时姓名（只读）',
        allowNull: false
      },
      email: {
        type: DataTypes.STRING,
        comment: '邀请时邮箱（只读）',
        defaultValue: ''
      },
      phone: {
        type: DataTypes.STRING,
        comment: '邀请时手机（只读）',
        defaultValue: ''
      },
      projectId: {
        type: DataTypes.STRING,
        comment: 'AI面试项目ID',
        allowNull: false
      },
      projectName: {
        type: DataTypes.STRING,
        comment: 'AI面试项目名称',
        defaultValue: ''
      },
      deadline: {
        type: DataTypes.DATE,
        comment: '截止日期'
      },
      code: {
        type: DataTypes.STRING,
        comment: '采集邀请短链码（@kne/fastify-shorten）',
        allowNull: true
      },
      status: {
        type: DataTypes.STRING,
        comment: 'invited|opened|filling|interviewing|done',
        defaultValue: 'invited',
        allowNull: false
      },
      profileData: {
        type: DataTypes.JSONB,
        comment: '落地页填写的完善档案数据（不含邀请三字段）',
        defaultValue: {}
      },
      inviteId: {
        type: DataTypes.STRING,
        comment: 'AI面试邀请记录ID'
      },
      inviteCode: {
        type: DataTypes.STRING,
        comment: '邀请码'
      },
      shorten: {
        type: DataTypes.STRING,
        comment: 'AI面试免登录 shorten'
      },
      shortenExpiresAt: {
        type: DataTypes.DATE,
        comment: 'shorten 过期时间'
      },
      clientUserId: {
        type: DataTypes.STRING,
        comment: 'AI面试候选人ID'
      },
      interviewId: {
        type: DataTypes.STRING,
        comment: '面试记录ID'
      },
      interviewData: {
        type: DataTypes.JSONB,
        comment: '面试同步信息',
        defaultValue: {}
      }
    },
    associate: ({ talentCollectInvite, employee, position }) => {
      talentCollectInvite.belongsTo(options.getTenantModels().tenant, {
        allowNull: false
      });
      talentCollectInvite.belongsTo(position, {
        foreignKey: 'positionId',
        allowNull: false
      });
      talentCollectInvite.belongsTo(employee, {
        foreignKey: 'employeeId',
        allowNull: true
      });
    },
    options: {
      comment: '人才评估收集邀请',
      indexes: [
        {
          name: 't_talent_collect_invite_code',
          fields: ['code'],
          unique: true,
          where: {
            deleted_at: null
          }
        },
        {
          name: 't_talent_collect_invite_tenant_id_position_id',
          fields: ['tenant_id', 'position_id'],
          where: {
            deleted_at: null
          }
        }
      ]
    }
  };
};
