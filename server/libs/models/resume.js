module.exports = ({ DataTypes }) => {
  return {
    model: {
      fileId: {
        type: DataTypes.STRING,
        comment: '简历附件Id'
      },
      fileMD5: {
        type: DataTypes.STRING,
        comment: '简历附件md5'
      },
      filename: {
        type: DataTypes.STRING,
        comment: '简历原始文件名'
      },
      avatar: {
        type: DataTypes.STRING,
        comment: '简历头像'
      },
      name: {
        type: DataTypes.STRING,
        comment: '姓名'
      },
      nameEn: {
        type: DataTypes.STRING,
        comment: '姓名(英文)'
      },
      surname: {
        type: DataTypes.STRING,
        comment: '姓氏'
      },
      gender: {
        type: DataTypes.STRING,
        comment: '性别 M:男 F:女 N:未知'
      },
      marital: {
        type: DataTypes.STRING,
        comment: '婚姻状态 Y:已婚 N:未婚'
      },
      birthday: {
        type: DataTypes.DATE,
        comment: '出生日期'
      },
      applyJob: {
        type: DataTypes.STRING,
        comment: '应聘职位'
      },
      expectJob: {
        type: DataTypes.STRING,
        comment: '期望职位'
      },
      expectSalary: {
        type: DataTypes.STRING,
        comment: '期望薪资'
      },
      expectIndustry: {
        type: DataTypes.STRING,
        comment: '期望行业'
      },
      currentStatus: {
        type: DataTypes.STRING,
        comment: '当前求职状态'
      },
      email: {
        type: DataTypes.STRING,
        comment: '邮箱'
      },
      phone: {
        type: DataTypes.STRING,
        comment: '电话号码'
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
      workStartTime: {
        type: DataTypes.DATE,
        comment: '开始工作时间'
      },
      educationList: {
        type: DataTypes.JSONB,
        comment: '教育经历'
      },
      workList: {
        type: DataTypes.JSONB,
        comment: '工作经历'
      },
      projectList: {
        type: DataTypes.JSONB,
        comment: '项目经历'
      },
      trainingList: {
        type: DataTypes.JSONB,
        comment: '培训经历'
      },
      skillList: {
        type: DataTypes.JSONB,
        comment: '技能列表'
      },
      languageList: {
        type: DataTypes.JSONB,
        comment: '语言技能'
      },
      certificateList: {
        type: DataTypes.JSONB,
        comment: '获奖证书'
      }
    },
    associate: ({ resume, resumeRawContent }) => {
      resume.belongsTo(resumeRawContent);
    },
    options: {
      comment: '候选人简历及解析结果',
      indexes: [
        {
          unique: true,
          fields: ['file_m_d5', 'deleted_at']
        }
      ]
    }
  };
};
