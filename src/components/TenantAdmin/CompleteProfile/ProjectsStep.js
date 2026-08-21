import { Typography } from 'antd';
import { useIntl } from '@kne/react-intl';
import style from './style.module.scss';

const ListOuter = ({ InfoPage, defaultAddText, add, addText, className, allowAdd, children, ...props }) => (
  <InfoPage.Part {...props} bordered className={className} extra={allowAdd ? <Typography.Link onClick={add}>{addText || defaultAddText}</Typography.Link> : null}>
    {children}
  </InfoPage.Part>
);

const ProjectsStep = ({ FormInfo, InfoPage }) => {
  const { List, fields } = FormInfo;
  const { Input, TextArea, Select, DatePickerToday } = fields;
  const { formatMessage } = useIntl();
  const addText = formatMessage({ id: 'tenantAdmin.completeAddProject' });

  if (!DatePickerToday) {
    console.error('[CompleteProfile] DatePickerToday is missing from FormInfo.fields');
  }

  return (
    <div className={style['projects-wrap']}>
      <List
        name="projects"
        title={formatMessage({ id: 'tenantAdmin.completeProjectsTitle' })}
        bordered
        outer={<ListOuter InfoPage={InfoPage} defaultAddText={addText} />}
        minLength={1}
        addText={addText}
        itemTitle={({ index }) => `${formatMessage({ id: 'tenantAdmin.completeProjectsTitle' })} ${index + 1}`}
        column={1}
        list={[
          <Input name="name" label={formatMessage({ id: 'tenantAdmin.completeProjectName' })} rule="REQ LEN-0-100" />,
          <Input name="role" label={formatMessage({ id: 'tenantAdmin.completeProjectRole' })} rule="LEN-0-100" />,
          DatePickerToday ? (
            <DatePickerToday name="period" label={formatMessage({ id: 'tenantAdmin.completeProjectPeriod' })} picker="month" soFarText={formatMessage({ id: 'tenantAdmin.completeSoFar' })} />
          ) : (
            <Input name="period" label={formatMessage({ id: 'tenantAdmin.completeProjectPeriod' })} rule="LEN-0-100" />
          ),
          <TextArea name="description" label={formatMessage({ id: 'tenantAdmin.completeProjectDesc' })} rule="LEN-0-2000" />,
          <Select name="skills" label={formatMessage({ id: 'tenantAdmin.completeProjectSkills' })} mode="tags" placeholder={formatMessage({ id: 'tenantAdmin.completeAddSkill' })} />
        ].filter(Boolean)}
      />
    </div>
  );
};

export default ProjectsStep;
