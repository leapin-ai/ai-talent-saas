module.exports = ({ DataTypes, definePrimaryType, options }) => {
  return {
    model: {
      employeeId: definePrimaryType('employeeId', {
        comment: '员工ID',
        allowNull: false
      }),
      positionId: definePrimaryType('positionId', {
        comment: '发起时所在岗位ID',
        allowNull: true
      }),
      appName: {
        type: DataTypes.STRING,
        comment: '应用中心问卷应用名',
        allowNull: false
      },
      projectId: {
        type: DataTypes.STRING,
        comment: '问卷项目ID',
        allowNull: false
      },
      projectName: {
        type: DataTypes.STRING,
        comment: '问卷项目名称',
        defaultValue: ''
      },
      appInviteId: {
        type: DataTypes.STRING,
        comment: '问卷系统邀请ID'
      },
      fillUrl: {
        type: DataTypes.TEXT,
        comment: '填写链接'
      },
      code: {
        type: DataTypes.STRING,
        comment: '回调校验短链码（@kne/fastify-shorten）'
      },
      name: {
        type: DataTypes.STRING,
        comment: '邀请时姓名',
        defaultValue: ''
      },
      email: {
        type: DataTypes.STRING,
        comment: '邀请时邮箱',
        defaultValue: ''
      },
      phone: {
        type: DataTypes.STRING,
        comment: '邀请时手机',
        defaultValue: ''
      },
      deadline: {
        type: DataTypes.DATE,
        comment: '截止日期'
      },
      status: {
        type: DataTypes.STRING,
        comment: 'invited|submitted',
        defaultValue: 'invited',
        allowNull: false
      },
      schema: {
        type: DataTypes.JSONB,
        comment: '提交时的问卷题目',
        defaultValue: {}
      },
      answers: {
        type: DataTypes.JSONB,
        comment: '答卷',
        defaultValue: {}
      },
      submittedAt: {
        type: DataTypes.DATE,
        comment: '提交时间'
      },
      generateTaskId: {
        type: DataTypes.STRING,
        comment: '提交后重新发起的完善档案生成任务ID'
      }
    },
    associate: ({ employeeQuestionnaire, employee, position }) => {
      employeeQuestionnaire.belongsTo(options.getTenantModels().tenant, {
        allowNull: false
      });
      employeeQuestionnaire.belongsTo(employee, {
        foreignKey: 'employeeId',
        allowNull: false
      });
      employeeQuestionnaire.belongsTo(position, {
        foreignKey: 'positionId',
        allowNull: true
      });
    },
    options: {
      comment: '员工补充问卷',
      indexes: [
        {
          name: 't_employee_questionnaire_tenant_id_employee_id',
          fields: ['tenant_id', 'employee_id'],
          where: {
            deleted_at: null
          }
        }
      ]
    }
  };
};
