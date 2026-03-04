import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import style from './style.module.scss';
import Header from './Header';
import TalentGrid from './TalentGrid';
import Fetch from '@kne/react-fetch';

const TalentMarket = ({ baseUrl, onMoreProfile, apis }) => {
  const [searchValue, setSearchValue] = useState('');
  const [showFilter, setShowFilter] = useState(false);

  const navigate = useNavigate();

  const mockTalents = [
    {
      id: 1,
      name: '张三三',
      position: '数据分析师',
      avatar:
        'https://lh3.googleusercontent.com/aida-public/AB6AXuDvPAB0O641DVkigN2YUUsCo3jIvsHcp4OSFJjmz0fPhorqdvR4efVlRQ5l_rwJfrDW5MYuaggIE0eoLk1WYVo8SJ-hKhsE_VLIn_fIcqid0sEtVW6X9Yzle7oVtbY8O8yw2sFJ98QToZJXYweEiPoPMDjgu3-SqCokd9C79qBpgmtBr4xN-SX7pyZkfZH7LsuNTL5EmXaeteqQs9un1Fsj_hbojeqzcsjFHrkH5jW3K68PWJ9hNKNgYYhEVwiCv6jtbW94jil8prPe',
      status: 'employed',
      skills: ['分析市场需求', '制定解决方案', '数据可视化', '业务洞察', '团队协作', '项目管理', '沟通协调', '问题解决', '执行力强', '学习能力强'],
      advantages: ['擅长数据可视化', '数据洞察', '团队领导力']
    },
    {
      id: 2,
      name: '李星辰',
      position: '资深数据科学家',
      avatar:
        'https://lh3.googleusercontent.com/aida-public/AB6AXuDBaxjl-ICxdCw_3yCfzmkys0Q2wuyy69cvHuFyPyzmnYpBk8YM3gJqyjt2AM99rzQ6xL9aKfDB7sG8KUEX-XWCm0DLzAyvKtmorL8V9fSO2UofOZn031chxQNr7dYIKufdNes1-_c8ckSZSZC_78CSbp6ZpQZYSBBguCMSHI61LOCGfCQ94TMMPGLYEozp7almsgsNsNr28SQXWyXAnn4LPCvra7gNoM1TFSa5-ebd3RH2EnoIX6iq8Hpya3reXoHbFA324WBb2Upy',
      status: 'employed',
      skills: ['构建机器学习模型', '优化算法性能', '深度学习', '数据分析', '统计建模', 'Python编程', '数据挖掘', '算法设计', '模型训练', '系统优化'],
      advantages: ['精通深度学习框架', '复杂场景下的问题建模', '跨部门技术协作']
    },
    {
      id: 3,
      name: '赵丽华',
      position: 'AI工程师',
      avatar:
        'https://lh3.googleusercontent.com/aida-public/AB6AXuDfzbPSybH8rOdKyU6yil2MZ0AZD46leNuBxb90oMJzRaoU6DrE5_5tSB-f-A6hd8zaQKm9pNN-brGDd9dp5u43qBBetCKexRx-JzbnTABfyYfgorODXP3hFxX7AoH2WMabL_Kb0S-K0dvQSVsWVFQO3BcLW2OQ4yqLqa-5bQlGKtNiPY7bx4ttYyNFPY5rc3CWx3YdBFKmgvpKKZvphWdtaXIHQ2slIsefoj_bl_JO03E4R6pw81RlR8snJUskLVdJwx6bz3QIYtKN',
      status: 'resigned',
      skills: ['自然语言处理', '智能推荐系统', '机器学习', '深度学习', '模型优化', 'Python', 'TensorFlow', 'PyTorch', '数据工程', '算法应用'],
      advantages: ['擅长模型训练与调优', '数据驱动的决策制定', '项目管理能力']
    },
    {
      id: 4,
      name: '刘婷婷',
      position: '产品经理',
      avatar:
        'https://lh3.googleusercontent.com/aida-public/AB6AXuCjUHtgv-S5cvSAu0mbDD9Xewoo5Ju8DeIaSyBzCJZVQLRWnjb3pt3VlBEB27xq0a8QJDrsMN1KA6FndUTp7hpoUO-VLLSGNI4q88zCdOhMv2tJjv84gFlDOYWx5SzNYoMgMoLEAp66OZJtrJNSo6I3RcYepGW79Pt-1VICUY_N8mvJcb9P1drYZ-QwkPSyFzLEEEZsJ56WFcyVEH_PRy6yi1H1TSD_4E5kL4MzSFGe2ZNtAxjmfYd3y_uWwDxFcxAowo43zZ20gCnk',
      status: 'employed',
      skills: ['产品需求分析', '用户体验设计', '市场调研', '项目管理', '用户研究', '数据分析', '原型设计', '敏捷开发', '团队协作', '沟通协调'],
      advantages: ['擅长沟通与协调', '市场趋势分析', '敏捷开发管理']
    }
  ];

  const handleViewProfile = talent => {
    navigate(`${baseUrl}/profile/${talent.id}`);
  };

  return (
    <div className={style['talent-market']}>
      <Header searchValue={searchValue} onSearchChange={setSearchValue} onFilterToggle={() => setShowFilter(!showFilter)} />

      <main className={style.main}>
        <Fetch
          {...Object.assign({}, apis.recommend)}
          render={({ data }) => {
            const positionMapping = new Map(
              (data.positionEnums || []).map(item => {
                return [item.value, item.description];
              })
            );
            const mappedTalents = (data.list || []).map(item => ({
              id: item.id,
              name: item.name,
              positionId: item.options?.position || '',
              position: positionMapping.get(item.options?.position || '') || item.options?.position || '',
              avatar: item.avatar,
              status: item.status === 'ACTIVE' ? 'employed' : 'resigned',
              skills: [...(item.profile?.skills?.cert_mapped || []), ...(item.profile?.skills?.work_related || []), ...(item.profile?.skills?.interest_strength || [])],
              advantages: (item.profile?.advantage || []).map(adv => adv.name)
            }));
            return <TalentGrid talents={mappedTalents} onViewProfile={handleViewProfile} onMoreProfile={onMoreProfile} />;
          }}
        />
      </main>
    </div>
  );
};

export { default as Header } from './Header';
export { default as TalentGrid } from './TalentGrid';
export { default as TalentCard } from './TalentCard';

export default TalentMarket;
