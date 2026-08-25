import { useCallback, useMemo, useRef } from 'react';
import { Flex } from 'antd';
import AppChildrenRouter from '@kne/app-children-router';
import Layout from './Layout';
import { Page } from '@kne/system-layout';
import { useNavigate } from 'react-router-dom';
import { createWithRemoteLoader } from '@kne/remote-loader';
import TalentMarket from '@components/TalentMarket';
import TalentProfile from '@components/TalentProfile';
import PositionInsightBanner from '@components/Position/InsightBanner';
import Home from './Home';
import CompleteProfile from './CompleteProfile';
import CompleteProfileApplicationEntry from './CompleteProfileApplicationEntry';
import CompleteProfileApplications from './CompleteProfileApplications';
import CompleteProfileApplicationDetail from './CompleteProfileApplicationDetail';
import withLocale from './withLocale';
import { useIntl } from '@kne/react-intl';
import { TENANT_ADMIN_PERMISSIONS } from './constants';

const TenantAdmin = createWithRemoteLoader({
  modules: ['components-admin:Tenant@Setting', 'components-core:Global@usePreset', 'components-admin:BizUnit@TablePageRender', 'components-core:File@PrintButton', 'components-core:Permissions']
})(
  withLocale(({ remoteModules, baseUrl }) => {
    const { formatMessage } = useIntl();
    const [Setting, usePreset, TablePageRender, PrintButton, Permissions] = remoteModules;
    const { apis } = usePreset();
    const profileRef = useRef(null);
    const navigate = useNavigate();
    const settingUserApis = useMemo(
      () => ({
        positionList: apis.talentSaas.tenant.position.list,
        list: apis.talentSaas.tenant.userList,
        sendOrgMessage: apis.talentSaas.tenantAdmin.sendOrgMessage,
        linkTenantUser: apis.talentSaas.tenant.employee.linkTenantUser,
        unlinkTenantUser: apis.talentSaas.tenant.employee.unlinkTenantUser,
        employeeList: apis.talentSaas.tenant.employee.list
      }),
      [
        apis.talentSaas.tenant.position.list,
        apis.talentSaas.tenant.userList,
        apis.talentSaas.tenantAdmin.sendOrgMessage,
        apis.talentSaas.tenant.employee.linkTenantUser,
        apis.talentSaas.tenant.employee.unlinkTenantUser,
        apis.talentSaas.tenant.employee.list
      ]
    );
    // Setting.User(isNext TablePage) 已自带筛选，勿再挂一层空 Filter
    const renderSettingUserPage = useCallback(
      ({ title, titleExtra, children }) => (
        <Page title={title} extra={titleExtra}>
          {children}
        </Page>
      ),
      []
    );
    return (
      <AppChildrenRouter
        errorPage
        notFoundPage
        baseUrl={baseUrl}
        element={<Layout baseUrl={baseUrl} />}
        list={[
          {
            index: true,
            title: formatMessage({ id: 'tenantAdmin.home' }),
            element: <Home baseUrl={baseUrl} />
          },
          {
            path: 'complete-profile',
            title: formatMessage({ id: 'tenantAdmin.completeMyProfile' }),
            element: <CompleteProfile baseUrl={baseUrl} />
          },
          {
            path: 'complete-profile-applications',
            title: formatMessage({ id: 'tenantAdmin.completeProfileApplications' }),
            element: (
              <Permissions request={TENANT_ADMIN_PERMISSIONS.employeeProfile} type="error">
                <CompleteProfileApplications baseUrl={baseUrl} />
              </Permissions>
            )
          },
          {
            path: 'complete-profile-applications/:id',
            title: formatMessage({ id: 'tenantAdmin.completeProfileApplicationDetail' }),
            element: (
              <Permissions request={TENANT_ADMIN_PERMISSIONS.employeeProfile} type="error">
                <CompleteProfileApplicationDetail baseUrl={baseUrl} />
              </Permissions>
            )
          },
          {
            path: 'market',
            title: formatMessage({ id: 'tenantAdmin.internalTalentMarket' }),
            element: (
              <Permissions request={TENANT_ADMIN_PERMISSIONS.talentMarketplace} type="error">
                <Page>
                  <TalentMarket
                    baseUrl={baseUrl}
                    apis={apis.talentSaas.tenant.market}
                    onMoreProfile={() => {
                      navigate(`${baseUrl}/employee`);
                    }}
                  />
                </Page>
              </Permissions>
            )
          },
          {
            path: 'profile/:id',
            title: formatMessage({ id: 'tenantAdmin.employeeProfile' }),
            element: (
              <Permissions request={TENANT_ADMIN_PERMISSIONS.employeeProfile} type="error">
                <Page title={formatMessage({ id: 'tenantAdmin.employeeProfile' })} back extra={<PrintButton contentRef={profileRef}>{formatMessage({ id: 'tenantAdmin.export' })}</PrintButton>}>
                  <div ref={profileRef}>
                    <TalentProfile
                      baseUrl={baseUrl}
                      apis={Object.assign({}, apis.talentSaas.tenant.employee, {
                        positionList: apis.talentSaas.tenant.position.list,
                        parseResume: apis.talentSaas.tenant.resume.parseFileId,
                        orgList: apis.tenant.orgList
                      })}
                    />
                  </div>
                </Page>
              </Permissions>
            )
          },
          {
            path: 'employee',
            title: formatMessage({ id: 'tenantAdmin.employeeProfile' }),
            elementProps: {
              apis: Object.assign({}, apis.talentSaas.tenant.employee, {
                positionList: apis.talentSaas.tenant.position.list,
                parseResume: apis.talentSaas.tenant.resume.parseFileId,
                orgList: apis.tenant.orgList,
                userList: Object.assign({}, apis.talentSaas.tenant.userList, {
                  params: {
                    filter: { status: 'open' }
                  }
                })
              }),
              onDetail: ({ colItem }) => {
                navigate(`${baseUrl}/profile/${colItem.id}`);
              },
              onPositionDetail: ({ colItem }) => {
                navigate(`${baseUrl}/position/${colItem.options?.position}`);
              },
              children: renderProps => (
                <Permissions request={TENANT_ADMIN_PERMISSIONS.employeeProfile} type="error">
                  <Page title={formatMessage({ id: 'tenantAdmin.employeeProfile' })} extra={<CompleteProfileApplicationEntry baseUrl={baseUrl} />}>
                    <TablePageRender {...renderProps} withPage={false} />
                  </Page>
                </Permissions>
              )
            },
            loader: () => import('@components/Employee')
          },
          {
            path: 'position',
            title: 'Position',
            elementProps: {
              apis: Object.assign({}, apis.talentSaas.tenant.position, {
                orgList: apis.tenant.orgList
              }),
              onDetail: ({ colItem }) => {
                navigate(`${baseUrl}/position/${colItem.id}`);
              },
              onCreate: () => {
                navigate(`${baseUrl}/position/create`);
              },
              onEdit: ({ data }) => {
                navigate(`${baseUrl}/position/${data.id}/edit`);
              },
              children: renderProps => (
                <Permissions request={TENANT_ADMIN_PERMISSIONS.positionManagement} type="error">
                  <Page title={formatMessage({ id: 'tenantAdmin.positionManagement' })}>
                    <Flex vertical gap={16} style={{ width: '100%' }}>
                      <PositionInsightBanner />
                      <TablePageRender {...renderProps} withPage={false} />
                    </Flex>
                  </Page>
                </Permissions>
              )
            },
            loader: () => import('@components/Position')
          },
          {
            path: 'position/create',
            title: 'Position/Create',
            elementProps: {
              baseUrl,
              action: 'create',
              apis: Object.assign({}, apis.talentSaas.tenant.position, {
                orgList: apis.tenant.orgList
              }),
              children: ({ title, children }) => (
                <Permissions request={TENANT_ADMIN_PERMISSIONS.positionManagement} type="error">
                  <Page back title={title} noPadding>
                    {({ className, render }) => render({ className, children })}
                  </Page>
                </Permissions>
              )
            },
            loader: () => import('@components/Position/Form')
          },
          {
            path: 'position/:id/edit',
            title: 'Position/Edit',
            elementProps: {
              baseUrl,
              action: 'edit',
              apis: Object.assign({}, apis.talentSaas.tenant.position, {
                orgList: apis.tenant.orgList
              }),
              children: ({ title, children }) => (
                <Permissions request={TENANT_ADMIN_PERMISSIONS.positionManagement} type="error">
                  <Page back title={title} noPadding>
                    {({ className, render }) => render({ className, children })}
                  </Page>
                </Permissions>
              )
            },
            loader: () => import('@components/Position/Form')
          },
          {
            path: 'position/:id/talent/:employeeId',
            title: 'Position/TalentSkillAnalysis',
            elementProps: {
              baseUrl,
              apis: Object.assign({}, apis.talentSaas.tenant.position, {
                orgList: apis.tenant.orgList
              }),
              children: ({ title, extra, children }) => (
                <Permissions request={TENANT_ADMIN_PERMISSIONS.positionManagement} type="error">
                  <Page back title={title} extra={extra} noPadding>
                    {children}
                  </Page>
                </Permissions>
              )
            },
            loader: () => import('@components/Position/Detail/TalentSkillAnalysis')
          },
          {
            path: 'position/:id',
            title: 'Position/Detail',
            elementProps: {
              baseUrl,
              apis: Object.assign({}, apis.talentSaas.tenant.position, {
                orgList: apis.tenant.orgList,
                employeeList: apis.talentSaas.tenant.employee.list
              }),
              children: ({ title, extra, children }) => (
                <Permissions request={TENANT_ADMIN_PERMISSIONS.positionManagement} type="error">
                  <Page back title={title} extra={extra}>
                    {children}
                  </Page>
                </Permissions>
              )
            },
            loader: () => import('@components/Position/Detail')
          },
          {
            path: 'hiring/*',
            title: 'Hiring',
            loader: () => import('@components/TenantHiring')
          },
          {
            path: 'setting/company',
            title: 'Setting/Company',
            element: <Setting.Company baseUrl={`${baseUrl}/setting`}>{({ title, children }) => <Page title={title}>{children}</Page>}</Setting.Company>
          },
          {
            path: 'setting/org',
            title: 'Setting/Org',
            element: <Setting.Org baseUrl={`${baseUrl}/setting`}>{({ title, children }) => <Page title={title}>{children}</Page>}</Setting.Org>
          },
          {
            path: 'setting/user',
            title: 'Setting/User',
            element: (
              <Setting.User baseUrl={`${baseUrl}/setting`} apis={settingUserApis}>
                {renderSettingUserPage}
              </Setting.User>
            )
          },
          {
            path: 'setting/permission',
            title: 'Setting/Permission',
            element: <Setting.Permission baseUrl={`${baseUrl}/setting`}>{({ title, children }) => <Page title={title}>{children}</Page>}</Setting.Permission>
          }
        ]}
      />
    );
  })
);

export default TenantAdmin;
