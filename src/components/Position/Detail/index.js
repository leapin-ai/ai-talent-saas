import { useState } from 'react';
import { App, Button, Flex, Tabs } from 'antd';
import { createWithRemoteLoader } from '@kne/remote-loader';
import withLocale from '../withLocale';
import { useIntl } from '@kne/react-intl';
import Fetch from '@kne/react-fetch';
import { useParams } from 'react-router-dom';
import SkillList from './SkillList';
import SkillOverview from './SkillList/SkillOverview';
import AnalyzeTalent from './AnalyzeTalent';
import AiAnalysis from './AiAnalysis';

const Detail = createWithRemoteLoader({
  modules: ['components-core:InfoPage', 'components-core:InfoPage@CentralContent', 'components-core:Layout@Page', 'components-core:Layout@PageHeader', 'components-thirdparty:CKEditor.Content', 'components-core:Global@usePreset']
})(
  withLocale(({ remoteModules, baseUrl = '', apis, children }) => {
    const [InfoPage, CentralContent, Page, PageHeader, EditorContent, usePreset] = remoteModules;
    const { formatMessage } = useIntl();
    const { message } = App.useApp();
    const { ajax } = usePreset();
    const { id } = useParams();
    const [activeTab, setActiveTab] = useState('role');
    const [starting, setStarting] = useState(false);

    return (
      <Fetch
        {...Object.assign({}, apis.detail, {
          params: { id }
        })}
        render={({ data, reload }) => {
          const department = (data.orgEnums || []).find(target => target.value === data.tenantOrgId)?.description || '-';
          const dataSource = Object.assign({}, data, { department });
          const isGenerating = data.analysisStatus === 'generating';

          const startAnalysis = async () => {
            if (!apis?.startAnalysis || starting) {
              return;
            }
            setStarting(true);
            try {
              const { data: resData } = await ajax(
                Object.assign({}, apis.startAnalysis, {
                  data: { id: data.id }
                })
              );
              if (resData.code !== 0) {
                throw new Error(resData.msg || formatMessage({ id: 'position.aiAnalysisStartFail' }));
              }
              message.success(formatMessage({ id: 'position.aiAnalysisStartSuccess' }));
              reload();
            } catch (e) {
              message.error(e.message || formatMessage({ id: 'position.aiAnalysisStartFail' }));
            } finally {
              setStarting(false);
            }
          };

          const extra = !isGenerating ? (
            <Button type="primary" loading={starting} onClick={startAnalysis}>
              {formatMessage({ id: 'position.aiAnalysisAction' })}
            </Button>
          ) : null;

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

          const content = isGenerating ? (
            <AiAnalysis positionName={data.name} progress={data.analysisProgress} />
          ) : (
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
                  children: <AnalyzeTalent baseUrl={baseUrl} positionId={data.id} employeeListApi={apis.employeeList} />
                }
              ]}
            />
          );

          const title = data.name;

          if (typeof children === 'function') {
            return children({
              title,
              extra,
              noPadding: isGenerating,
              children: content
            });
          }
          return (
            <Page headerFixed={false} header={<PageHeader title={title} extra={extra} />} noPadding={isGenerating}>
              {isGenerating ? ({ className, render }) => render({ className, children: content }) : content}
            </Page>
          );
        }}
      />
    );
  })
);

export default Detail;
