import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import classnames from 'classnames';
import { App, Button, Empty, Flex, Modal, Spin, Table, Tree, TreeSelect } from 'antd';
import { EditOutlined, UserAddOutlined } from '@ant-design/icons';
import { createWithRemoteLoader } from '@kne/remote-loader';
import { useIntl } from '@kne/react-intl';
import { useFetch } from '@kne/react-fetch';
import { Page } from '@kne/system-layout';
import dayjs from 'dayjs';
import withLocale from './withLocale';
import { StepBar } from './common';
import { useApiAction } from './useApiAction';
import { defaultInviteExpires, disableInviteExpiresDate, isInviteExpiresInvalid } from './inviteExpires';
import style from './style.module.scss';

const UNGROUPED = '__ungrouped__';
const empKey = id => `emp:${id}`;

/** 组织树 + 每个组织（含下级）的人数；员工作为叶子节点 */
const buildTree = (orgs, employees, ungroupedLabel) => {
  const orgIds = new Set(orgs.map(item => item.id));
  const children = new Map();
  orgs.forEach(org => {
    const parent = org.parentId && orgIds.has(org.parentId) ? org.parentId : null;
    if (!children.has(parent)) children.set(parent, []);
    children.get(parent).push(org);
  });
  const byOrg = new Map();
  employees.forEach(emp => {
    const key = emp.orgId && orgIds.has(emp.orgId) ? emp.orgId : UNGROUPED;
    if (!byOrg.has(key)) byOrg.set(key, []);
    byOrg.get(key).push(emp);
  });
  const toNode = org => {
    const subOrgs = (children.get(org.id) || []).map(toNode);
    const members = (byOrg.get(org.id) || []).map(emp => ({ key: empKey(emp.id), title: emp.name, isLeaf: true }));
    const count = subOrgs.reduce((sum, item) => sum + item.count, 0) + members.length;
    return { key: `org:${org.id}`, name: org.name, count, children: [...subOrgs, ...members] };
  };
  const roots = (children.get(null) || []).map(toNode);
  const ungrouped = byOrg.get(UNGROUPED);
  if (ungrouped?.length) {
    roots.push({ key: `org:${UNGROUPED}`, name: ungroupedLabel, count: ungrouped.length, children: ungrouped.map(emp => ({ key: empKey(emp.id), title: emp.name, isLeaf: true })) });
  }
  const decorate = node =>
    node.isLeaf
      ? node
      : Object.assign({}, node, {
          title: (
            <Flex justify="space-between" style={{ width: '100%' }}>
              <span>{node.name}</span>
              <span className={style['muted']}>({node.count})</span>
            </Flex>
          ),
          children: node.children.map(decorate)
        });
  return roots.map(decorate);
};

const buildEmployeeTreeSelect = (orgs, employees, ungroupedLabel) => {
  const orgIds = new Set(orgs.map(item => item.id));
  const children = new Map();
  orgs.forEach(org => {
    const parent = org.parentId && orgIds.has(org.parentId) ? org.parentId : null;
    if (!children.has(parent)) children.set(parent, []);
    children.get(parent).push(org);
  });
  const byOrg = new Map();
  employees.forEach(emp => {
    const key = emp.orgId && orgIds.has(emp.orgId) ? emp.orgId : UNGROUPED;
    if (!byOrg.has(key)) byOrg.set(key, []);
    byOrg.get(key).push(emp);
  });
  const toNode = org => {
    const memberNodes = (byOrg.get(org.id) || []).map(emp => ({ value: emp.id, title: emp.name, isLeaf: true }));
    return {
      value: `org:${org.id}`,
      title: org.name,
      selectable: false,
      children: [...(children.get(org.id) || []).map(toNode), ...memberNodes]
    };
  };
  const roots = (children.get(null) || []).map(toNode);
  const ungrouped = byOrg.get(UNGROUPED);
  if (ungrouped?.length) {
    roots.push({
      value: `org:${UNGROUPED}`,
      title: ungroupedLabel,
      selectable: false,
      children: ungrouped.map(emp => ({ value: emp.id, title: emp.name, isLeaf: true }))
    });
  }
  return roots;
};

