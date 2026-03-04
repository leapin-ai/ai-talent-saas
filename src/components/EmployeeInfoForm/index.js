import React from 'react';
import { createWithRemoteLoader } from '@kne/remote-loader';
import style from './style.module.scss';
import ProfileCard from './ProfileCard';
import TagInputCard from './TagInputCard';
import MobilityCard from './MobilityCard';
import CertificateCard from './CertificateCard';

const EmployeeInfoForm = createWithRemoteLoader({
  modules: ['components-core:FormInfo']
})(({ remoteModules }) => {
  const [FormInfo] = remoteModules;
  const { Form, SubmitButton, TableList } = FormInfo;
  const { Input, TextArea } = FormInfo.fields;

  const avatarUrl =
    'https://lh3.googleusercontent.com/aida-public/AB6AXuC_AorCAIKZoI2DcahfuT4hT9GDUUaBpTlWUJr3Odohda9NuDi2rGCxWiHwow-OsNiPPrLtCIrMVU4Qgmrdt9H7-60ACubvKLb5EdJ8va-qaAPLMj_uaNUQ1Yolk_J-nfhIheltcXrRHkspotSFm3X6xjh9wKyM_NQYE_P3ACK6aNkJsUEoBca-5ursPSnyHnwZmAxZGHS2FUvH8E1piSMezqWm6H1XxWyU2Zm_G83zLtokX2mz2IOXE-TMwR6YKhDEbySePufNnvrE';

  const onFinish = values => {
    console.log('提交表单:', values);
  };

  return (
    <Form onSubmit={onFinish} className={style['employee-info-form']} bordered>
      <div className={style.container}>
        <div className={style.grid}>
          <div className={style['left-column']}>
            <ProfileCard avatarUrl={avatarUrl} />
          </div>

          <div className={style['middle-column']}>
            <TableList reverseOrder={true} bordered name="targetPositions" title="意向岗位" list={[<Input name="position" label="意向岗位" placeholder="请输入意向岗位" />]} />

            <TableList reverseOrder={true} bordered name="skills" title="技能指标" list={[<Input name="skill" label="技能指标" placeholder="请输入技能" />]} />

            <TableList reverseOrder={true} bordered name="interests" title="兴趣爱好" list={[<Input name="interest" label="兴趣爱好" placeholder="请输入兴趣爱好" />]} />
          </div>

          <div className={style['right-column']}>
            <MobilityCard />

            <TableList reverseOrder={true} bordered name="certificates" title="证书与执照" list={[<Input name="certificate" label="证书名称" placeholder="请输入证书名称" />]} />
          </div>
        </div>
      </div>
    </Form>
  );
});

export { default as ProfileCard } from './ProfileCard';
export { default as TagInputCard } from './TagInputCard';
export { default as MobilityCard } from './MobilityCard';
export { default as CertificateCard } from './CertificateCard';

export default EmployeeInfoForm;
