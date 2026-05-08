import React from 'react';
import { Card, Tag, Flex, Typography, Button } from 'antd';
import { createWithRemoteLoader } from '@kne/remote-loader';
import classnames from 'classnames';
import style from '../style.module.scss';

const { Title, Text } = Typography;

export const fieldSourceMap = {
  name: { label: '姓名', source: '基本信息' },
  name_en: { label: '英文名', source: '基本信息' },
  email: { label: '邮箱', source: '基本信息' },
  personal_email: { label: '个人邮箱', source: '基本信息' },
  phone: { label: '电话', source: '基本信息' },
  city: { label: '城市', source: '基本信息' },
  address: { label: '地址', source: '基本信息' },
  major: { label: '专业', source: '基本信息' },
  college: { label: '院校', source: '基本信息' },
  description: { label: '个人描述', source: '基本信息' },
  'position.name': { label: '职位名称', source: '职位信息' },
  'position.description': { label: '职位描述', source: '职位信息' },
  'position.requirement': { label: '职位要求', source: '职位信息' },
  'position.skill': { label: '职位技能', source: '职位信息' },
  'profile.skills.cert_mapped': { label: '技能-证书类', source: '资料信息' },
  'profile.skills.work_related': { label: '技能-工作类', source: '资料信息' },
  'profile.skills.project_related': { label: '技能-项目类', source: '资料信息' },
  'profile.skills.interest_strength': { label: '技能-兴趣类', source: '资料信息' },
  'profile.advantage.name': { label: '优势', source: '资料信息' },
  'profile.advantage.description': { label: '优势', source: '资料信息' },
  'profile.intention_position': { label: '意向职位', source: '资料信息' },
  'profile.work_preference.work_mode_preference': { label: '工作模式偏好', source: '资料信息' },
  'profile.options.hobbies': { label: '兴趣爱好', source: '资料信息' },
  'profile.options.certificates_licenses': { label: '证书执照', source: '资料信息' },
  'profile.promotion_history.occupation': { label: '晋升历史', source: '资料信息' }
};

export const DEFAULT_HIGHLIGHT_FIELDS = Object.keys(fieldSourceMap);

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

const HighlightItem = ({ field, values }) => {
  const fieldInfo = fieldSourceMap[field] || { label: field, source: '其他' };

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
          {fieldInfo.label}
        </Tag>
      </Flex>
      <Text className={style['highlight-text']} style={{ fontSize: '13px', lineHeight: '1.6' }}>
        <HighlightText text={values[0]} />
      </Text>
    </Flex>
  );
};

const TalentCard = createWithRemoteLoader({
  modules: ['components-core:Image.Avatar']
})(({ remoteModules, talent, onViewProfile }) => {
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
        {isEmployed ? '在职' : '已离职'}
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
            <Text className={style['section-label']}>核心技能</Text>
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
            <Text className={style['section-label']}>优势</Text>
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
              <Text className={style['section-label']}>匹配亮点</Text>
              <div className={style['highlights-container']}>
                <Flex vertical gap={8}>
                  {highlightFields.map(([field, values]) => (
                    <HighlightItem key={field} field={field} values={values} />
                  ))}
                </Flex>
              </div>
            </div>
          )}
        </Flex>
        <Button type="primary" block onClick={() => onViewProfile(talent)}>
          查看完整档案
        </Button>
      </Flex>
    </Card>
  );
});

export default TalentCard;
