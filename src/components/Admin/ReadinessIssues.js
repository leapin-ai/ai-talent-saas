import { useCallback, useMemo, useState } from 'react';
import { Input, Modal, Typography, message } from 'antd';
import { createWithRemoteLoader } from '@kne/remote-loader';
import { useIntl } from '@kne/react-intl';
import withLocale from '@components/TenantAdmin/withLocale';

const REASON_LABEL_IDS = {
  level_too_low: 'tenantAdmin.readinessIssueReasonLevelTooLow',
  level_too_high: 'tenantAdmin.readinessIssueReasonLevelTooHigh',
  evidence_incorrect: 'tenantAdmin.readinessIssueReasonEvidenceIncorrect',
  requirement_incorrect: 'tenantAdmin.readinessIssueReasonRequirementIncorrect',
  other: 'tenantAdmin.readinessIssueReasonOther'
};

const STATUS_LABEL_IDS = {
  open: 'tenantAdmin.readinessIssueStatusOpen',
  resolved: 'tenantAdmin.readinessIssueStatusResolved',
  closed: 'tenantAdmin.readinessIssueStatusClosed'
};

const READINESS_STATUS_LABEL_IDS = {
  critical: 'tenantAdmin.readinessIssueReadinessCritical',
  gap: 'tenantAdmin.readinessIssueReadinessGap',
  onTarget: 'tenantAdmin.readinessIssueReadinessOnTarget',
  above: 'tenantAdmin.readinessIssueReadinessAbove'
};

