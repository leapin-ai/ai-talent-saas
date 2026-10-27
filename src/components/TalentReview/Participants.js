import { useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { App, Dropdown, Empty, Flex, Spin, Tooltip } from 'antd';
import { DownOutlined, FileTextOutlined } from '@ant-design/icons';
import { createWithRemoteLoader } from '@kne/remote-loader';
import { useIntl } from '@kne/react-intl';
import { useFetch } from '@kne/react-fetch';
import { Page } from '@kne/system-layout';
import dayjs from 'dayjs';
import get from 'lodash/get';
import withLocale from './withLocale';
import { StatusTag } from './common';
import { BIZ_UNIT_FILTER, filterValueOf, formatDate, localPage, MANUAL_ROLES } from './constants';
import { useApiAction } from './useApiAction';
import style from './style.module.scss';

const SUBMITTED = ['completed', 'ended', 'check'];

const memberStatus = member => {
  if (!member.invite) return 'notInvited';
  return SUBMITTED.includes(get(member, 'clientUser.status')) ? 'memberSubmitted' : 'notSubmitted';
};

const STATUS_TONE = { memberSubmitted: 'success', notSubmitted: 'draft', notInvited: 'draft' };

const ResendModal = createWithRemoteLoader({
  modules: ['components-core:FormInfo']
})(({ remoteModules, member, defaultExpires, onCancel, onOk }) => {
  const [FormInfo] = remoteModules;
  const { FormModal, fields } = FormInfo;
  const { Input, DatePicker } = fields;
  const { formatMessage } = useIntl();
  return (
    <FormModal
      open
      title={formatMessage({ id: 'resendInvitation' })}
      saveText={formatMessage({ id: 'invite' })}
      cancelText={formatMessage({ id: 'cancel' })}
      onClose={onCancel}
      formProps={{
        data: {
          name: member.name,
          email: member.email || '-',
          phone: member.phone || '-',
          expires: defaultExpires && dayjs(defaultExpires).isAfter(dayjs()) ? dayjs(defaultExpires) : dayjs().add(7, 'day')
        },
        onSubmit: onOk
      }}
    >
      <FormInfo
        column={2}
        list={[
          <Input name="name" label={formatMessage({ id: 'name' })} disabled block />,
          <Input name="email" label={formatMessage({ id: 'email' })} disabled />,
          <Input name="phone" label={formatMessage({ id: 'phone' })} disabled />,
          <DatePicker name="expires" label={formatMessage({ id: 'modelingDeadline' })} rule="REQ" disabledDate={date => date.isBefore(dayjs().startOf('day'))} block />
        ]}
      />
    </FormModal>
  );
});

const EvaluatorCell = ({ member, role, onResend }) => {
  const { formatMessage } = useIntl();
  const invite = get(member, `manualScore.invites.${role}`);
  if (!invite) return <span className={style['muted']}>-</span>;
  const evaluated = !!get(member, `manualScore.scores.${role}`);
  return (
    <Flex align="center" gap={6} className={style['evaluator-tag']}>
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 64 }} title={invite.name}>
        {invite.name}
      </span>
      {evaluated ? (
        <StatusTag tone="success">{formatMessage({ id: 'memberEvaluated' })}</StatusTag>
      ) : (
        <Dropdown trigger={['click']} menu={{ items: [{ key: 'resend', label: formatMessage({ id: 'resendInvitation' }) }], onClick: () => onResend(member, role) }}>
          <span style={{ cursor: 'pointer' }}>
            <StatusTag tone="draft">
              {formatMessage({ id: 'pending' })} <DownOutlined style={{ fontSize: 10 }} />
            </StatusTag>
          </span>
        </Dropdown>
      )}
    </Flex>
  );
};