/** 默认上级：沿组织链找负责人（跳过本人）；默认同级：同组织第一位其他员工 */
const defaultEvaluators = (employee, { orgMap, employees, byTenantUser }) => {
  let superior;
  let org = employee.orgId ? orgMap.get(employee.orgId) : null;
  const seen = new Set();
  while (org && !seen.has(org.id)) {
    seen.add(org.id);
    const leader = org.leaderUserId ? byTenantUser.get(org.leaderUserId) : null;
    if (leader && leader.id !== employee.id) {
      superior = leader.id;
      break;
    }
    org = org.parentId ? orgMap.get(org.parentId) : null;
  }
  const peer = employees.find(item => item.id !== employee.id && item.id !== superior && item.orgId && item.orgId === employee.orgId)?.id;
  return { superior, peer };
};

const EvaluatorTreeField = ({ value, onChange, treeData, placeholder }) => (
  <TreeSelect value={value} onChange={onChange} treeData={treeData} allowClear showSearch treeDefaultExpandAll treeNodeFilterProp="title" placeholder={placeholder} style={{ width: '100%' }} />
);

const EvaluatorModal = ({ treeData, value, onCancel, onOk }) => {
  const { formatMessage } = useIntl();
  const [superior, setSuperior] = useState(value?.superior);
  const [peer, setPeer] = useState(value?.peer);
  const [hr, setHr] = useState(value?.hr);
  return (
    <Modal open title={formatMessage({ id: 'modifyEvaluator' })} okText={formatMessage({ id: 'save' })} cancelText={formatMessage({ id: 'cancel' })} onCancel={onCancel} onOk={() => onOk({ superior, peer, hr })}>
      <Flex vertical gap={16}>
        <div>
          <div style={{ marginBottom: 8 }}>{formatMessage({ id: 'superior' })}</div>
          <EvaluatorTreeField value={superior} onChange={setSuperior} treeData={treeData} placeholder={formatMessage({ id: 'selectFromOrgTree' })} />
        </div>
        <div>
          <div style={{ marginBottom: 8 }}>{formatMessage({ id: 'peers' })}</div>
          <EvaluatorTreeField value={peer} onChange={setPeer} treeData={treeData} placeholder={formatMessage({ id: 'selectFromOrgTree' })} />
        </div>
        <div>
          <div style={{ marginBottom: 8 }}>{formatMessage({ id: 'hr' })}</div>
          <EvaluatorTreeField value={hr} onChange={setHr} treeData={treeData} placeholder={formatMessage({ id: 'selectFromOrgTree' })} />
        </div>
      </Flex>
    </Modal>
  );
};

