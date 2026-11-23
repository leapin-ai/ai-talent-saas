import { useMemo, useState } from 'react';
import { Button, Empty } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { createWithRemoteLoader } from '@kne/remote-loader';
import { useIntl } from '@kne/react-intl';
import ProfileReadiness from '@components/TalentProfile/ProfileReadiness';
import ReadinessBar from '@components/Position/Detail/AnalyzeTalent/ReadinessBar';
import AssessmentTag from '@components/Position/Detail/AnalyzeTalent/AssessmentTag';
import talentStyle from '@components/Position/Detail/AnalyzeTalent/style.module.scss';
import style from './result.module.scss';

/** Admin 阶段结果不走租户岗位接口，用写回产出覆盖展示 */
const APPLY_PREVIEW_APIS = { talentSaas: { tenant: { position: {} } } };

const personKeyOf = person => String(person?.id || person?.employeeId || '');

const initialsOf = name => {
  const text = String(name || '').trim();
  if (!text) {
    return '—';
  }
  const parts = text.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return text.slice(0, 2).toUpperCase();
};

/** 与 AnalyzeTalent CompletionRing 同视觉；写回结果通常无档案完成度，缺省显示 — */
const CompletionRing = ({ value }) => {
  const pct = value == null || value === '' ? null : Math.max(0, Math.min(100, Math.round(Number(value))));
  if (pct == null || Number.isNaN(pct)) {
    return <span className={talentStyle['readiness-empty']}>—</span>;
  }
  const radius = 14;
  const circ = 2 * Math.PI * radius;
  const dash = (pct / 100) * circ;
  return (
    <span className={talentStyle.completion}>
      <svg width="36" height="36" viewBox="0 0 36 36" aria-hidden="true">
        <circle cx="18" cy="18" r={radius} fill="none" stroke="#e2e8f0" strokeWidth="4" />
        <circle cx="18" cy="18" r={radius} fill="none" stroke="var(--primary-color, #4183f0)" strokeWidth="4" strokeDasharray={`${dash} ${circ - dash}`} strokeLinecap="round" transform="rotate(-90 18 18)" />
      </svg>
      <span>{pct}%</span>
    </span>
  );
};

/**
 * 写回阶段「人才就绪」：指标卡 + columns 对齐岗位详情 AnalyzeTalent，
 * 点人名再展开单人 ProfileReadiness。
 */
const RoleApplyTalent = createWithRemoteLoader({
  modules: ['components-core:TablePage@Table']
})(({ remoteModules, positionId, personAnalyses, emptyDescription, backLabel }) => {
  const [Table] = remoteModules;
  const { formatMessage } = useIntl();
  const [selectedKey, setSelectedKey] = useState(null);

  const rows = useMemo(
    () =>
      (personAnalyses || []).map(item => {
        const readiness = item.analysis?.readiness;
        const pct = typeof readiness === 'number' ? Math.min(100, Math.max(0, Math.round(readiness <= 1 ? readiness * 100 : readiness))) : null;
        return {
          key: personKeyOf(item.person),
          name: item.person.name || item.person.employeeId || '—',
          employeeId: item.person.employeeId,
          analysis: item.analysis || { readiness: 0, priorityGaps: [], keySkillGaps: [], skills: [] },
          readiness: pct,
          profileCompletionPercent: item.person.profileCompletionPercent ?? item.person.profileCompletionPct ?? null,
          // 写回成功即视为已评估
          lastAssessment: pct != null && pct > 0 ? 'assessed' : 'never'
        };
      }),
    [personAnalyses]
  );

  const metrics = useMemo(() => {
    const total = rows.length;
    const assessed = rows.filter(item => item.lastAssessment === 'assessed').length;
    return { total, assessed, outdated: 0, never: total - assessed };
  }, [rows]);

  const selected = rows.find(item => item.key === selectedKey);

  if (!rows.length) {
    return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={emptyDescription} />;
  }

  if (selected) {
    return (
      <div className={talentStyle.root}>
        <div className={style.talentDetailHead}>
          <Button type="link" icon={<ArrowLeftOutlined />} onClick={() => setSelectedKey(null)}>
            {backLabel}
          </Button>
          <span className={style.talentDetailName}>{selected.name}</span>
        </div>
        <ProfileReadiness positionId={positionId} employeeId={selected.employeeId} displayName={selected.name} readOnly showLooksWrong={false} analysisOverride={selected.analysis} apis={APPLY_PREVIEW_APIS} />
      </div>
    );
  }

  return (
    <div className={talentStyle.root}>
      <div className={talentStyle.metrics}>
        {[
          { status: null, value: metrics.total, label: 'position.talentMetricPeople' },
          { status: 'assessed', value: metrics.assessed, label: 'position.talentMetricAssessed' },
          { status: 'outdated', value: metrics.outdated, label: 'position.talentMetricOutdated' },
          { status: 'never', value: metrics.never, label: 'position.talentMetricNever' }
        ].map(card => (
          <div key={card.label} className={talentStyle.metric}>
            <div className={`${talentStyle['metric-value']} ${card.status ? talentStyle[`metric-value-${card.status}`] : ''}`}>{card.value}</div>
            <div className={talentStyle['metric-label']}>{formatMessage({ id: card.label })}</div>
          </div>
        ))}
      </div>

      <Table
        className={style.talentTable}
        rowKey="key"
        controllerOpen={false}
        dataSource={rows}
        columns={[
          {
            name: 'person',
            title: formatMessage({ id: 'position.talentPerson' }),
            type: 'other',
            width: 220,
            getValueOf: item => (
              <div className={talentStyle.person}>
                <span className={talentStyle.initials}>{initialsOf(item.name)}</span>
                <div className={talentStyle['person-text']}>
                  <button type="button" className={talentStyle['person-name-link']} onClick={() => setSelectedKey(item.key)}>
                    {item.name}
                  </button>
                </div>
              </div>
            )
          },
          {
            name: 'readiness',
            title: formatMessage({ id: 'position.talentReadiness' }),
            type: 'other',
            width: 280,
            getValueOf: item => (
              <div className={style.talentReadinessCell}>
                <ReadinessBar value={item.readiness} />
              </div>
            )
          },
          {
            name: 'completion',
            title: formatMessage({ id: 'position.profileCompletion' }),
            type: 'other',
            width: 140,
            getValueOf: item => <CompletionRing value={item.profileCompletionPercent} />
          },
          {
            name: 'lastAssessment',
            title: formatMessage({ id: 'position.talentLastAssessment' }),
            type: 'other',
            width: 120,
            getValueOf: item => <AssessmentTag status={item.lastAssessment} />
          }
        ]}
      />
    </div>
  );
});

export default RoleApplyTalent;