const MemberTable = ({ remoteModules, projects, usePreset, baseUrl, initialProjectId }) => {
  const [BizUnit, TablePageRender, Filter] = remoteModules;
  const { SuperSelectFilterItem } = Filter.fields;
  const navigate = useNavigate();
  const { formatMessage } = useIntl();
  const { apis, ajax } = usePreset();
  const api = apis.talentSaas.tenant.talentReview;
  const [run] = useApiAction(usePreset);
  const { message } = App.useApp();
  const [resending, setResending] = useState(null);
  const [listKey, setListKey] = useState(0);
  const projectLabel = formatMessage({ id: 'reviewProject' });
  const optionOf = item => ({ value: String(item.id), label: item.name });
  const initialProject = projects.find(item => String(item.id) === initialProjectId) || projects[0];
  const [filterValue, setFilterValue] = useState([{ name: 'projectId', label: projectLabel, value: optionOf(initialProject) }]);
  const projectId = filterValueOf(filterValue.find(item => item.name === 'projectId')?.value);
  const project = projects.find(item => String(item.id) === projectId);
  const reload = () => setListKey(key => key + 1);
  const projectIdRef = useRef(projectId);
  projectIdRef.current = projectId;

  const listApis = useMemo(
    () => ({
      list: {
        loader: async ({ params }) => {
          const target = projects.find(item => String(item.id) === String(filterValueOf(params.filter?.projectId) || projectIdRef.current));
          if (!target) return { pageData: [], totalCount: 0 };
          const { data: resData } = await ajax(Object.assign({}, api.projectOrg, { params: { id: String(target.id) } }));
          if (resData.code !== 0) throw new Error(resData.msg);
          const members = (resData.data?.pageData || []).filter(item => item.nodeType === 'member').map(item => Object.assign({}, item, { viewStatus: memberStatus(item), project: target }));
          return localPage(members, params, (item, filter, keyword) => {
            const status = filterValueOf(filter.status);
            if (status && item.viewStatus !== status) return false;
            return !keyword || [item.name, item.employeeNo, item.email].filter(Boolean).some(value => String(value).toLowerCase().includes(keyword));
          });
        }
      }
    }),
    [projects, ajax, api.projectOrg]
  );

  const openReport = member => navigate(`${baseUrl}/participants/report/${member.clientUser.id}`);

  const resendEvaluator = async (member, role) => {
    const result = await run(api.resendEvaluator, { memberId: String(member.memberId), role }, formatMessage({ id: 'resendSuccess' }));
    result && reload();
  };

  const roleColumn = role => ({
    name: role,
    title: formatMessage({ id: role === 'superior' ? 'superior' : 'peers' }),
    type: 'other',
    width: 170,
    getValueOf: item => (get(item, 'project.setting.enableManualScore') ? <EvaluatorCell member={item} role={role} onResend={resendEvaluator} /> : <span className={style['muted']}>-</span>)
  });

  const getColumns = () => [
    {
      name: 'name',
      title: formatMessage({ id: 'participantCol' }),
      type: 'other',
      width: 160,
      getValueOf: item => (
        <Flex align="center" gap={8}>
          <span>{item.name}</span>
          {item.viewStatus === 'memberSubmitted' && item.clientUser?.id ? (
            <Tooltip title={formatMessage({ id: 'viewPersonalReport' })}>
              <FileTextOutlined style={{ color: 'var(--primary-color)', cursor: 'pointer' }} onClick={() => openReport(item)} />
            </Tooltip>
          ) : null}
        </Flex>
      )
    },
    { name: 'email', title: formatMessage({ id: 'email' }), width: 220, ellipsis: true, getValueOf: item => item.email || '-' },
    { name: 'phone', title: formatMessage({ id: 'phone' }), width: 140, getValueOf: item => item.phone || '-' },
    { name: 'status', title: formatMessage({ id: 'status' }), type: 'other', width: 120, getValueOf: item => <StatusTag tone={STATUS_TONE[item.viewStatus]}>{formatMessage({ id: item.viewStatus })}</StatusTag> },
    ...MANUAL_ROLES.map(roleColumn),
    {
      name: 'hr',
      title: formatMessage({ id: 'hr' }),
      type: 'other',
      width: 90,
      getValueOf: () => (
        <Tooltip title={formatMessage({ id: 'hrNotSupported' })}>
          <span className={style['muted']}>-</span>
        </Tooltip>
      )
    }
  ];

  return (
    <>
      <BizUnit
        key={listKey}
        isNext
        name="talent-review-participant"
        apis={listApis}
        getColumns={getColumns}
        getActionList={({ data: item, ...actionProps }) =>
          item.viewStatus === 'memberSubmitted'
            ? [{ ...actionProps, data: item, children: formatMessage({ id: 'viewPersonalReport' }), disabled: !item.clientUser?.id, onClick: () => openReport(item) }]
            : [{ ...actionProps, data: item, children: formatMessage({ id: 'resendInvitation' }), onClick: () => setResending(item) }]
        }
        filter={{
          value: filterValue,
          onChange: value => {
            if (value.some(item => item.name === 'projectId')) {
              setFilterValue(value);
              return;
            }
            message.warning(formatMessage({ id: 'projectFilterRequired' }));
            setFilterValue([{ name: 'projectId', label: projectLabel, value: optionOf(project || projects[0]) }, ...value]);
            // Filter 内部已移除该标签，受控值不变时不会回显，需重挂载
            reload();
          },
          list: [
            { type: SuperSelectFilterItem, props: { name: 'projectId', label: projectLabel, single: true, options: projects.map(optionOf) } },
            {
              type: SuperSelectFilterItem,
              props: { name: 'status', label: formatMessage({ id: 'status' }), single: true, options: ['notInvited', 'notSubmitted', 'memberSubmitted'].map(value => ({ value, label: formatMessage({ id: value }) })) }
            }
          ]
        }}
        options={{
          bizName: formatMessage({ id: 'participants' }),
          keywordFilterLabel: formatMessage({ id: 'searchMember' }),
          mapFilterValue: BIZ_UNIT_FILTER,
          tableProps: { rowKey: 'id', pagination: { pageSize: 20 } }
        }}
      >
        {renderProps => (
          <Page title={formatMessage({ id: 'participants' })}>
            <div className={style['page']}>
              {project?.startTime ? (
                <div className={style['muted']} style={{ fontSize: 12 }}>
                  {formatMessage({ id: 'periodLabel' }, { start: formatDate(project.startTime), end: formatDate(project.endTime) })}
                </div>
              ) : null}
              <TablePageRender {...renderProps} withPage={false} />
            </div>
          </Page>
        )}
      </BizUnit>
      {resending ? (
        <ResendModal
          member={resending}
          defaultExpires={resending.project.endTime}
          onCancel={() => setResending(null)}
          onOk={async values => {
            const result = await run(api.resendMember, { id: String(resending.project.id), memberId: String(resending.memberId), expires: dayjs(values.expires).endOf('day').toISOString() }, formatMessage({ id: 'resendSuccess' }));
            if (result) {
              setResending(null);
              reload();
            }
          }}
        />
      ) : null}
    </>
  );
};

const Participants = createWithRemoteLoader({
  modules: ['components-core:Global@usePreset', 'components-admin:BizUnit', 'components-admin:BizUnit@TablePageRender', 'components-core:Filter']
})(
  withLocale(({ remoteModules, guard, baseUrl }) => {
    const [usePreset, ...tableModules] = remoteModules;
    const { apis } = usePreset();
    const { formatMessage } = useIntl();
    const [searchParams] = useSearchParams();
    const { data: projectData, isComplete } = useFetch(apis.talentSaas.tenant.talentReview.projectList);
    const projects = projectData?.pageData || [];

    return guard(
      !isComplete ? (
        <Spin style={{ display: 'block', padding: 80 }} />
      ) : !projects.length ? (
        <Page title={formatMessage({ id: 'participants' })}>
          <Empty description={formatMessage({ id: 'noProjects' })} />
        </Page>
      ) : (
        <MemberTable remoteModules={tableModules} projects={projects} usePreset={usePreset} baseUrl={baseUrl} initialProjectId={searchParams.get('projectId')} />
      )
    );
  })
);

export default Participants;
