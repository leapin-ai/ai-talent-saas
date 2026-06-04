import React from 'react';
import { Card, Tag, Flex, Typography, Button } from 'antd';
import { createWithRemoteLoader } from '@kne/remote-loader';
import classnames from 'classnames';
import style from '../style.module.scss';
import withLocale from '../withLocale';
import { useIntl } from '@kne/react-intl';

const { Title, Text } = Typography;

const fieldLabelKeys = {
  name: 'talentMarket.FieldName',
  name_en: 'talentMarket.FieldNameEn',
  email: 'talentMarket.FieldEmail',
  personal_email: 'talentMarket.FieldPersonalEmail',
  phone: 'talentMarket.FieldPhone',
  city: 'talentMarket.FieldCity',
  address: 'talentMarket.FieldAddress',
  major: 'talentMarket.FieldMajor',
  college: 'talentMarket.FieldCollege',
  description: 'talentMarket.FieldDescription',
  'position.name': 'talentMarket.FieldPositionName',
  'position.description': 'talentMarket.FieldPositionDescription',
  'position.requirement': 'talentMarket.FieldPositionRequirement',
  'position.skill': 'talentMarket.FieldPositionSkill',
  'profile.skills.cert_mapped': 'talentMarket.FieldSkillsCertMapped',
  'profile.skills.work_related': 'talentMarket.FieldSkillsWorkRelated',
  'profile.skills.project_related': 'talentMarket.FieldSkillsProjectRelated',
  'profile.skills.interest_strength': 'talentMarket.FieldSkillsInterestStrength',
  'profile.advantage': 'talentMarket.FieldAdvantage',
  'profile.intention_position': 'talentMarket.FieldIntentionPosition',
  'profile.work_preference.work_mode_preference': 'talentMarket.FieldWorkModePreference',
  'profile.options.hobbies': 'talentMarket.FieldHobbies',
  'profile.options.certificates_licenses': 'talentMarket.FieldCertificatesLicenses'
};

const fieldSourceKeys = {
  basicInfo: 'talentMarket.SourceBasicInfo',
  positionInfo: 'talentMarket.SourcePositionInfo',
  profileInfo: 'talentMarket.SourceProfileInfo'
};

export const getFieldSourceMap = ({ formatMessage }) => {
  const sourceMap = {
    basicInfo: formatMessage({ id: 'talentMarket.SourceBasicInfo' }),
    positionInfo: formatMessage({ id: 'talentMarket.SourcePositionInfo' }),
    profileInfo: formatMessage({ id: 'talentMarket.SourceProfileInfo' })
  };

  const fieldEntries = Object.entries(fieldLabelKeys).map(([field, key]) => {
    let sourceKey;
    if (['name', 'name_en', 'email', 'personal_email', 'phone', 'city', 'address', 'major', 'college', 'description'].includes(field)) {
      sourceKey = 'basicInfo';
    } else if (field.startsWith('position.')) {
      sourceKey = 'positionInfo';
    } else {
      sourceKey = 'profileInfo';
    }
    return [field, { label: formatMessage({ id: key }), source: sourceMap[sourceKey] }];
  });

  return Object.fromEntries(fieldEntries);
};

// Keep static fieldSourceMap for DEFAULT_HIGHLIGHT_FIELDS export (keys only)
const fieldSourceMapKeys = {
  name: { labelKey: 'talentMarket.FieldName', sourceKey: 'basicInfo' },
  name_en: { labelKey: 'talentMarket.FieldNameEn', sourceKey: 'basicInfo' },
  email: { labelKey: 'talentMarket.FieldEmail', sourceKey: 'basicInfo' },
  personal_email: { labelKey: 'talentMarket.FieldPersonalEmail', sourceKey: 'basicInfo' },
  phone: { labelKey: 'talentMarket.FieldPhone', sourceKey: 'basicInfo' },
  city: { labelKey: 'talentMarket.FieldCity', sourceKey: 'basicInfo' },
  address: { labelKey: 'talentMarket.FieldAddress', sourceKey: 'basicInfo' },
  major: { labelKey: 'talentMarket.FieldMajor', sourceKey: 'basicInfo' },
  college: { labelKey: 'talentMarket.FieldCollege', sourceKey: 'basicInfo' },
  description: { labelKey: 'talentMarket.FieldDescription', sourceKey: 'basicInfo' },
  'position.name': { labelKey: 'talentMarket.FieldPositionName', sourceKey: 'positionInfo' },
  'position.description': { labelKey: 'talentMarket.FieldPositionDescription', sourceKey: 'positionInfo' },
  'position.requirement': { labelKey: 'talentMarket.FieldPositionRequirement', sourceKey: 'positionInfo' },
  'position.skill': { labelKey: 'talentMarket.FieldPositionSkill', sourceKey: 'positionInfo' },
  'profile.skills.cert_mapped': { labelKey: 'talentMarket.FieldSkillsCertMapped', sourceKey: 'profileInfo' },
  'profile.skills.work_related': { labelKey: 'talentMarket.FieldSkillsWorkRelated', sourceKey: 'profileInfo' },
  'profile.skills.project_related': { labelKey: 'talentMarket.FieldSkillsProjectRelated', sourceKey: 'profileInfo' },
  'profile.skills.interest_strength': { labelKey: 'talentMarket.FieldSkillsInterestStrength', sourceKey: 'profileInfo' },
  'profile.advantage': { labelKey: 'talentMarket.FieldAdvantage', sourceKey: 'profileInfo' },
  'profile.intention_position': { labelKey: 'talentMarket.FieldIntentionPosition', sourceKey: 'profileInfo' },
  'profile.work_preference.work_mode_preference': { labelKey: 'talentMarket.FieldWorkModePreference', sourceKey: 'profileInfo' },
  'profile.options.hobbies': { labelKey: 'talentMarket.FieldHobbies', sourceKey: 'profileInfo' },
  'profile.options.certificates_licenses': { labelKey: 'talentMarket.FieldCertificatesLicenses', sourceKey: 'profileInfo' }
};