const InvitationInner = ({ FormInfo, project, source, baseUrl, usePreset }) => {
  const { Form, SubmitButton, fields } = FormInfo;
  const { Input, DatePicker } = fields;
  const { formatMessage } = useIntl();
  const navigate = useNavigate();
  const { message } = App.useApp();
  const { apis } = usePreset();
  const [run, submitting] = useApiAction(usePreset);
  const [step, setStep] = useState(0);
  const [checkedKeys, setCheckedKeys] = useState([]);
  const [rowKeys, setRowKeys] = useState([]);
  const [overrides, setOverrides] = useState({});
  const [editing, setEditing] = useState(null);

  const employees = useMemo(() => source.employees || [], [source.employees]);
  const context = useMemo(
    () => ({
      orgMap: new Map((source.orgs || []).map(item => [item.id, item])),
      employees,
      byTenantUser: new Map(employees.filter(item => item.tenantUserId).map(item => [item.tenantUserId, item]))
    }),
    [source.orgs, employees]
  );
  const empMap = useMemo(() => new Map(employees.map(item => [item.id, item])), [employees]);
  const treeData = useMemo(() => buildTree(source.orgs || [], employees, formatMessage({ id: 'ungrouped' })), [source.orgs, employees, formatMessage]);
  const evaluatorTreeData = useMemo(() => buildEmployeeTreeSelect(source.orgs || [], employees, formatMessage({ id: 'ungrouped' })), [source.orgs, employees, formatMessage]);
  const selected = checkedKeys
    .filter(key => String(key).startsWith('emp:'))
    .map(key => empMap.get(String(key).slice(4)))
    .filter(Boolean);
  const evaluatorsOf = emp => Object.assign({}, defaultEvaluators(emp, context), overrides[emp.id]);
  const nameOf = id => (id ? empMap.get(id)?.name : null) || '-';
  const allEmpKeys = employees.map(item => empKey(item.id));

  const columns = [
    { title: formatMessage({ id: 'participantCol' }), key: 'name', render: (_, item) => item.name },
    { title: formatMessage({ id: 'idCol' }), key: 'id', dataIndex: 'id', sorter: (a, b) => String(a.id).localeCompare(String(b.id)) },
    { title: formatMessage({ id: 'superior' }), key: 'superior', render: (_, item) => nameOf(evaluatorsOf(item).superior) },
    { title: formatMessage({ id: 'peers' }), key: 'peer', render: (_, item) => nameOf(evaluatorsOf(item).peer) },
    { title: formatMessage({ id: 'hr' }), key: 'hr', render: (_, item) => nameOf(evaluatorsOf(item).hr) }
  ];

  const evaluatorPayload = () => selected.reduce((result, emp) => Object.assign(result, { [emp.id]: evaluatorsOf(emp) }), {});

  const saveEvaluators = async () => {
    if (!selected.length) {
      message.error(formatMessage({ id: 'participantsRequired' }));
      return;
    }
    const result = await run(apis.talentSaas.tenant.talentReview.saveEvaluators, {
      id: project.id,
      employeeIds: selected.map(item => item.id),
      evaluators: evaluatorPayload()
    });
    if (!result) return;
    message.success(formatMessage({ id: 'saveEvaluatorsSuccess' }, { saved: result.saved || 0 }));
    if (result.errors?.length) {
      message.warning(formatMessage({ id: 'inviteScoreErrors' }, { count: result.errors.length }));
    }
  };

  const submit = async values => {
    if (isInviteExpiresInvalid(values.expires, project)) {
      message.error(formatMessage({ id: 'expiresAfterEnd' }));
      return;
    }
    const result = await run(apis.talentSaas.tenant.talentReview.projectInvite, {
      id: project.id,
      employeeIds: selected.map(item => item.id),
      evaluators: evaluatorPayload(),
      expires: values.expires ? dayjs(values.expires).endOf('day').toISOString() : undefined,
      needNotice: true
    });
    if (!result) return;
    message.success(formatMessage({ id: 'inviteSuccess' }, { invited: result.invited || 0, scoreInvited: result.scoreInvited || 0 }));
    if (result.errors?.length) {
      message.warning(formatMessage({ id: 'inviteScoreErrors' }, { count: result.errors.length }));
    }
    navigate(`${baseUrl}/participants?projectId=${project.id}`);
  };

  return (
    <Page
      title={
        <Flex align="baseline" gap={12}>
          {formatMessage({ id: 'sendInvitation' })}
          {step === 1 ? (
            <span className={style['muted']} style={{ fontWeight: 400 }}>
              {project.name}
            </span>
          ) : null}
        </Flex>
      }
      back
    >
      <Form data={{ expires: defaultInviteExpires(project.endTime) ? dayjs(defaultInviteExpires(project.endTime)) : undefined, assessmentDeadline: project.endTime ? dayjs(project.endTime) : undefined }} onSubmit={submit}>
        <div className={style['page']}>
          <StepBar items={[formatMessage({ id: 'selectParticipants' }), formatMessage({ id: 'invitationSetting' })]} current={step} />
          {step === 0 ? (
            <div className={style['invite-layout']}>
              <div className={style['org-panel']}>
                <div className={style['org-panel-title']}>{formatMessage({ id: 'selectParticipants' })}</div>
                <Flex justify="space-between" style={{ marginBottom: 8 }}>
                  <span>
                    {source.orgs?.find(item => !item.parentId)?.name || formatMessage({ id: 'participants' })} <span className={style['muted']}>({employees.length})</span>
                  </span>
                  <Button type="link" size="small" style={{ padding: 0, color: 'var(--primary-color)' }} onClick={() => setCheckedKeys(checkedKeys.length >= allEmpKeys.length ? [] : allEmpKeys)}>
                    {formatMessage({ id: 'selectAll' })}
                  </Button>
                </Flex>
                <Tree checkable blockNode selectable={false} treeData={treeData} checkedKeys={checkedKeys} onCheck={keys => setCheckedKeys(Array.isArray(keys) ? keys : keys.checked)} />
              </div>
              <Flex vertical gap={8}>
                <Flex justify="flex-end" align="center" gap={12}>
                  <span className={style['muted']}>{formatMessage({ id: 'selectedN' }, { count: rowKeys.length })}</span>
                  <Button size="small" icon={<EditOutlined />} disabled={!rowKeys.length} onClick={() => setEditing(rowKeys.length === 1 ? evaluatorsOf(empMap.get(rowKeys[0])) : {})}>
                    {formatMessage({ id: 'modifyEvaluator' })}
                  </Button>
                </Flex>
                <Table
                  className={classnames(style['table'])}
                  rowKey="id"
                  size="middle"
                  columns={columns}
                  dataSource={selected}
                  rowSelection={{ selectedRowKeys: rowKeys, onChange: setRowKeys }}
                  pagination={selected.length > 20 ? { pageSize: 20 } : false}
                  locale={{
                    emptyText: (
                      <Empty
                        description={
                          <span>
                            {formatMessage({ id: 'noParticipants' })}
                            <br />
                            <span className={style['muted']}>{formatMessage({ id: 'noParticipantsDesc' })}</span>
                          </span>
                        }
                      />
                    )
                  }}
                />
              </Flex>
            </div>
          ) : (
            <div className={style['info-form']}>
              <FormInfo
                title={formatMessage({ id: 'invitationSetting' })}
                column={2}
                list={[
                  <DatePicker name="expires" label={formatMessage({ id: 'reviewDeadline' })} rule="REQ" disabledDate={date => disableInviteExpiresDate(date, project)} />,
                  <DatePicker name="assessmentDeadline" label={formatMessage({ id: 'assessmentDeadline' })} tips={formatMessage({ id: 'notSupported' })} disabled />,
                  <Input name="contact" label={formatMessage({ id: 'contact' })} tips={formatMessage({ id: 'notSupported' })} disabled placeholder={formatMessage({ id: 'contactName' })} />,
                  <Input name="contactDetails" label={formatMessage({ id: 'contactDetails' })} tips={formatMessage({ id: 'notSupported' })} disabled placeholder={formatMessage({ id: 'contactPlaceholder' })} />
                ]}
              />
            </div>
          )}
        </div>
        <Page.Footer>
          <Button type="text" onClick={() => (step === 0 ? navigate(-1) : setStep(0))}>
            {formatMessage({ id: step === 0 ? 'cancel' : 'back' })}
          </Button>
          {step === 0 ? (
            <>
              <Button onClick={saveEvaluators} loading={submitting} disabled={!selected.length}>
                {formatMessage({ id: 'saveEvaluators' })}
              </Button>
              <Button
                type="primary"
                onClick={() => {
                  if (!selected.length) {
                    message.error(formatMessage({ id: 'participantsRequired' }));
                    return;
                  }
                  setStep(1);
                }}
              >
                {formatMessage({ id: 'next' })}
              </Button>
            </>
          ) : (
            <SubmitButton type="primary" loading={submitting}>
              {formatMessage({ id: 'invite' })} <UserAddOutlined />
            </SubmitButton>
          )}
        </Page.Footer>
        {editing ? (
          <EvaluatorModal
            treeData={evaluatorTreeData}
            value={editing}
            onCancel={() => setEditing(null)}
            onOk={values => {
              const patch = rowKeys.length === 1 ? values : Object.fromEntries(Object.entries(values).filter(([, value]) => value !== undefined));
              setOverrides(current => rowKeys.reduce((result, id) => Object.assign(result, { [id]: Object.assign({}, current[id], patch) }), Object.assign({}, current)));
              setEditing(null);
            }}
          />
        ) : null}
      </Form>
    </Page>
  );
};

const Invitation = createWithRemoteLoader({
  modules: ['components-core:Global@usePreset', 'components-core:FormInfo']
})(
  withLocale(({ remoteModules, baseUrl, guard }) => {
    const [usePreset, FormInfo] = remoteModules;
    const { apis } = usePreset();
    const { id } = useParams();
    const api = apis.talentSaas.tenant.talentReview;
    const { data: project } = useFetch(Object.assign({}, api.projectDetail, { params: { id } }));
    const { data: source } = useFetch(api.orgSource);
    if (!project || !source) {
      return guard(<Spin style={{ display: 'block', padding: 80 }} />);
    }
    return guard(<InvitationInner FormInfo={FormInfo} project={project} source={source} baseUrl={baseUrl} usePreset={usePreset} />);
  })
);

export default Invitation;
