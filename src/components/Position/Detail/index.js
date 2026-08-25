import { useState } from 'react';
import { Flex, Tabs } from 'antd';
import { createWithRemoteLoader } from '@kne/remote-loader';
import withLocale from '../withLocale';
import { useIntl } from '@kne/react-intl';
import Fetch from '@kne/react-fetch';
import { useParams } from 'react-router-dom';
import SkillList from './SkillList';
import SkillOverview from './SkillList/SkillOverview';
import AnalyzeTalent from './AnalyzeTalent';

const Detail = createWithRemoteLoader({
  modules: ['components-core:InfoPage', 'components-core:InfoPage@CentralContent', 'components-core:Layout@Page', 'components-core:Layout@PageHeader', 'components-thirdparty:CKEditor.Content']
})(
  withLocale(({ remoteModules, baseUrl, apis, children }) => {
    const [InfoPage, CentralContent, Page, PageHeader, EditorContent] = remoteModules;
    const { formatMessage } = useIntl();
    const { id } = useParams();
    const [activeTab, setActiveTab] = useState('role');

    return (
      <Fetch
        {...Object.assign({}, apis.detail, {
          params: { id }
        })}
        render={({ data, reload }) => {
          const department = (data.orgEnums || []).find(target => target.value === data.tenantOrgId)?.description || '-';
          const dataSource = Object.assign({}, data, { department });

          const positionInfoCard = (
            <InfoPage>
              <InfoPage.Part bordered title={formatMessage({ id: 'position.positionInfo' })}>
                <InfoPage.Part bordered title={formatMessage({ id: 'position.basicInfo' })}>
                  <CentralContent
                    type="compact"
                    col={1}
                    dataSource={dataSource}
                    columns={[
                      {
                        name: 'name',
                        title: formatMessage({ id: 'position.name' })
                      },
                      {
                        name: 'department',
                        title: formatMessage({ id: 'position.department' })
                      }
                    ]}
                  />
                  <CentralContent
                    type="compact"
                    col={3}
                    dataSource={dataSource}
                    columns={[
                      {
                        name: 'status',
                        title: formatMessage({ id: 'position.status' })
                      },
                      {
                        name: 'language',
                        title: formatMessage({ id: 'position.language' })
                      }
                    ]}
                  />
                  <CentralContent
                    type="compact"
                    col={3}
                    dataSource={dataSource}
                    columns={[
                      { name: 'publishAt', title: formatMessage({ id: 'position.publishAt' }), format: 'datetime' },
                      { name: 'createdAt', title: formatMessage({ id: 'position.createdAt' }), format: 'datetime' },
                      { name: 'updatedAt', title: formatMessage({ id: 'position.updatedAt' }), format: 'datetime' }
                    ]}
                  />
                </InfoPage.Part>
                <InfoPage.Part bordered title={formatMessage({ id: 'position.workContent' })}>
                  <EditorContent>{data.description}</EditorContent>
                </InfoPage.Part>
                <InfoPage.Part bordered title={formatMessage({ id: 'position.workRequirement' })}>
                  <EditorContent>{data.requirement}</EditorContent>
                </InfoPage.Part>
              </InfoPage.Part>
            </InfoPage>
          );

          const content = (
            <Tabs
              activeKey={activeTab}
              onChange={setActiveTab}
              items={[
                {
                  key: 'role',
                  label: formatMessage({ id: 'position.tabRoleDetails' }),
                  children: (
                    <Flex vertical gap={24}>
                      <SkillOverview skill={data.skill} verdict={data.verdict} />
                      <InfoPage>
                        <InfoPage.Part bordered title={formatMessage({ id: 'position.skillListTitle' })}>
                          <SkillList positionId={data.id} skill={data.skill} apis={apis} reload={reload} />
                        </InfoPage.Part>
                      </InfoPage>
                      {positionInfoCard}
                    </Flex>
                  )
                },
                {
                  key: 'analyze',
                  label: formatMessage({ id: 'position.tabAnalyzeTalent' }),
                  children: <AnalyzeTalent positionId={data.id} employeeListApi={apis.employeeList} />
                }
              ]}
            />
          );

          const title = data.name;

          if (typeof children === 'function') {
            return children({
              title,
              children: content
            });
          }
          return (
            <Page headerFixed={false} header={<PageHeader title={title} />}>
              {content}
            </Page>
          );
        }}
      />
    );
  })
);

export default Detail;
