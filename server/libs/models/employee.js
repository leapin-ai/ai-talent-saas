module.exports = ({ DataTypes, options }) => {
  return {
    model: {
      avatar: {
        type: DataTypes.STRING,
        comment: '头像'
      },
      name: {
        type: DataTypes.STRING,
        comment: '姓名'
      },
      nameEn: {
        type: DataTypes.STRING,
        comment: '姓名(英文)'
      },
      gender: {
        type: DataTypes.STRING,
        comment: '性别 M:男 F:女 N:未知'
      },
      marital: {
        type: DataTypes.STRING,
        comment: '婚姻状态 Y:已婚 N:未婚'
      },
      description: {
        type: DataTypes.TEXT,
        comment: '简介'
      },
      birthday: {
        type: DataTypes.DATE,
        comment: '出生日期'
      },
      email: {
        type: DataTypes.STRING,
        comment: '邮箱'
      },
      personalEmail: {
        type: DataTypes.STRING,
        comment: '个人邮箱'
      },
      phone: {
        type: DataTypes.STRING,
        comment: '电话号码'
      },
      emergencyContact: {
        type: DataTypes.STRING,
        comment: '紧急联系人'
      },
      emergencyPhone: {
        type: DataTypes.STRING,
        comment: '紧急联系人电话'
      },
      city: {
        type: DataTypes.STRING,
        comment: '所在城市'
      },
      address: {
        type: DataTypes.STRING,
        comment: '详细住址'
      },
      major: {
        type: DataTypes.STRING,
        comment: '专业'
      },
      collegeType: {
        type: DataTypes.STRING,
        comment: '0:普通院校 1:985 2:211 3:港澳台院校 4:海外院校 5:中学 6:职业教育 7:培训机构'
      },
      college: {
        type: DataTypes.STRING,
        comment: '毕业院校'
      },
      degree: {
        type: DataTypes.INTEGER,
        comment: '10:初中,20:中专,30:高中,40:大专,50:本科,60:硕士研究生,70:博士研究生,75:博士后,999:学历不限'
      },
      recruit: {
        type: DataTypes.STRING,
        comment: '统招类型:统招、自考、在职、成教、函授等'
      },
      status: {
        type: DataTypes.ENUM('ACTIVE', 'RESIGN', 'STOP_SALARY', 'RETIRE', 'INTERN', 'PRE_EMPLOYEE'),
        comment: 'ACTIVE:在职,RESIGN:离职,STOP_SALARY:停薪留职,RETIRE:退休,INTERN:实习,PRE_EMPLOYEE:预入职'
      },
      hireDate: {
        type: DataTypes.DATE,
        comment: '入职日期'
      },
      terminationDate: {
        type: DataTypes.DATE,
        comment: '离职日期'
      },
      terminationReason: {
        type: DataTypes.TEXT,
        comment: '离职原因'
      },
      idType: {
        type: DataTypes.ENUM('ID_CARD', 'PASSPORT', 'OTHER'),
        comment: '身份证类型'
      },
      idNumber: {
        type: DataTypes.STRING,
        comment: '身份证号码'
      },
      nationality: {
        type: DataTypes.STRING,
        comment: '国籍'
      },
      ethnicity: {
        type: DataTypes.STRING,
        comment: '民族'
      },
      politicalStatus: {
        type: DataTypes.STRING,
        comment: '政治面貌'
      },
      resumes: {
        type: DataTypes.JSONB,
        comment: '简历列表',
        defaultValue: []
      },
      options: {
        type: DataTypes.JSONB,
        comment: '其他信息'
      }
    },
    associate: ({ employee, profile, performance, resume }) => {
      employee.belongsTo(resume, {
        foreignKey: 'currentResumeId',
        as: 'currentResume'
      });
      employee.hasOne(profile);
      employee.hasMany(performance);

      employee.belongsTo(options.getTenantModels().tenantUser, {
        allowNull: false
      });
      employee.belongsTo(options.getTenantModels().tenant, {
        allowNull: false
      });
      employee.belongsTo(options.getTenantModels().tenantOrg, {
        allowNull: false
      });
    },
    options: {
      comment: '员工'
    }
  };
};
