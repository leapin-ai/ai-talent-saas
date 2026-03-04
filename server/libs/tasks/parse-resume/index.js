const dayjs = require('dayjs');
const get = require('lodash/get');
const transform = require('lodash/transform');

const runner = async (fastify, options, { task }) => {
  const resumeParseUrl = fastify.config.RESUME_PARSE_URL;
  const resumeParseKey = fastify.config.RESUME_PARSE_KEY;
  const { fileId, needAvatar = 1 } = task.input;
  const { filename, buffer, hash: md5 } = await fastify.fileManager.services.fileRecord.getFileBlob({ id: fileId });

  const response = await fetch(resumeParseUrl, {
    method: 'POST', // 指定请求方法为POST
    headers: {
      'Content-Type': 'application/json',
      Authorization: `APPCODE ${resumeParseKey}`
    },
    body: JSON.stringify({
      file_cont: buffer.toString('base64'),
      file_name: filename,
      need_avatar: needAvatar
    })
  });

  if (response.status !== 200) {
    throw new Error(`resume parse failed: ${response.status} ${response.statusText}`);
  }

  const resumeInfo = await response.json();

  const formatDegree = input => {
    if (['初中', '小学'].indexOf(input) > -1) {
      return 10;
    }
    if (input === '中专') {
      return 20;
    }
    if (input === '高中') {
      return 30;
    }
    if (input === '大专') {
      return 40;
    }
    if (input === '本科') {
      return 50;
    }
    if (['研究生', '硕士', '硕士研究生', 'mba', 'MBA'].indexOf(input) > -1) {
      return 60;
    }
    if (['博士', '博士研究生'].indexOf(input) > -1) {
      return 70;
    }
    if (input === '博士后') {
      return 75;
    }

    return 999;
  };

  const formatDate = input => {
    if (input && dayjs(input).isValid()) {
      return dayjs(input).format('YYYY-MM-DD');
    }
    return null;
  };

  const formatTextArea = input => {
    if (input) {
      return input.replace(/[\x00-\x1F\x7F-\x9F]/g, '');
    }
    return input;
  };

  const resumeData = {
    fileId,
    fileMD5: md5,
    filename: filename,
    name: get(resumeInfo, 'result.name'),
    nameEn: get(resumeInfo, 'result.name_en', ''),
    surname: get(resumeInfo, 'result.surname', ''),
    gender: (input => {
      if (['男', 'male', 'm'].indexOf(input.toLowerCase()) > -1) {
        return 'M';
      }
      if (['女', 'female', 'f'].indexOf(input.toLowerCase()) > -1) {
        return 'F';
      }
      return 'N';
    })(String(get(resumeInfo, 'result.gender') || get(resumeInfo, 'result.gender_inf'))),
    marital: (input => {
      if (['已婚', '已结婚', '已婚已育'].indexOf(input) > -1) {
        return 'Y';
      }
      if (['未婚', '未结婚', '未婚未育'].indexOf(input) > -1) {
        return 'N';
      }
      return '';
    })(String(get(resumeInfo, 'result.marital_status'))),
    birthday: formatDate(get(resumeInfo, 'result.birthday')),
    applyJob: get(resumeInfo, 'result.apply_job'),
    expectJob: get(resumeInfo, 'result.expect_job'),
    expectSalary: get(resumeInfo, 'result.expect_salary'),
    expectIndustry: get(resumeInfo, 'result.expect_industry'),
    currentStatus: get(resumeInfo, 'result.expect_jstatus'),
    email: get(resumeInfo, 'result.email'),
    phone: get(resumeInfo, 'result.phone'),
    city: get(resumeInfo, 'result.city'),
    major: get(resumeInfo, 'result.major'),
    college: get(resumeInfo, 'result.college'),
    collegeType: get(resumeInfo, 'result.type'),
    degree: formatDegree(get(resumeInfo, 'result.degree')),
    recruit: get(resumeInfo, 'result.recruit'),
    address: get(resumeInfo, 'result.address'),
    workStartTime: formatDate(get(resumeInfo, 'result.work_start_time') || get(resumeInfo, 'result.work_start_time_inf')),
    educationList: (get(resumeInfo, 'result.education_objs') || []).map(item => {
      return {
        college: get(item, 'edu_college'),
        type: get(item, 'edu_college_type'),
        degree: formatDegree(get(item, 'edu_degree_norm')),
        major: get(item, 'edu_major'),
        startDate: formatDate(item, 'start_date'),
        endDate: formatDate(item, 'end_date')
      };
    }),
    workList: (get(resumeInfo, 'result.job_exp_objs') || []).map(item => {
      return {
        startDate: formatDate(get(item, 'start_date')),
        endDate: formatDate(get(item, 'end_date')),
        sofar: get(item, 'end_date') === '至今',
        company: get(item, 'job_cpy'),
        industry: get(item, 'job_industry'),
        position: get(item, 'job_position'),
        nature: get(item, 'job_cpy_nature'),
        salary: get(item, 'salary'),
        department: get(item, 'job_dept'),
        description: formatTextArea(get(item, 'job_cpy_desc')),
        content: formatTextArea(get(item, 'job_content')),
        type: get(item, 'job_nature')
      };
    }),
    projectList: (get(resumeInfo, 'result.proj_exp_objs') || []).map(item => {
      return {
        startDate: formatDate(get(item, 'start_date')),
        endDate: formatDate(get(item, 'end_date')),
        sofar: get(item, 'end_date') === '至今',
        name: get(item, 'proj_name'),
        company: get(item, 'proj_cpy'),
        position: get(item, 'proj_position'),
        content: formatTextArea(get(item, 'proj_content')),
        responsibility: formatTextArea(get(item, 'proj_resp'))
      };
    }),
    trainingList: (get(resumeInfo, 'result.training_objs') || []).map(item => {
      return {
        startDate: formatDate(get(item, 'start_date')),
        endDate: formatDate(get(item, 'end_date')),
        sofar: get(item, 'end_date') === '至今',
        name: get(item, 'train_name'),
        certificate: get(item, 'train_cert'),
        content: formatTextArea(get(item, 'train_cont'))
      };
    }),
    skillList: (get(resumeInfo, 'result.skills_objs') || []).map(item => {
      return {
        name: get(item, 'skills_name'),
        level: get(item, 'skills_level')
      };
    }),
    languageList: (get(resumeInfo, 'result.lang_objs') || []).map(item => {
      return {
        name: get(item, 'language_name'),
        level: get(item, 'language_level')
      };
    }),
    certificateList: (get(resumeInfo, 'all_cert_objs') || []).map(item => {
      return {
        name: get(item, 'cert_name'),
        type: get(item, 'cert_type') //award：代表奖项 certificate：代表证书
      };
    })
  };
  if (get(resumeInfo, 'result.avatar_data')) {
    const base64Data = resumeInfo.result.avatar_data.replace(/^data:image\/\w+;base64,/, '');
    // 将 Base64 字符串解码为二进制数据
    const buffer = Buffer.from(base64Data, 'base64');
    try {
      const { id: fileId } = await fastify.fileManager.services.fileRecord.uploadToFileSystem({
        file: {
          toBuffer: () => buffer,
          mimetype: 'image/png',
          encoding: '7bit',
          filename: 'resume_avatar.png'
        }
      });
      resumeData.avatar = fileId;
    } catch (e) {
      console.error(e);
    }
  }
  resumeData.rawContent = transform(
    [
      'cont_basic_info',
      'cont_expect_job',
      'cont_education',
      'cont_job_exp',
      'cont_proj_exp',
      'cont_internship',
      'cont_social_exp',
      'cont_campus_exp',
      'cont_job_skill',
      'cont_my_desc',
      'cont_hobby',
      'cont_language',
      'cont_certificate',
      'cont_award',
      'cont_training',
      'cont_course',
      'cont_research',
      'cont_publications',
      'cont_my_project',
      'cont_cover_letter',
      'cont_extra_info',
      'raw_text'
    ],
    (result, value) => {
      result[value] = get(resumeInfo, `result.${value}`);
    },
    {}
  );

  return resumeData;
};

module.exports = runner;
