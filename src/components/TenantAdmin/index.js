import { useCallback, useMemo, useRef } from 'react';
import AppChildrenRouter from '@kne/app-children-router';
import { Flex } from 'antd';
import Layout from './Layout';
import { Page } from '@kne/system-layout';
import { useNavigate } from 'react-router-dom';
import { createWithRemoteLoader } from '@kne/remote-loader';
import TalentMarket from '@components/TalentMarket';
import TalentProfile from '@components/TalentProfile';
import withLocale from './withLocale';
import { useIntl } from '@kne/react-intl';

const TenantAdmin = createWithRemoteLoader({
  modules: ['components-admin:Tenant@Setting', 'components-core:Global@usePreset', 'components-core:Table@TablePage', 'components-core:Filter', 'components-core:File@PrintButton']
})(
  withLocale(({ remoteModules, baseUrl }) => {
    const { formatMessage } = useIntl();
    const [Setting, usePreset, TablePage, Filter, PrintButton] = remoteModules;
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
    const renderSettingUserPage = useCallback(
      ({ title, filter, titleExtra, children }) => {
        return (
          <Page title={title} extra={titleExtra}>
            <Filter {...filter} />
            {children}
          </Page>
        );
      },
      [Filter]
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
            title: 'Dashboard',
            element: (
              <Page>
                <TalentMarket
                  baseUrl={baseUrl}
                  apis={apis.talentSaas.tenant.market}
                  onMoreProfile={() => {
                    navigate(`${baseUrl}/employee`);
                  }}
                />
              </Page>
            )
          },
          {
            path: 'profile/:id',
            title: formatMessage({ id: 'tenantAdmin.employeeProfile' }),
            element: (
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
              children: ({ filter, titleExtra, tableOptions }) => {
                return (
                  <Page title={formatMessage({ id: 'tenantAdmin.employeeProfile' })} extra={titleExtra}>
                    <Filter {...filter} />
                    <TablePage {...tableOptions} />
                  </Page>
                );
              }
            },
            loader: () => import('@components/Employee')
          },
          {
            path: 'position',
            title: 'Position',
            elementProps: {
              apis: apis.talentSaas.tenant.position,
              onDetail: ({ colItem }) => {
                navigate(`${baseUrl}/position/${colItem.id}`);
              },
              children: ({ filter, titleExtra, tableOptions }) => (
                <Page title={formatMessage({ id: 'tenantAdmin.positionManagement' })} extra={titleExtra}>
                  <Flex vertical gap={8} flex={1}>
                    <Filter {...filter} />
                    <TablePage {...tableOptions} />
                  </Flex>
                </Page>
              )
            },
            loader: () => import('@components/Position')
          },
          {
            path: 'position/:id',
            title: 'Position/Detail',
            elementProps: {
              apis: apis.talentSaas.tenant.position,
              children: ({ title, extra, children }) => (
                <Page back title={title} extra={extra}>
                  {children}
                </Page>
              )
            },
            loader: () => import('@components/Position/Detail')
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
