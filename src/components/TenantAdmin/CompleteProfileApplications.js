import { useCallback, useMemo, useState } from 'react';
import { message, Modal } from 'antd';
import { Page } from '@kne/system-layout';
import { createWithRemoteLoader } from '@kne/remote-loader';
import { useNavigate } from 'react-router-dom';
import { useIntl } from '@kne/react-intl';
import withLocale from './withLocale';

const STATUS_LABEL_IDS = {
  pending: 'tenantAdmin.assessmentStatusPending',
  interviewing: 'tenantAdmin.assessmentStatusInterviewing',
  generating: 'tenantAdmin.assessmentStatusGenerating',
  submitted: 'tenantAdmin.assessmentStatusSubmitted',
  approved: 'tenantAdmin.assessmentStatusApproved',
  closed: 'tenantAdmin.assessmentStatusClosed'
};

const CompleteProfileApplications = createWithRemoteLoader({
  modules: ['components-core:Global@usePreset', 'components-core:TablePage', 'components-core:Filter']
})(
  withLocale(({ remoteModules, baseUrl }) => {
    const [usePreset, TablePage, Filter] = remoteModules;
    const { apis, ajax } = usePreset();
    const navigate = useNavigate();
    const { formatMessage } = useIntl();
    const { InputFilterItem, SuperSelectFilterItem } = Filter.fields;
    const [reloadKey, setReloadKey] = useState(0);

    const runAction = useCallback(
      async (api, id, successId) => {
        const { data: resData } = await ajax(Object.assign({}, api, { data: { id } }));
        if (resData.code !== 0) {
          throw new Error(resData.msg || formatMessage({ id: 'tenantAdmin.completeProfileActionFailed' }));
        }
        message.success(formatMessage({ id: successId }));
        setReloadKey(key => key + 1);
        return resData.data;
      },
      [ajax, formatMessage]
    );

    const columns = useMemo(
      () => [
        {
          name: 'name',
          title: formatMessage({ id: 'tenantAdmin.completeFullName' }),
          renderType: 'main',
          onClick: ({ colItem }) => {
            navigate(`${baseUrl}/complete-profile-applications/${colItem.id}`);
          }
        },
        {
          name: 'phone',
          title: formatMessage({ id: 'tenantAdmin.completePhone' })
        },
        {
          name: 'email',
          title: formatMessage({ id: 'tenantAdmin.completeEmail' })
        },
        {
          name: 'status',
          title: formatMessage({ id: 'tenantAdmin.assessmentStatus' }),
          getValueOf: item => formatMessage({ id: STATUS_LABEL_IDS[item.status] || 'tenantAdmin.assessmentInterviewStatusUnknown' })
        },
        {
          name: 'projectName',
          title: formatMessage({ id: 'tenantAdmin.assessmentInterviewProject' })
        },
        {
          name: 'updatedAt',
          title: formatMessage({ id: 'tenantAdmin.completeProfileUpdatedAt' }),
          renderType: 'date',
          format: 'YYYY-MM-DD HH:mm'
        },
        {
          name: 'options',
          title: formatMessage({ id: 'tenantAdmin.completeProfileActions' }),
          fixed: 'right',
          renderType: 'options',
          getValueOf: item => {
            const actions = [
              {
                children: formatMessage({ id: 'tenantAdmin.completeProfileView' }),
                onClick: () => navigate(`${baseUrl}/complete-profile-applications/${item.id}`)
              }
            ];
            if (item.status === 'submitted') {
              actions.push(
                {
                  children: formatMessage({ id: 'tenantAdmin.completeProfileApprove' }),
                  onClick: () => {
                    Modal.confirm({
                      title: formatMessage({ id: 'tenantAdmin.completeProfileApproveConfirm' }),
                      onOk: () => runAction(apis.talentSaas.tenant.assessment.approve, item.id, 'tenantAdmin.completeProfileApproveSuccess')
                    });
                  }
                },
                {
                  children: formatMessage({ id: 'tenantAdmin.completeProfileReject' }),
                  danger: true,
                  onClick: () => {
                    Modal.confirm({
                      title: formatMessage({ id: 'tenantAdmin.completeProfileRejectConfirm' }),
                      onOk: () => runAction(apis.talentSaas.tenant.assessment.reject, item.id, 'tenantAdmin.completeProfileRejectSuccess')
                    });
                  }
                }
              );
            }
            return actions;
          }
        }
      ],
      [apis, baseUrl, formatMessage, navigate, runAction]
    );

    return (
      <Page title={formatMessage({ id: 'tenantAdmin.completeProfileApplications' })} back>
        <TablePage
          key={reloadKey}
          {...apis.talentSaas.tenant.assessment.list}
          name="complete-profile-applications"
          rowKey="id"
          columns={columns}
          filter={{
            list: [
              {
                type: InputFilterItem,
                props: {
                  name: 'keyword',
                  label: formatMessage({ id: 'tenantAdmin.completeProfileKeyword' })
                }
              },
              {
                type: SuperSelectFilterItem,
                props: {
                  name: 'status',
                  label: formatMessage({ id: 'tenantAdmin.assessmentStatus' }),
                  single: true,
                  options: [
                    { label: formatMessage({ id: 'tenantAdmin.assessmentStatusPending' }), value: 'pending' },
                    { label: formatMessage({ id: 'tenantAdmin.assessmentStatusInterviewing' }), value: 'interviewing' },
                    { label: formatMessage({ id: 'tenantAdmin.assessmentStatusGenerating' }), value: 'generating' },
                    { label: formatMessage({ id: 'tenantAdmin.assessmentStatusSubmitted' }), value: 'submitted' },
                    { label: formatMessage({ id: 'tenantAdmin.assessmentStatusApproved' }), value: 'approved' },
                    { label: formatMessage({ id: 'tenantAdmin.assessmentStatusClosed' }), value: 'closed' }
                  ]
                }
              }
            ],
            mapFilterValue: value => ({
              filter: Filter.getFilterValue(value)
            })
          }}
        />
      </Page>
    );
  })
);

export default CompleteProfileApplications;