/** 平台 Admin → 租户管理 → 设置：查看/处理就绪纠错反馈 */
const ReadinessIssues = createWithRemoteLoader({
  modules: ['components-core:Global@usePreset', 'components-core:TablePage', 'components-core:Filter']
})(
  withLocale(({ remoteModules, tenant }) => {
    const [usePreset, TablePage, Filter] = remoteModules;
    const { apis, ajax } = usePreset();
    const { formatMessage } = useIntl();
    const { InputFilterItem, SuperSelectFilterItem } = Filter.fields;
    const [reloadKey, setReloadKey] = useState(0);

    const tenantId = tenant?.id;
    const listApi = apis?.talentSaas?.tenantAdmin?.readinessIssue?.list;
    const resolveApi = apis?.talentSaas?.tenantAdmin?.readinessIssue?.resolve;

    const resolveIssue = useCallback(
      async (item, status) => {
        if (!resolveApi || !tenantId) {
          return false;
        }
        let resolveNote = item.resolveNote || '';
        return new Promise(resolve => {
          Modal.confirm({
            title: formatMessage({
              id: status === 'closed' ? 'tenantAdmin.readinessIssueCloseConfirm' : 'tenantAdmin.readinessIssueResolveConfirm'
            }),
            content: (
              <div style={{ marginTop: 12 }}>
                <Typography.Paragraph type="secondary" style={{ marginBottom: 8 }}>
                  {formatMessage({ id: 'tenantAdmin.readinessIssueResolveNote' })}
                </Typography.Paragraph>
                <Input.TextArea
                  rows={3}
                  defaultValue={resolveNote}
                  maxLength={2000}
                  onChange={e => {
                    resolveNote = e.target.value;
                  }}
                  placeholder={formatMessage({ id: 'tenantAdmin.readinessIssueResolveNotePlaceholder' })}
                />
              </div>
            ),
            onOk: async () => {
              const { data: resData } = await ajax(
                Object.assign({}, resolveApi, {
                  data: { tenantId, id: item.id, status, resolveNote }
                })
              );
              if (resData.code !== 0) {
                throw new Error(resData.msg || formatMessage({ id: 'tenantAdmin.readinessIssueActionFailed' }));
              }
              message.success(
                formatMessage({
                  id: status === 'closed' ? 'tenantAdmin.readinessIssueCloseSuccess' : 'tenantAdmin.readinessIssueResolveSuccess'
                })
              );
              setReloadKey(key => key + 1);
              resolve(true);
            },
            onCancel: () => resolve(false)
          });
        });
      },
      [ajax, formatMessage, resolveApi, tenantId]
    );

    const reopenIssue = useCallback(
      async item => {
        if (!resolveApi || !tenantId) {
          return;
        }
        Modal.confirm({
          title: formatMessage({ id: 'tenantAdmin.readinessIssueReopenConfirm' }),
          onOk: async () => {
            const { data: resData } = await ajax(
              Object.assign({}, resolveApi, {
                data: { tenantId, id: item.id, status: 'open' }
              })
            );
            if (resData.code !== 0) {
              throw new Error(resData.msg || formatMessage({ id: 'tenantAdmin.readinessIssueActionFailed' }));
            }
            message.success(formatMessage({ id: 'tenantAdmin.readinessIssueReopenSuccess' }));
            setReloadKey(key => key + 1);
          }
        });
      },
      [ajax, formatMessage, resolveApi, tenantId]
    );

    const columns = useMemo(
      () => [
        {
          name: 'employeeName',
          title: formatMessage({ id: 'tenantAdmin.readinessIssueEmployee' }),
          getValueOf: item => item.employeeName || item.employeeId || '-'
        },
        {
          name: 'positionName',
          title: formatMessage({ id: 'tenantAdmin.readinessIssuePosition' }),
          getValueOf: item => item.positionName || '-'
        },
        {
          name: 'taskTitle',
          title: formatMessage({ id: 'tenantAdmin.readinessIssueTask' }),
          getValueOf: item => item.taskTitle || '-'
        },
        {
          name: 'activityGroup',
          title: formatMessage({ id: 'tenantAdmin.readinessIssueActivityGroup' }),
          getValueOf: item => item.activityGroup || '-'
        },
        {
          name: 'levelSnapshot',
          title: formatMessage({ id: 'tenantAdmin.readinessIssueLevel' }),
          getValueOf: item => {
            const current = item.current == null ? '-' : item.current;
            const required = item.required == null ? '-' : item.required;
            return `${current} / ${required}`;
          }
        },
        {
          name: 'readinessStatus',
          title: formatMessage({ id: 'tenantAdmin.readinessIssueReadiness' }),
          getValueOf: item => (item.readinessStatus ? formatMessage({ id: READINESS_STATUS_LABEL_IDS[item.readinessStatus] || 'tenantAdmin.readinessIssueReadinessUnknown' }) : '-')
        },
        {
          name: 'reason',
          title: formatMessage({ id: 'tenantAdmin.readinessIssueReason' }),
          getValueOf: item => formatMessage({ id: REASON_LABEL_IDS[item.reason] || 'tenantAdmin.readinessIssueReasonOther' })
        },
        {
          name: 'comment',
          title: formatMessage({ id: 'tenantAdmin.readinessIssueComment' }),
          getValueOf: item => item.comment || '-'
        },
        {
          name: 'status',
          title: formatMessage({ id: 'tenantAdmin.readinessIssueStatus' }),
          getValueOf: item => formatMessage({ id: STATUS_LABEL_IDS[item.status] || 'tenantAdmin.readinessIssueStatusOpen' })
        },
        {
          name: 'createdAt',
          title: formatMessage({ id: 'tenantAdmin.readinessIssueCreatedAt' }),
          renderType: 'date',
          format: 'YYYY-MM-DD HH:mm'
        },
        {
          name: 'options',
          title: formatMessage({ id: 'tenantAdmin.readinessIssueActions' }),
          fixed: 'right',
          renderType: 'options',
          getValueOf: item => {
            if (item.status === 'open') {
              return [
                {
                  children: formatMessage({ id: 'tenantAdmin.readinessIssueResolve' }),
                  onClick: () => resolveIssue(item, 'resolved')
                },
                {
                  children: formatMessage({ id: 'tenantAdmin.readinessIssueClose' }),
                  danger: true,
                  onClick: () => resolveIssue(item, 'closed')
                }
              ];
            }
            return [
              {
                children: formatMessage({ id: 'tenantAdmin.readinessIssueReopen' }),
                onClick: () => reopenIssue(item)
              }
            ];
          }
        }
      ],
      [formatMessage, reopenIssue, resolveIssue]
    );

    if (!tenantId || !listApi) {
      return null;
    }

    return (
      <TablePage
        key={reloadKey}
        {...listApi}
        params={{ tenantId }}
        name="admin-readiness-issues"
        rowKey="id"
        columns={columns}
        filter={{
          list: [
            {
              type: InputFilterItem,
              props: {
                name: 'keyword',
                label: formatMessage({ id: 'tenantAdmin.readinessIssueKeyword' })
              }
            },
            {
              type: SuperSelectFilterItem,
              props: {
                name: 'status',
                label: formatMessage({ id: 'tenantAdmin.readinessIssueStatus' }),
                single: true,
                options: [
                  { label: formatMessage({ id: 'tenantAdmin.readinessIssueStatusOpen' }), value: 'open' },
                  { label: formatMessage({ id: 'tenantAdmin.readinessIssueStatusResolved' }), value: 'resolved' },
                  { label: formatMessage({ id: 'tenantAdmin.readinessIssueStatusClosed' }), value: 'closed' }
                ]
              }
            },
            {
              type: SuperSelectFilterItem,
              props: {
                name: 'reason',
                label: formatMessage({ id: 'tenantAdmin.readinessIssueReason' }),
                single: true,
                options: Object.keys(REASON_LABEL_IDS).map(value => ({
                  label: formatMessage({ id: REASON_LABEL_IDS[value] }),
                  value
                }))
              }
            }
          ],
          mapFilterValue: value => ({
            filter: Filter.getFilterValue(value)
          })
        }}
      />
    );
  })
);

export default ReadinessIssues;
