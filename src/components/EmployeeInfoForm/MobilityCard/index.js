import React from 'react';
import { createWithRemoteLoader } from '@kne/remote-loader';
import { Card, Flex, Typography } from 'antd';
import { MdPersonOutline } from 'react-icons/md';
import style from '../style.module.scss';
import withLocale from '../withLocale';
import { useIntl } from '@kne/react-intl';

const { Title } = Typography;

const MobilityCard = createWithRemoteLoader({
  modules: ['components-core:FormInfo']
})(
  withLocale(({ remoteModules }) => {
    const [FormInfo] = remoteModules;
    const { SuperSelect } = FormInfo.fields;
    const { formatMessage } = useIntl();

    return (
      <Card className={style['section-card']}>
        <Flex align="center" gap={8} className={style['card-header']}>
          <MdPersonOutline className={style['card-icon-gray']} />
          <Title level={4}>{formatMessage({ id: 'employeeInfoForm.mobilityPreference' })}</Title>
        </Flex>

        <SuperSelect
          name="workMode"
          label={formatMessage({ id: 'employeeInfoForm.workMode' })}
          rule="REQ"
          options={[
            { label: formatMessage({ id: 'employeeInfoForm.workModeFulltime' }), value: 'fulltime' },
            { label: formatMessage({ id: 'employeeInfoForm.workModeRemote' }), value: 'remote' },
            { label: formatMessage({ id: 'employeeInfoForm.workModeHybrid' }), value: 'hybrid' }
          ]}
          single
        />

        <SuperSelect
          name="businessTravel"
          label={formatMessage({ id: 'employeeInfoForm.businessTravel' })}
          rule="REQ"
          options={[
            { label: formatMessage({ id: 'employeeInfoForm.businessTravelNo' }), value: 'no' },
            { label: formatMessage({ id: 'employeeInfoForm.businessTravelLittle' }), value: 'little' },
            { label: formatMessage({ id: 'employeeInfoForm.businessTravelFrequent' }), value: 'frequent' }
          ]}
          single
        />

        <SuperSelect
          name="assignment"
          label={formatMessage({ id: 'employeeInfoForm.assignment' })}
          rule="REQ"
          options={[
            { label: formatMessage({ id: 'employeeInfoForm.assignmentYes' }), value: 'yes' },
            { label: formatMessage({ id: 'employeeInfoForm.assignmentNo' }), value: 'no' }
          ]}
          single
        />
      </Card>
    );
  })
);

export default MobilityCard;
