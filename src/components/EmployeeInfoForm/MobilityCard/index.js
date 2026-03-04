import React from 'react';
import { createWithRemoteLoader } from '@kne/remote-loader';
import { Card, Flex, Typography } from 'antd';
import { MdPersonOutline } from 'react-icons/md';
import style from '../style.module.scss';

const { Title } = Typography;

const MobilityCard = createWithRemoteLoader({
  modules: ['components-core:FormInfo']
})(({ remoteModules }) => {
  const [FormInfo] = remoteModules;
  const { SuperSelect } = FormInfo.fields;

  return (
    <Card className={style['section-card']}>
      <Flex align="center" gap={8} className={style['card-header']}>
        <MdPersonOutline className={style['card-icon-gray']} />
        <Title level={4}>流动性偏好</Title>
      </Flex>

      <SuperSelect
        name="workMode"
        label="工作模式偏好"
        rule="REQ"
        options={[
          { label: '全职', value: 'fulltime' },
          { label: '远程', value: 'remote' },
          { label: '混合', value: 'hybrid' }
        ]}
        single
      />

      <SuperSelect
        name="businessTravel"
        label="出差意愿"
        rule="REQ"
        options={[
          { label: '不接受', value: 'no' },
          { label: '接受少量', value: 'little' },
          { label: '接受频繁', value: 'frequent' }
        ]}
        single
      />

      <SuperSelect
        name="assignment"
        label="外派意愿"
        rule="REQ"
        options={[
          { label: '愿意', value: 'yes' },
          { label: '不愿意', value: 'no' }
        ]}
        single
      />
    </Card>
  );
});

export default MobilityCard;
