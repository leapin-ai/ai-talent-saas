import { createWithRemoteLoader } from '@kne/remote-loader';
import Fetch from '@kne/react-fetch';
import { useParams, useNavigate } from 'react-router-dom';
import { Flex, Typography } from 'antd';
import { FaLightbulb } from 'react-icons/fa';
import dayjs from 'dayjs';
import HeaderCard from './HeaderCard';
import LeftColumn from './LeftColumn';
import MiddleColumn from './MiddleColumn';
import RightColumn from './RightColumn';
import style from './style.module.scss';

const TalentProfile = createWithRemoteLoader({
  modules: ['components-core:Global@usePreset']
})(({ remoteModules, baseUrl, apis }) => {
  const [usePreset] = remoteModules;
  const { ajax } = usePreset();
  const { id } = useParams();
  const navigate = useNavigate();

  return (
    <Fetch
      {...Object.assign({}, apis.detail, { params: { id } })}
      render={({ data, reload }) => {
        const saveProfile = async profileData => {
          const { data } = await ajax(
            Object.assign({}, apis.saveProfile, {
              data: {
                ...profileData,
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

        const saveEmployee = async employeeData => {
          const { data } = await ajax(
            Object.assign({}, apis.save, {
              data: {
                ...employeeData,
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

        const createPerformance = async performanceData => {
          const { data } = await ajax(
            Object.assign({}, apis.createPerformance, {
              data: {
                ...performanceData,
                employeeId: id
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

        const positionIdMapping = new Map((data.positionEnums || []).map(item => [item.value, item.description]));
        const positionNameMapping = new Map((data.positionEnums || []).map(item => [item.description, item.value]));
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
          department: data.options?.tenantOrgId ? data.orgEnums.find(item => item.value === data.options?.tenantOrgId)?.description : '',
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

        const skillTags = [...(data.profile?.skills?.cert_mapped || []), ...(data.profile?.skills?.work_related || [])];

        const targetPositions = (data.profile?.intentionPosition || []).map(position => {
          return {
            positionId: positionNameMapping.get(position),
            position: position
          };
        });

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
          if (!hireDate) return '0 年';
          const diff = new Date() - new Date(hireDate);
          const years = Math.floor(diff / (365 * 24 * 60 * 60 * 1000));
          return `${years} 年`;
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
                  period: '短期 (12 个月)',
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
                  period: '长期 (3-5 年)',
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
          <Flex className={style['talent-profile']} vertical gap={16}>
            <HeaderCard
              apis={apis}
              originData={data}
              saveEmployee={saveEmployee}
              profileData={profileData}
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
              <LeftColumn saveProfile={saveProfile} profileData={profileData} advantages={advantages} certificates={certificates} promotionHistory={promotionHistory} gotoPosition={gotoPosition} />
              <MiddleColumn
                employeeId={id}
                createPerformance={createPerformance}
                removePerformance={removePerformance}
                savePerformance={savePerformance}
                saveProfile={saveProfile}
                skillTags={skillTags}
                targetPositions={targetPositions}
                mobilityPreferences={mobilityPreferences}
                interests={interests}
                performanceReviews={performanceReviews}
                skillRadarData={{ employee: data.profile?.aiInterviewReport || [], industry: [] }}
                gotoPosition={gotoPosition}
              />
              <RightColumn saveProfile={saveProfile} careerPath={careerPath} aiRecommendations={aiRecommendations} gotoPosition={gotoPosition} />
            </div>
          </Flex>
        );
      }}
    />
  );
});

export { default as HeaderCard } from './HeaderCard';
export { default as LeftColumn } from './LeftColumn';
export { default as MiddleColumn } from './MiddleColumn';
export { default as RightColumn } from './RightColumn';
export { default as AdvantagesCard } from './AdvantagesCard';
export { default as SkillRadarChart } from './SkillRadarChart';

export default TalentProfile;
