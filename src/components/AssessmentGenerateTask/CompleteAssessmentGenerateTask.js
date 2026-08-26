import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Col, Descriptions, Flex, Row, Spin, Typography, message } from 'antd';
import { createWithRemoteLoader } from '@kne/remote-loader';
import Fetch from '@kne/react-fetch';
import dayjs from 'dayjs';
import TalentProfile from '@components/TalentProfile';
import style from './style.module.scss';

const formatValue = value => {
  if (value == null || value === '') {
    return '-';
  }
  if (typeof value === 'object') {
    const number = value.number ?? value.phone ?? value.value ?? value.email;
    if (number != null && String(number).trim()) {
      return String(number).trim();
    }
    try {
      return JSON.stringify(value);
    } catch (e) {
      return '-';
    }
  }
  return String(value);
};

const LeftPanel = ({ assessment }) => {
  const profileData = assessment?.profileData || {};
  const interviewData = assessment?.interviewData || {};
  const projects = Array.isArray(profileData.projects) ? profileData.projects : [];
  const skills = profileData.skills?.work_related || profileData.skills;

  return (
    <Flex vertical gap={16} className={style['panel']}>
      <Typography.Title level={5} style={{ margin: 0 }}>
        面试报告 / 提交信息
      </Typography.Title>
      <Descriptions size="small" column={1} bordered>
        <Descriptions.Item label="姓名">{formatValue(assessment?.name || profileData.name)}</Descriptions.Item>
        <Descriptions.Item label="手机">{formatValue(assessment?.phone || profileData.phone)}</Descriptions.Item>
        <Descriptions.Item label="邮箱">{formatValue(assessment?.email || profileData.email)}</Descriptions.Item>
        <Descriptions.Item label="LinkedIn">{formatValue(profileData.linkedin)}</Descriptions.Item>
        <Descriptions.Item label="面试项目">{formatValue(assessment?.projectName)}</Descriptions.Item>
        <Descriptions.Item label="邀请码">{formatValue(assessment?.inviteCode)}</Descriptions.Item>
        <Descriptions.Item label="面试状态">{formatValue(interviewData.interviewStatus)}</Descriptions.Item>
        <Descriptions.Item label="面试ID">{formatValue(interviewData.interviewId)}</Descriptions.Item>
        <Descriptions.Item label="更新时间">{assessment?.updatedAt ? dayjs(assessment.updatedAt).format('YYYY-MM-DD HH:mm') : '-'}</Descriptions.Item>
      </Descriptions>

      <div>
        <Typography.Text strong>技能</Typography.Text>
        <Typography.Paragraph type="secondary" style={{ marginTop: 8 }}>
          {Array.isArray(skills) ? skills.join('、') || '-' : formatValue(skills)}
        </Typography.Paragraph>
      </div>

      <div>
        <Typography.Text strong>项目经历</Typography.Text>
        {projects.length === 0 ? (
          <Typography.Paragraph type="secondary" style={{ marginTop: 8 }}>
            -
          </Typography.Paragraph>
        ) : (
          projects.map((project, index) => (
            <Descriptions key={index} size="small" column={1} bordered style={{ marginTop: 8 }} title={project.name || `项目 ${index + 1}`}>
              <Descriptions.Item label="角色">{formatValue(project.role)}</Descriptions.Item>
              <Descriptions.Item label="描述">{formatValue(project.description)}</Descriptions.Item>
            </Descriptions>
          ))
        )}
      </div>
    </Flex>
  );
};

const toReviewData = profileDetail => {
  if (!profileDetail) {
    return { employee: {}, profile: {} };
  }
  const { profile, performances, orgEnums, positionEnums, aiSuggest, createdAt, updatedAt, deletedAt, ...employee } = profileDetail;
  if (employee.id != null && String(employee.id).startsWith('draft-')) {
    delete employee.id;
  }
  return {
    employee,
    profile: profile || {}
  };
};

