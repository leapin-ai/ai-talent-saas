import { useEffect, useState } from 'react';
import { Alert, Flex, Typography } from 'antd';
import classnames from 'classnames';
import dayjs from 'dayjs';
import { createWithRemoteLoader } from '@kne/remote-loader';
import { useIntl } from '@kne/react-intl';
import withLocale from '../withLocale';
import { notifyError } from './common';
import style from './flows.module.scss';

const memberField = runId => (runId ? `run_${runId}_members` : 'members');
const participantsField = runId => (runId ? `run_${runId}_participants` : 'participants');
const personIdsField = runId => (runId ? `run_${runId}_personIds` : 'personIds');

/** TenantUserSelect / 手动行 → recipients */
export const pickSendRecipients = (formData, runId) => {
  const raw = formData?.[memberField(runId)];
  const memberRows = raw == null ? [] : Array.isArray(raw) ? raw : [raw];
  const picked = memberRows
    .map(item => (item != null && typeof item === 'object' ? { name: item.name || '', id: item.id } : { name: '', id: item }))
    .filter(item => item.id != null && item.id !== '')
    .map(item => ({ name: item.name, tenantUserId: String(item.id) }));
  const manual = (formData?.[participantsField(runId)] || []).map(row => ({ name: String(row?.name || '').trim(), email: String(row?.email || '').trim() }));
  return [...picked, ...manual.filter(item => item.email)];
};

/** 当前 Role 已选收件人数（组织/手动 + 员工勾选已有参与人） */
const countSelected = (formData, kind, runId) => {
  const recipients = pickSendRecipients(formData, runId).length;
  if (kind !== 'staff') {
    return recipients;
  }
  const personIds = formData?.[personIdsField(runId)];
  return recipients + (Array.isArray(personIds) ? personIds.length : 0);
};

/**
 * 表单值 → 发送/预览接口入参
 * - 多 Role 的经理/员工：走 items，各 Role 各自收件人
 * - 单 Role 或补充问卷：仍可用共用 recipients / personIds
 */
export const buildSendBody = (runs, formData, fixedKind) => {
  const kind = fixedKind || formData.kind;
  const body = {
    kind,
    language: formData.language,
    deadline: formData.deadline ? dayjs(formData.deadline).format('YYYY-MM-DD') : undefined
  };
  const perRun = runs.length > 1 && (kind === 'manager' || kind === 'staff');
  if (perRun) {
    body.items = runs.map(run => {
      const runId = String(run.id);
      const item = { runId, recipients: pickSendRecipients(formData, runId) };
      if (kind === 'staff' && Array.isArray(formData[personIdsField(runId)])) {
        item.personIds = formData[personIdsField(runId)].map(String);
      }
      return item;
    });
    body.runIds = body.items.map(item => item.runId);
    return body;
  }

  body.runIds = runs.map(run => String(run.id));
  if (kind === 'manager' || kind === 'staff') {
    body.recipients = pickSendRecipients(formData);
  }
  if (kind !== 'manager' && Array.isArray(formData.personIds)) {
    body.personIds = formData.personIds.map(String);
  }
  return body;
};

/** 组织选择是否已有值（经理单选可能是对象，也可能是单元素数组） */
const hasMemberValue = (formData, runId) => {
  const raw = formData?.[memberField(runId)];
  if (raw == null || raw === '') {
    return false;
  }
  const rows = Array.isArray(raw) ? raw : [raw];
  return rows.some(item => {
    if (item == null || item === '') {
      return false;
    }
    if (typeof item === 'object') {
      return item.id != null && item.id !== '';
    }
    return true;
  });
};