export const fieldSourceMap = fieldSourceMapKeys;

export const DEFAULT_HIGHLIGHT_FIELDS = Object.keys(fieldSourceMapKeys);

const HighlightText = ({ text }) => {
  if (!text) {
    return null;
  }

  const parts = text.split(/(<em>.*?<\/em>)/g);

  return (
    <span>
      {parts.map((part, index) => {
        if (part.startsWith('<em>') && part.endsWith('</em>')) {
          const content = part.slice(4, -5);
          return (
            <Text key={index} mark style={{ backgroundColor: '#fffbe6', fontWeight: 'bold' }}>
              {content}
            </Text>
          );
        }
        return <span key={index}>{part}</span>;
      })}
    </span>
  );
};

const HighlightItem = ({ field, values, formatMessage }) => {
  const fieldKey = fieldLabelKeys[field];
  const label = fieldKey ? formatMessage({ id: fieldKey }) : field;
  const sourceKey = fieldSourceMapKeys[field]?.sourceKey;
  const sourceLabel = sourceKey ? (fieldSourceKeys[sourceKey] ? formatMessage({ id: fieldSourceKeys[sourceKey] }) : sourceKey) : formatMessage({ id: 'talentMarket.SourceOther' });

  return (
    <Flex vertical gap={2} className={style['highlight-item']}>
      <Flex align="center" gap={6}>
        <Tag
          color="blue"
          style={{
            fontSize: '11px',
            padding: '0 6px',
            margin: 0,
            lineHeight: '18px',
            height: '20px'
          }}
        >
          {label}
        </Tag>
      </Flex>
      <Text className={style['highlight-text']} style={{ fontSize: '13px', lineHeight: '1.6' }}>
        <HighlightText text={values?.join('、')} />
      </Text>
    </Flex>
  );
};

const TalentCard = createWithRemoteLoader({
  modules: ['components-core:Image.Avatar']
})(
  withLocale(({ remoteModules, talent, onViewProfile }) => {
    const { formatMessage } = useIntl();
    const isEmployed = talent.status === 'employed';
    const [Avatar] = remoteModules;

    const highlightFields = Object.entries(talent.highlight || {}).filter(([key, value]) => value && Array.isArray(value) && value.length > 0);

    return (
      <Card
        hoverable
        className={style['talent-card']}
        onClick={() => {
          onViewProfile(talent);
        }}
      >
        <Tag
          className={classnames(style['talent-card-status'], {
            [style['employed']]: isEmployed
          })}
        >
          {isEmployed ? formatMessage({ id: 'talentMarket.Employed' }) : formatMessage({ id: 'talentMarket.Resigned' })}
        </Tag>
        <Flex vertical gap={16} flex={1} justify="space-between" style={{ height: '100%' }}>
          <Flex vertical gap={16} flex={1}>
            <Flex align="center" gap={12}>
              <Flex flex="none">
                <Avatar size={56} id={talent.avatar} />
              </Flex>
              <div>
                <Title level={5} className={style['talent-name']}>
                  <HighlightText text={talent.highlight?.name?.[0] || talent.name} />
                </Title>
                <Text type="secondary" className={style['talent-position']}>
                  <HighlightText text={talent.highlight?.['position.name']?.[0] || talent.position} />
                </Text>
              </div>
            </Flex>

            <div>
              <Text className={style['section-label']}>{formatMessage({ id: 'talentMarket.CoreSkills' })}</Text>
              <Flex gap={4} wrap>
                {(talent.skills || []).slice(0, 3).map((skill, index) => (
                  <Tag key={index} className={style['skill-tag']}>
                    {skill}
                  </Tag>
                ))}
                {talent.skills?.length > 3 && <Tag className={style['more-tag']}>+{talent.skills.length - 3}</Tag>}
              </Flex>
            </div>

            <div>
              <Text className={style['section-label']}>{formatMessage({ id: 'talentMarket.Advantages' })}</Text>
              <ul className={style['advantages-list']}>
                {(talent.advantages || []).map((advantage, index) => (
                  <li key={index}>
                    <span className={classnames(style.dot, style[`dot-${index}`])} />
                    {advantage}
                  </li>
                ))}
              </ul>
            </div>
            {highlightFields.length > 0 && (
              <div>
                <Text className={style['section-label']}>{formatMessage({ id: 'talentMarket.MatchHighlights' })}</Text>
                <div className={style['highlights-container']}>
                  <Flex vertical gap={8}>
                    {highlightFields.map(([field, values]) => (
                      <HighlightItem key={field} field={field} values={values} formatMessage={formatMessage} />
                    ))}
                  </Flex>
                </div>
              </div>
            )}
          </Flex>
          <Button type="primary" block onClick={() => onViewProfile(talent)}>
            {formatMessage({ id: 'talentMarket.ViewFullProfile' })}
          </Button>
        </Flex>
      </Card>
    );
  })
);

export default TalentCard;
