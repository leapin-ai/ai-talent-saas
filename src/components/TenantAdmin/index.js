import AppChildrenRouter from '@kne/app-children-router';
import { Flex } from 'antd';
import Layout from './Layout';
import { Page } from '@kne/system-layout';
import { useNavigate } from 'react-router-dom';
import { createWithRemoteLoader } from '@kne/remote-loader';
import TalentMarket from '@components/TalentMarket';
import TalentProfile from '@components/TalentProfile';

const TenantAdmin = createWithRemoteLoader({
  modules: ['components-admin:Tenant@Setting', 'components-core:Global@usePreset', 'components-core:Table@TablePage', 'components-core:Filter']
})(({ remoteModules, baseUrl }) => {
  const [Setting, usePreset, TablePage, Filter] = remoteModules;
  const { apis } = usePreset();
  const navigate = useNavigate();
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
          title: '员工档案',
          element: (
            <Page title="员工档案" back>
              <TalentProfile
                baseUrl={baseUrl}
                apis={Object.assign({}, apis.talentSaas.tenant.employee, {
                  positionList: apis.talentSaas.tenant.position.list,
                  parseResume: apis.talentSaas.tenant.resume.parseFileId,
                  orgList: apis.tenant.orgList
                })}
              />
            </Page>
          )
        },
        {
          path: 'employee',
          title: '员工档案',
          elementProps: {
            apis: Object.assign({}, apis.talentSaas.tenant.employee, {
              positionList: apis.talentSaas.tenant.position.list,
              parseResume: apis.talentSaas.tenant.resume.parseFileId,
              orgList: apis.tenant.orgList
            }),
            onDetail: ({ colItem }) => {
              navigate(`${baseUrl}/profile/${colItem.id}`);
            },
            onPositionDetail: ({ colItem }) => {
              navigate(`${baseUrl}/position/${colItem.options?.position}`);
            },
            children: ({ filter, titleExtra, tableOptions }) => {
              return (
                <Page title="员工档案" extra={titleExtra}>
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
              <Page title="岗位管理" extra={titleExtra}>
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
          element: <Setting.Company>{({ title, children }) => <Page title={title}>{children}</Page>}</Setting.Company>
        },
        {
          path: 'setting/org',
          title: 'Setting/Org',
          element: <Setting.Org>{({ title, children }) => <Page title={title}>{children}</Page>}</Setting.Org>
        },
        {
          path: 'setting/user',
          title: 'Setting/User',
          element: (
            <Setting.User
              apis={{
                positionList: apis.talentSaas.tenant.position.list,
                list: apis.talentSaas.tenant.userList
              }}
            >
              {({ title, titleExtra, children }) => {
                return (
                  <Page title={title} extra={titleExtra}>
                    {children}
                  </Page>
                );
              }}
            </Setting.User>
          )
        },
        {
          path: 'setting/permission',
          title: 'Setting/Permission',
          element: <Setting.Permission>{({ title, children }) => <Page title={title}>{children}</Page>}</Setting.Permission>
        }
      ]}
    />
  );
});

export default TenantAdmin;