const RecipientBlock = ({ FormInfo, TenantUserSelect, TableList, Input, CheckboxGroup, Typography, kind, run, persons, withTenant, apis, t, perRun, formData, openApi }) => {
  const runId = perRun ? String(run.id) : '';
  const title = perRun ? `${run.roleName || runId}` : t('sendRecipients');
  const managerPicked = kind === 'manager' && hasMemberValue(formData, runId);
  const showManual = kind === 'staff' || (kind === 'manager' && !managerPicked);

  // 已从组织选中经理时清空手动行，避免隐藏后仍带进提交
  useEffect(() => {
    if (!managerPicked) {
      return;
    }
    const manual = formData?.[participantsField(runId)];
    if (Array.isArray(manual) && manual.length) {
      openApi?.setFields([{ name: participantsField(runId), value: [] }], { runValidate: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [managerPicked, runId]);

  return (
    <Flex vertical gap={8}>
      {perRun ? (
        <Typography.Text strong>
          {t('role')}：{run.roleName || runId}
        </Typography.Text>
      ) : null}
      <FormInfo
        title={perRun ? null : title}
        column={1}
        list={[
          kind === 'staff' && persons.length ? <CheckboxGroup name={personIdsField(runId)} label={t('existingParticipants')} block options={persons.map(item => ({ label: item.label, value: item.personId }))} /> : null,
          kind === 'manager' || kind === 'staff' ? (
            <TenantUserSelect
              name={memberField(runId)}
              label={kind === 'manager' ? t('selectManagers') : t('selectEmployees')}
              single={kind === 'manager'}
              userStatus="open"
              orgApi={withTenant(apis.talentSaas.tenantAdmin.orgList)}
              userApi={withTenant(apis.talentSaas.tenantAdmin.userList)}
              height={perRun ? 320 : 420}
              showSelectedFooter
            />
          ) : null,
          kind === 'manager' ? <Typography.Text type="secondary">{t('managerRecipientTip')}</Typography.Text> : null
        ].filter(Boolean)}
      />
      {showManual ? (
        <TableList
          title={t('addParticipants')}
          name={participantsField(runId)}
          minLength={0}
          maxLength={kind === 'manager' ? 1 : undefined}
          list={[<Input name="name" label={t('participantName')} rule="LEN-0-100" />, <Input name="email" label={t('participantEmail')} rule="EMAIL LEN-0-100" />]}
        />
      ) : null}
    </Flex>
  );
};

/** 发送弹窗表单：选问卷类型（阶段入口已固定类型时不显示）、收件人、语言、截止日期，可先预览 */
const SendFormInner = createWithRemoteLoader({
  modules: ['components-core:FormInfo', 'components-core:TablePage@Table', 'components-core:Global@usePreset', 'components-admin:Tenant@TenantUserSelect']
})(
  withLocale(({ remoteModules, runs, call, api, fixedKind }) => {
    const [FormInfo, Table, usePreset, TenantUserSelect] = remoteModules;
    const { apis } = usePreset();
    const { useFormContext, FormApiButton, TableList } = FormInfo;
    const { RadioGroup, Input, DatePicker, CheckboxGroup } = FormInfo.fields;
    const { formData, openApi } = useFormContext();
    const { formatMessage } = useIntl();
    const [preview, setPreview] = useState(null);
    /** staff：{ [runId]: [{ personId, label }] }；单 Role 时也用 runId 键 */
    const [personsByRun, setPersonsByRun] = useState({});
    const [activeRunId, setActiveRunId] = useState(() => String(runs[0]?.id || ''));
    const t = (id, values) => formatMessage({ id: `tenantAdmin.readiness.${id}` }, values);
    const kind = fixedKind || formData?.kind;
    const tenantId = runs[0]?.tenantId;
    const withTenant = api => ({ ...api, params: { ...api.params, tenantId } });
    const perRun = runs.length > 1 && (kind === 'manager' || kind === 'staff');

    useEffect(() => {
      if (!runs.some(run => String(run.id) === activeRunId)) {
        setActiveRunId(String(runs[0]?.id || ''));
      }
    }, [runs, activeRunId]);

    useEffect(() => {
      if (!kind || kind === 'manager') {
        setPersonsByRun({});
        return undefined;
      }
      let cancelled = false;
      call(api.sendPreview, { kind, runIds: runs.map(run => String(run.id)) })
        .then(res => {
          if (cancelled) {
            return;
          }
          const map = {};
          (res?.eligible || []).forEach(item => {
            map[String(item.runId)] = (item.targets || []).filter(target => target.personId).map(target => ({ personId: target.personId, label: `${target.name || ''} <${target.email}>` }));
          });
          setPersonsByRun(map);
        })
        .catch(notifyError);
      return () => {
        cancelled = true;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [kind]);

    useEffect(() => {
      const fields = Object.entries(personsByRun).map(([runId, list]) => ({
        name: personIdsField(runs.length > 1 ? runId : ''),
        value: list.map(item => item.personId)
      }));
      if (fields.length) {
        openApi.setFields(fields, { runValidate: false });
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [personsByRun]);

    const doPreview = async data => {
      try {
        setPreview(await call(api.sendPreview, buildSendBody(runs, data, fixedKind)));
      } catch (e) {
        notifyError(e);
      }
    };

    const roleColumn = { name: 'roleName', title: t('role') };
    const reasonColumn = { name: 'reason', title: t('reason') };

    const renderRecipientBlocks = (list, hideInactive) =>
      list.map(run => {
        const runId = String(run.id);
        const active = !hideInactive || runId === activeRunId;
        return (
          <div key={runId} className={hideInactive && !active ? style.sendRecipientHidden : undefined} aria-hidden={hideInactive && !active ? true : undefined}>
            <RecipientBlock
              FormInfo={FormInfo}
              TenantUserSelect={TenantUserSelect}
              TableList={TableList}
              Input={Input}
              CheckboxGroup={CheckboxGroup}
              Typography={Typography}
              kind={kind}
              run={run}
              persons={personsByRun[runId] || []}
              withTenant={withTenant}
              apis={apis}
              t={t}
              perRun={perRun}
              formData={formData}
              openApi={openApi}
            />
          </div>
        );
      });

    return (
      <Flex vertical gap={16}>
        {runs.length > 1 ? <Alert type="info" showIcon message={t(perRun ? 'sendPerRunTip' : 'sendIndependentTip', { count: runs.length })} /> : null}
        {fixedKind ? null : <FormInfo column={1} list={[<RadioGroup name="kind" label={t('kindLabel')} rule="REQ" options={['manager', 'staff', 'reassess'].map(value => ({ value, label: t(`kind.${value}`) }))} />]} />}

        {kind === 'reassess' ? (
          <FormInfo
            title={t('sendRecipients')}
            column={1}
            list={[
              Object.values(personsByRun).flat().length ? (
                <CheckboxGroup
                  name="personIds"
                  label={t('existingParticipants')}
                  block
                  options={Object.entries(personsByRun).flatMap(([runId, list]) => {
                    const run = runs.find(item => String(item.id) === String(runId));
                    return list.map(item => ({
                      label: `${runs.length > 1 ? `${run?.roleName || runId} · ` : ''}${item.label}`,
                      value: item.personId
                    }));
                  })}
                />
              ) : null,
              <Typography.Text type="secondary">{t('participantRecipientsTip')}</Typography.Text>
            ].filter(Boolean)}
          />
        ) : null}

        {kind === 'manager' || kind === 'staff' ? (
          perRun ? (
            <div className={style.sendSplit}>
              <aside className={style.sendRoleNav}>
                <div className={style.sendRoleNavTitle}>{t('sendRoleList')}</div>
                <ul className={style.sendRoleList} role="tablist">
                  {runs.map(run => {
                    const runId = String(run.id);
                    const count = countSelected(formData, kind, runId);
                    return (
                      <li key={runId}>
                        <button type="button" role="tab" aria-selected={runId === activeRunId} className={classnames(style.sendRoleItem, { [style.sendRoleItemActive]: runId === activeRunId })} onClick={() => setActiveRunId(runId)}>
                          <span className={style.sendRoleName}>{run.roleName || runId}</span>
                          <span className={style.sendRoleMeta}>{count > 0 ? t('sendSelectedCount', { count }) : t('sendNotSelected')}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </aside>
              <div className={style.sendRecipientPane}>{renderRecipientBlocks(runs, true)}</div>
            </div>
          ) : (
            renderRecipientBlocks([runs[0]], false)
          )
        ) : null}

        <FormInfo
          title={t('mailSettings')}
          column={1}
          list={[
            <RadioGroup
              name="language"
              label={t('language')}
              options={[
                { label: '中文邮件', value: 'zh-CN' },
                { label: 'English mail', value: 'en-US' }
              ]}
            />,
            <DatePicker name="deadline" label={t('deadline')} disabledDate={current => current && current.isBefore(dayjs().startOf('day'))} />
          ]}
        />
        <Flex>
          <FormApiButton type="default" onClick={({ formData: data }) => doPreview(data)}>
            {t('preview')}
          </FormApiButton>
        </Flex>
        {preview ? (
          <Flex vertical gap={8}>
            <Typography.Text strong>{t('willSend')}</Typography.Text>
            <Table
              rowKey="runId"
              dataSource={preview.eligible}
              columns={[roleColumn, { name: 'targets', title: t('recipients'), getValueOf: item => item.targets.map(target => (target.name ? `${target.name} <${target.email}>` : target.email)).join('、') }]}
            />
            {preview.skipped.length ? (
              <>
                <Typography.Text strong type="warning">
                  {t('skipped')}
                </Typography.Text>
                <Table rowKey="runId" dataSource={preview.skipped} columns={[roleColumn, reasonColumn]} />
              </>
            ) : null}
            {preview.skippedPersons?.length ? <Alert type="warning" message={preview.skippedPersons.map(item => `${item.name}：${item.reason}`).join('；')} /> : null}
            {preview.invalidRecipients?.length ? (
              <Alert type="error" message={`${t('invalidEmails')}${preview.invalidRecipients.map(item => (item.email ? item.email : `${item.name}（${item.reason || t('noEmail')}）`)).join('、')}`} />
            ) : null}
          </Flex>
        ) : null}
      </Flex>
    );
  })
);

export default SendFormInner;
