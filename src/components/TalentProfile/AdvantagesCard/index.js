import React from 'react';
import { createWithRemoteLoader } from '@kne/remote-loader';
import { IoMdTrendingUp } from 'react-icons/io';
import { MdOutlineEdit } from 'react-icons/md';
import { Card, Typography, Space, Flex, Button } from 'antd';
import classnames from 'classnames';
import style from '../style.module.scss';
import { AdvantageFormInner } from '../FormInner';
import withLocale from '../withLocale';
import { useIntl } from '@kne/react-intl';

const { Text } = Typography;

const AdvantagesCard = createWithRemoteLoader({
  modules: ['components-core:FormInfo@useFormModal']
})(
  withLocale(({ remoteModules, saveProfile, advantages, readOnly }) => {
    const [useFormModal] = remoteModules;
    const { formatMessage } = useIntl();
    const formModal = useFormModal();
    const EmptyState = ({ text }) => (
      <Text type="secondary" style={{ display: 'block', textAlign: 'center', padding: '20px 0' }}>
        {text || formatMessage({ id: 'talentProfile.NoData' })}
      </Text>
    );

    return (
      <Card className={style['advantages-card']}>
        <Flex justify="space-between" className={style['card-title']}>
          <Space>
            <IoMdTrendingUp />
            <span>{formatMessage({ id: 'talentProfile.Advantages' })}</span>
          </Space>
          {!readOnly && (
            <Button
              type="text"
              className={style['edit-btn']}
              icon={<MdOutlineEdit />}
              onClick={() => {
                formModal({
                  title: formatMessage({ id: 'talentProfile.EditAdvantages' }),
                  size: 'small',
                  formProps: {
                    data: {
                      advantage: advantages
                    },
                    onSubmit: formData => {
                      return saveProfile({ advantage: (formData.advantage || []).map(item => Object.assign({}, { name: '', description: '' }, item)) });
                    }
                  },
                  children: <AdvantageFormInner />
                });
              }}
            />
          )}
        </Flex>
        {advantages && advantages.length > 0 ? (
          advantages.map((advantage, index) => (
            <div key={index} className={classnames(style['advantage-item'], style[`advantage-${advantage.color}`])}>
              <Space className={style['advantage-header']}>
                <Text strong>{advantage.name}</Text>
              </Space>
              <ul className={style['advantage-list']}>
                {advantage.description && <li>{advantage.description}</li>}
                {advantage.items && advantage.items.map((item, i) => <li key={i}>{item}</li>)}
              </ul>
            </div>
          ))
        ) : (
          <EmptyState text={formatMessage({ id: 'talentProfile.NoAdvantages' })} />
        )}
      </Card>
    );
  })
);

export default AdvantagesCard;
