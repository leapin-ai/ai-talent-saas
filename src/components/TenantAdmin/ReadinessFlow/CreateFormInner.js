import { useEffect } from 'react';
import { Flex, Typography } from 'antd';
import { createWithRemoteLoader } from '@kne/remote-loader';
import { useIntl } from '@kne/react-intl';
import withLocale from '../withLocale';

/** 表单里 TenantUserSelect 的值 → 创建接口 recipients（兼容单选对象 / 多选数组） */
export const pickTenantMembers = list => {
  const rows = list == null ? [] : Array.isArray(list) ? list : [list];
  return rows
    .map(item => (item != null && typeof item === 'object' ? { name: item.name || '', tenantUserId: item.id } : { name: '', tenantUserId: item }))
    .filter(item => item.tenantUserId != null && item.tenantUserId !== '')
    .map(item => ({ name: item.name, tenantUserId: String(item.tenantUserId) }));
};

/** 手动添加行 → { name, email }（须有邮箱） */
export const pickManualRecipients = rows => (Array.isArray(rows) ? rows : []).map(row => ({ name: String(row?.name || '').trim(), email: String(row?.email || '').trim() })).filter(item => item.email);

/** 组织是否已选经理（单选可能是对象或单元素数组） */
const hasManagerPicked = managers => {
  if (managers == null || managers === '') {
    return false;
  }
  const rows = Array.isArray(managers) ? managers : [managers];
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

/** 经理：组织优先；未选组织时用手动添加（最多一人） */
export const pickCreateManagers = formData => {
  const fromOrg = pickTenantMembers(formData?.managers);
  if (fromOrg.length) {
    return fromOrg;
  }
  return pickManualRecipients(formData?.manualManagers);
};

/** 员工：组织选择 + 手动添加合并 */
export const pickCreateEmployees = formData => [...pickTenantMembers(formData?.employees), ...pickManualRecipients(formData?.manualEmployees)];

/** 岗位 description + requirement → 流程 JD */
export const buildJdFromPosition = position =>
  [position?.description, position?.requirement]
    .map(text => (text == null ? '' : String(text).trim()))
    .filter(Boolean)
    .join('\n\n');

/**
 * 新建 / 启动 / 岗位重建 共用表单。
 * - 默认：可选岗位来源（已有 / 新建 Role）+ 岗位下拉（Admin 新建流程）
 * - fixedPosition：隐藏来源与岗位选择，默认当前岗位（租户岗位列表「启动」「岗位重建」）
 * - orgApi / userApi：租户侧传入会话内接口；缺省则走 Admin 的 tenantAdmin 接口并带 tenantId
 * - 经理 / 员工均支持组织选择 + 手动添加（经理选中组织后隐藏手动添加）
 */
const CreateFormInner = createWithRemoteLoader({
  modules: ['components-core:FormInfo', 'components-core:Global@usePreset', 'components-admin:Tenant@TenantUserSelect']
})(
  withLocale(({ remoteModules, positions = [], tenantId, fixedPosition, orgApi, userApi }) => {
    const [FormInfo, usePreset, TenantUserSelect] = remoteModules;
    const { useFormContext, TableList } = FormInfo;
    const { Select, RadioGroup, Switch, Input, TextArea } = FormInfo.fields;
    const { formData, openApi } = useFormContext();
    const { apis } = usePreset();
    const { formatMessage } = useIntl();
    const t = (id, values) => formatMessage({ id: `tenantAdmin.readiness.${id}` }, values);
    const withTenant = api => ({ ...api, params: { ...api.params, tenantId } });
    const resolvedOrgApi = orgApi || withTenant(apis.talentSaas.tenantAdmin.orgList);
    const resolvedUserApi = userApi || withTenant(apis.talentSaas.tenantAdmin.userList);
    const locked = !!fixedPosition;
    const isNewRole = !locked && formData?.sourceType === 'new';
    const managerPicked = hasManagerPicked(formData?.managers);
    const showManagerManual = !managerPicked;

    // 已从组织选中经理时清空手动行，避免隐藏后仍带进提交
    useEffect(() => {
      if (!managerPicked) {
        return;
      }
      const manual = formData?.manualManagers;
      if (Array.isArray(manual) && manual.length) {
        openApi?.setFields([{ name: 'manualManagers', value: [] }], { runValidate: false });
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [managerPicked]);

    const applyPositionFields = position => {
      if (!position) {
        return;
      }
      openApi.setFields(
        [
          { name: 'language', value: position.language || 'zh-CN' },
          { name: 'roleName', value: position.name || '' },
          { name: 'jd', value: buildJdFromPosition(position) }
        ],
        { runValidate: false }
      );
    };

    const onSourceTypeChange = value => {
      if (value === 'new') {
        openApi.setFields(
          [
            { name: 'positionId', value: undefined },
            { name: 'roleName', value: '' },
            { name: 'jd', value: '' }
          ],
          { runValidate: false }
        );
        return;
      }
      const position = positions.find(item => String(item.id) === String(formData?.positionId));
      if (position) {
        applyPositionFields(position);
      }
    };

    const onPositionChange = value => {
      const position = positions.find(item => String(item.id) === String(value));
      applyPositionFields(position);
    };

    return (
      <Flex vertical gap={16}>
        <FormInfo
          column={1}
          list={[
            locked ? null : (
              <RadioGroup
                name="sourceType"
                label={t('createSource')}
                rule="REQ"
                options={[
                  { label: t('createSourceExisting'), value: 'existing' },
                  { label: t('createSourceNew'), value: 'new' }
                ]}
                onChange={onSourceTypeChange}
              />
            ),
            locked || isNewRole ? null : <Select name="positionId" label={t('position')} rule="REQ" options={positions.map(item => ({ label: item.name, value: String(item.id) }))} onChange={onPositionChange} />,
            <Input name="roleName" label={t('roleName')} rule="REQ" placeholder={t('roleNamePlaceholder')} />,
            <TextArea name="jd" label={t('jd')} rule="REQ" placeholder={t('jdPlaceholder')} autoSize={{ minRows: 4, maxRows: 12 }} />,
            <RadioGroup
              name="language"
              label={t('language')}
              options={[
                { label: '中文', value: 'zh-CN' },
                { label: 'English', value: 'en-US' }
              ]}
            />,
            <TenantUserSelect name="managers" label={t('selectManagers')} single userStatus="open" orgApi={resolvedOrgApi} userApi={resolvedUserApi} height={360} showSelectedFooter />,
            <Typography.Text type="secondary">{t('managerRecipientTip')}</Typography.Text>
          ].filter(Boolean)}
        />
        {showManagerManual ? (
          <TableList
            title={t('addParticipants')}
            name="manualManagers"
            minLength={0}
            maxLength={1}
            list={[<Input name="name" label={t('participantName')} rule="LEN-0-100" />, <Input name="email" label={t('participantEmail')} rule="EMAIL LEN-0-100" />]}
          />
        ) : null}
        <FormInfo
          column={1}
          list={[
            <Switch name="hasStaffQuestionnaire" label={t('hasStaffQuestionnaire')} />,
            formData?.hasStaffQuestionnaire ? <TenantUserSelect name="employees" label={t('selectEmployees')} single={false} userStatus="open" orgApi={resolvedOrgApi} userApi={resolvedUserApi} height={360} showSelectedFooter /> : null
          ].filter(Boolean)}
        />
        {formData?.hasStaffQuestionnaire ? (
          <TableList
            title={t('addParticipants')}
            name="manualEmployees"
            minLength={0}
            list={[<Input name="name" label={t('participantName')} rule="LEN-0-100" />, <Input name="email" label={t('participantEmail')} rule="EMAIL LEN-0-100" />]}
          />
        ) : null}
      </Flex>
    );
  })
);

export default CreateFormInner;