const RightPanel = ({ employeeApis, profileDetail, setProfileDetail }) => {
  const saveEmployee = useCallback(
    async employeeData => {
      setProfileDetail(prev => {
        const next = Object.assign({}, prev, employeeData, {
          id: prev.id,
          options: Object.assign({}, prev.options || {}, employeeData.options || {}),
          profile: prev.profile
        });
        if (Array.isArray(prev.orgEnums)) {
          next.orgEnums = prev.orgEnums;
        }
        if (Array.isArray(prev.positionEnums)) {
          next.positionEnums = prev.positionEnums;
        }
        return next;
      });
    },
    [setProfileDetail]
  );

  const saveProfile = useCallback(
    async profilePatch => {
      setProfileDetail(prev =>
        Object.assign({}, prev, {
          profile: Object.assign({}, prev.profile || {}, profilePatch, {
            options: Object.assign({}, prev.profile?.options || {}, profilePatch.options || {})
          })
        })
      );
    },
    [setProfileDetail]
  );

  const createPerformance = useCallback(
    async performanceData => {
      setProfileDetail(prev =>
        Object.assign({}, prev, {
          performances: [Object.assign({}, performanceData, { id: `local-${Date.now()}` }), ...(prev.performances || [])]
        })
      );
    },
    [setProfileDetail]
  );

  const removePerformance = useCallback(
    async performanceId => {
      setProfileDetail(prev =>
        Object.assign({}, prev, {
          performances: (prev.performances || []).filter(item => item.id !== performanceId)
        })
      );
    },
    [setProfileDetail]
  );

  const savePerformance = useCallback(
    async performanceData => {
      setProfileDetail(prev =>
        Object.assign({}, prev, {
          performances: (prev.performances || []).map(item => (item.id === performanceData.id ? Object.assign({}, item, performanceData) : item))
        })
      );
    },
    [setProfileDetail]
  );

  if (!profileDetail) {
    return null;
  }

  return (
    <Flex vertical gap={16} className={style['panel']}>
      <Typography.Title level={5} style={{ margin: 0 }}>
        员工档案
      </Typography.Title>
      <div className={style['profile-wrap']}>
        <TalentProfile
          baseUrl="/tenant"
          apis={employeeApis}
          data={profileDetail}
          saveEmployee={saveEmployee}
          saveProfile={saveProfile}
          createPerformance={createPerformance}
          removePerformance={removePerformance}
          savePerformance={savePerformance}
        />
      </div>
    </Flex>
  );
};

const CompleteAssessmentGenerateTask = createWithRemoteLoader({
  modules: ['components-core:Global@usePreset', 'components-core:Modal']
})(({ remoteModules, data, onSuccess, children, ...props }) => {
  const [usePreset, Modal] = remoteModules;
  const { apis, ajax } = usePreset();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [profileDetail, setProfileDetail] = useState(null);

  const employeeApis = useMemo(
    () =>
      Object.assign({}, apis.talentSaas.tenant.employee, {
        positionList: apis.talentSaas.tenant.position.list,
        parseResume: apis.talentSaas.tenant.resume.parseFileId,
        orgList: apis.tenant.orgList
      }),
    [apis]
  );

  const handleComplete = async currentDetail => {
    setSubmitting(true);
    try {
      const reviewData = toReviewData(currentDetail);
      const { data: resData } = await ajax(
        Object.assign({}, apis.talentSaas.tenant.assessment.completeGenerate, {
          data: {
            taskId: data.id,
            reviewData
          }
        })
      );
      if (resData.code !== 0) {
        throw new Error(resData.msg || '完成生成任务失败');
      }
      message.success('已完成生成并提交审核');
      setOpen(false);
      onSuccess && onSuccess();
      return true;
    } catch (e) {
      message.error(e.message || '完成生成任务失败');
      return false;
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Button
        {...props}
        onClick={() => {
          setProfileDetail(null);
          setOpen(true);
        }}
      >
        {children || '完成'}
      </Button>
      <Modal
        open={open}
        title="完善档案生成审核"
        size="large"
        destroyOnHidden
        onCancel={() => {
          if (!submitting) {
            setOpen(false);
          }
        }}
        onClose={() => {
          if (!submitting) {
            setOpen(false);
          }
        }}
        footerButtons={[
          {
            children: '取消',
            disabled: submitting,
            onClick: ({ close }) => {
              if (!submitting) {
                close();
              }
            }
          },
          {
            type: 'primary',
            children: '完成',
            loading: submitting,
            disabled: !profileDetail,
            onClick: async () => {
              const ok = await handleComplete(profileDetail);
              return ok;
            }
          }
        ]}
      >
        <Fetch
          {...apis.talentSaas.tenant.assessment.generateTaskContext}
          params={{ taskId: data.id }}
          render={({ data: context, isComplete }) => {
            if (!isComplete) {
              return (
                <Flex justify="center" style={{ padding: 48 }}>
                  <Spin size="large" />
                </Flex>
              );
            }
            return <TaskContextBody context={context} profileDetail={profileDetail} setProfileDetail={setProfileDetail} employeeApis={employeeApis} />;
          }}
        />
      </Modal>
    </>
  );
});

const TaskContextBody = ({ context, profileDetail, setProfileDetail, employeeApis }) => {
  useEffect(() => {
    if (context?.profileDetail) {
      setProfileDetail(prev => prev || context.profileDetail);
    }
  }, [context?.profileDetail, setProfileDetail]);

  const currentDetail = profileDetail || context.profileDetail;

  return (
    <Row gutter={24} className={style['modal-body']}>
      <Col xs={24} lg={8}>
        <LeftPanel assessment={context.assessment} />
      </Col>
      <Col xs={24} lg={16}>
        <RightPanel employeeApis={employeeApis} profileDetail={currentDetail} setProfileDetail={setProfileDetail} />
      </Col>
    </Row>
  );
};

export default CompleteAssessmentGenerateTask;
