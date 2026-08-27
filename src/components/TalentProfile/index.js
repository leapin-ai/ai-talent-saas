import { createWithRemoteLoader } from '@kne/remote-loader';
import Fetch from '@kne/react-fetch';
import { useParams, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { Flex, Typography } from 'antd';
import classnames from 'classnames';
import { FaLightbulb } from 'react-icons/fa';
import dayjs from 'dayjs';
import withLocale from './withLocale';
import { useIntl } from '@kne/react-intl';
import HeaderCard from './HeaderCard';
import LeftColumn from './LeftColumn';
import MiddleColumn from './MiddleColumn';
import RightColumn from './RightColumn';
import style from './style.module.scss';
import { resolveIntentionDisplay } from './intentionPositionUtils';

const DataNotifier = ({ data, onData }) => {
  useEffect(() => {
    if (typeof onData === 'function') {
      onData(data || null);
    }
  }, [data, onData]);
  return null;
};

const TalentProfile = createWithRemoteLoader({
  modules: ['components-core:Global@usePreset']
})(
  withLocale(
    ({
      remoteModules,
      baseUrl,
      apis,
      id: idProp,
      self,
      readOnly,
      embed,
      empty,
      onData,
      /** 外部传入则不再请求 detail，用于完善档案生成任务等草稿编辑场景 */
      data: controlledData,
      saveEmployee: controlledSaveEmployee,
      saveProfile: controlledSaveProfile,
      createPerformance: controlledCreatePerformance,
      removePerformance: controlledRemovePerformance,
      savePerformance: controlledSavePerformance,
      reload: controlledReload
    }) => {
      const [usePreset] = remoteModules;
      const { formatMessage } = useIntl();
      const { ajax } = usePreset();
      const { id: paramId } = useParams();
      const navigate = useNavigate();
      const id = idProp || paramId;
      // 首页 / 本人档案：走 my-detail，不依赖路由或 query 里的员工 id
      const useMyDetail = !controlledData && (self || !id);
      const fetchProps = useMyDetail ? Object.assign({}, apis.myDetail) : Object.assign({}, apis.detail, { params: { id } });

      const renderProfile = ({ data, reload }) => {
        if (useMyDetail && !data) {
          return (
            <>
              <DataNotifier data={data} onData={onData} />
              {empty || (
                <Flex justify="center" style={{ padding: '80px 0' }}>
                  <Typography.Text type="secondary">{formatMessage({ id: 'talentProfile.NoLinkedEmployee' })}</Typography.Text>
                </Flex>
              )}
            </>
          );
        }
        const employeeId = data.id;
        const saveProfile = async profileData => {
          if (readOnly) {
            return;
          }
          if (controlledSaveProfile) {
            const result = await controlledSaveProfile(profileData, { employeeId, reload });
            return result;
          }
          const { data } = await ajax(
            Object.assign({}, apis.saveProfile, {
              data: {
                ...profileData,
                id: employeeId
              }
            })
          );

          if (data.code !== 0) {
            return;
          }
          reload();
          return data.data;
        };

        const saveEmployee = async employeeData => {
          if (readOnly) {
            return;
          }
          if (controlledSaveEmployee) {
            const result = await controlledSaveEmployee(employeeData, { employeeId, reload });
            return result;
          }
          const { data } = await ajax(
            Object.assign({}, apis.save, {
              data: {
                ...employeeData,
                id: employeeId
              }
            })
          );
          if (data.code !== 0) {
            return;
          }
          reload();
          return data.data;
        };

        const createPerformance = async performanceData => {
          if (readOnly) {
            return;
          }
          if (controlledCreatePerformance) {
            return controlledCreatePerformance(performanceData, { employeeId, reload });
          }
          const { data } = await ajax(
            Object.assign({}, apis.createPerformance, {
              data: {
                ...performanceData,
                employeeId
              }
            })
          );

          if (data.code !== 0) {
            return;
          }
          reload();
          return data.data;
        };

        const removePerformance = async id => {
          if (readOnly) {
            return;
          }
          if (controlledRemovePerformance) {
            return controlledRemovePerformance(id, { employeeId, reload });
          }
          const { data } = await ajax(
            Object.assign({}, apis.removePerformance, {
              data: {
                id
              }
            })
          );
          if (data.code !== 0) {
            return;
          }
          reload();
          return data.data;
        };

        const savePerformance = async performanceData => {
          if (readOnly) {
            return;
          }
          if (controlledSavePerformance) {
            return controlledSavePerformance(performanceData, { employeeId, reload });
          }
          const { data } = await ajax(
            Object.assign({}, apis.savePerformance, {
              data: performanceData
            })
          );

          if (data.code !== 0) {
            return;
          }
          reload();
          return data.data;
        };

        const positionIdMapping = new Map((data.positionEnums || []).map(item => [String(item.value), item.description]));
        const positionNameMapping = new Map((data.positionEnums || []).map(item => [item.description, String(item.value)]));
        const profileData = {
          name: data.name,
          englishName: data.nameEn,
          positionId: data.options?.position,
          position: data.options?.position ? positionIdMapping.get(data.options.position) || data.options.position : '',
          degree: data.degree,
          college: data.college,
          major: data.major,
          birthday: data.birthday,
          gender: data.gender,
          marital: data.marital,
          department: (() => {
            const positionId = data.options?.position?.id || data.options?.position;
            const position = (data.positionEnums || []).find(item => String(item.value) === String(positionId));
            const orgId = position?.tenantOrgId;
            if (!orgId) {
              return '';
            }
            return (data.orgEnums || []).find(item => String(item.value) === String(orgId))?.description || '';
          })(),
          avatar: data.avatar,
          phone: data.phone,
          email: data.email,
          description: data.description,
          linkedin: '',
          location: data.city,
          languages: '',
          serviceYears: data.hireDate ? Math.floor((new Date() - new Date(data.hireDate)) / (365 * 24 * 60 * 60 * 1000)) : 0,
          totalWorkYears: data.options?.start_work_date ? Math.floor((new Date() - new Date(data.options.start_work_date)) / (365 * 24 * 60 * 60 * 1000)) : 0,
          isOnline: data.status === 'ACTIVE'
        };

        const advantages = (data.profile?.advantage || []).map((item, index) => {
          const colors = ['purple', 'blue', 'green'];
          return {
            icon: <FaLightbulb />,
            name: item.name,
            color: colors[index % colors.length],
            description: item.description
          };
        });

        const certificates = data.profile?.options?.certificates_licenses || [];

        const promotionHistory = (data.profile?.promotionHistory || []).reverse().map(item => ({
          period: item.time,
          positionId: positionNameMapping.get(item.occupation),
          position: item.occupation,
          level: item.level,
          department: '',
          active: true
        }));

        const skillTags = [...(data.profile?.skills?.cert_mapped || []), ...(data.profile?.skills?.interest_strength || []), ...(data.profile?.skills?.work_related || [])];

        const targetPositions = (data.profile?.intentionPosition || []).map(raw => resolveIntentionDisplay(raw, data.positionEnums)).filter(Boolean);

        const mobilityPreferences = data.profile?.workPreference
          ? [data.profile.workPreference.work_mode_preference, data.profile.workPreference.relocation_willingness, data.profile.workPreference.business_travel_willingness].filter(Boolean)
          : [];

        const interests = data.profile?.options?.hobbies || [];

        const performanceReviews = (data.performances || [])
          .sort((a, b) => {
            return new Date(b.date) - new Date(a.date);
          })
          .map(item => ({
            id: item.id,
            date: dayjs(item.date).format('YYYY-MM-DD'),
            rating: item.score,
            reviewer: item.evaluatorName,
            comment: item.comment
          }));

        const calculateServiceYears = hireDate => {
          if (!hireDate) return formatMessage({ id: 'talentProfile.ServiceYearsValue' }, { years: 0 });
          const diff = new Date() - new Date(hireDate);
          const years = Math.floor(diff / (365 * 24 * 60 * 60 * 1000));
          return formatMessage({ id: 'talentProfile.ServiceYearsValue' }, { years });
        };

        const careerPath = [
          {
            period: '',
            positionId: profileData.positionId,
            position: profileData.position,
            duration: calculateServiceYears(data.hireDate),
            isCurrent: true
          },
          ...(data.aiSuggest
            ? [
                {
                  period: formatMessage({ id: 'talentProfile.ShortTerm' }),
                  positionId: positionNameMapping.get(data.aiSuggest.shortTerm?.target_position),
                  position: data.aiSuggest.shortTerm?.target_position || '',
                  isCurrent: false,
                  paths: data.aiSuggest.shortTerm?.development_points || [],
                  trainings: (data.aiSuggest.shortTerm?.training_focus || []).map((item, index) => ({
                    name: item,
                    priority: data.aiSuggest.shortTerm?.skill_gap?.[index]?.level || 'medium',
                    progress: 0
                  }))
                },
                {
                  period: formatMessage({ id: 'talentProfile.LongTerm' }),
                  positionId: positionNameMapping.get(data.aiSuggest.longTerm?.target_position),
                  position: data.aiSuggest.longTerm?.target_position || '',
                  isCurrent: false,
                  trainings: (data.aiSuggest.longTerm?.training_focus || []).map((item, index) => ({
                    name: item,
                    priority: data.aiSuggest.longTerm?.skill_gap?.[index]?.level || 'medium',
                    progress: 0
                  }))
                }
              ]
            : [])
        ];

        const aiRecommendations = data.aiSuggest
          ? [
              {
                position: data.aiSuggest.matchPosition?.target_position || '',
                matchRate: Math.round((data.aiSuggest.matchPosition?.match_rate || 0) * 100),
                skills: data.aiSuggest.matchPosition?.skill_match || [],
                gaps: data.aiSuggest.matchPosition?.skill_gap || []
              }
            ]
          : [];

        const gotoPosition = positionId => {
          navigate(`${baseUrl}/position/${positionId}`);
        };
        return (
          <Flex className={classnames(style['talent-profile'], embed && style['talent-profile-embed'])} vertical gap={embed ? 12 : 16}>
            <DataNotifier data={data} onData={onData} />
            <HeaderCard
              apis={apis}
              originData={data}
              saveEmployee={saveEmployee}
              profileData={profileData}
              readOnly={readOnly}
              title={
                <Typography.Link
                  onClick={() => {
                    gotoPosition(profileData.positionId);
                  }}
                >
                  {profileData.position}
                </Typography.Link>
              }
            />
            <div className={style['main-content']}>
              <LeftColumn readOnly={readOnly} saveProfile={saveProfile} profileData={profileData} advantages={advantages} certificates={certificates} promotionHistory={promotionHistory} gotoPosition={gotoPosition} />
              <MiddleColumn
                readOnly={readOnly}
                employeeId={employeeId}
                createPerformance={createPerformance}
                removePerformance={removePerformance}
                savePerformance={savePerformance}
                saveProfile={saveProfile}
                skillTags={skillTags}
                targetPositions={targetPositions}
                mobilityPreferences={mobilityPreferences}
                interests={interests}
                performanceReviews={performanceReviews}
                originData={data}
                positionEnums={data.positionEnums}
                positionListApi={apis.positionList}
                skillRadarData={{ employee: data.profile?.aiInterviewReport || [], industry: [] }}
                gotoPosition={gotoPosition}
              />
              <RightColumn saveProfile={saveProfile} careerPath={careerPath} aiRecommendations={aiRecommendations} gotoPosition={gotoPosition} />
            </div>
          </Flex>
        );
      };

      if (controlledData) {
        return renderProfile({ data: controlledData, reload: controlledReload || (() => {}) });
      }

      return <Fetch {...fetchProps} render={renderProfile} />;
    }
  )
);

export { default as HeaderCard } from './HeaderCard';
export { default as LeftColumn } from './LeftColumn';
export { default as MiddleColumn } from './MiddleColumn';
export { default as RightColumn } from './RightColumn';
export { default as AdvantagesCard } from './AdvantagesCard';
export { default as SkillRadarChart } from './SkillRadarChart';

export default TalentProfile;
