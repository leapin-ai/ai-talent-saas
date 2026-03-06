import { createWithRemoteLoader } from '@kne/remote-loader';
import withLocale from '../withLocale';
import { useIntl } from '@kne/react-intl';
import Fetch from '@kne/react-fetch';
import { useParams } from 'react-router-dom';

const Detail = createWithRemoteLoader({
  modules: ['components-core:InfoPage', 'components-core:InfoPage@CentralContent', 'components-core:Layout@Page', 'components-core:Layout@PageHeader', 'components-thirdparty:CKEditor.Content']
})(
  withLocale(({ remoteModules, baseUrl, apis, children }) => {
    const [InfoPage, CentralContent, Page, PageHeader, EditorContent] = remoteModules;
    const { formatMessage } = useIntl();
    const { id } = useParams();

    return (
      <Fetch
        {...Object.assign({}, apis.detail, {
          params: { id }
        })}
        render={({ data, reload }) => {
          const basicInfo = (
            <InfoPage>
              <InfoPage.Part bordered title="基本信息">
                <CentralContent
                  type="compact"
                  col={1}
                  dataSource={data}
                  columns={[
                    {
                      name: 'name',
                      title: formatMessage({ id: 'position.name' })
                    }
                  ]}
                />
                <CentralContent
                  type="compact"
                  col={3}
                  dataSource={data}
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
                  dataSource={data}
                  columns={[
                    { name: 'publishAt', title: formatMessage({ id: 'position.publishAt' }), format: 'datetime' },
                    { name: 'createdAt', title: formatMessage({ id: 'position.createdAt' }), format: 'datetime' },
                    { name: 'updatedAt', title: formatMessage({ id: 'position.updatedAt' }), format: 'datetime' }
                  ]}
                />
              </InfoPage.Part>
              <InfoPage.Part bordered title="工作内容">
                <EditorContent>{data.description}</EditorContent>
              </InfoPage.Part>
              <InfoPage.Part bordered title="工作要求">
                <EditorContent>{data.requirement}</EditorContent>
              </InfoPage.Part>
            </InfoPage>
          );
          const title = data.name;

          if (typeof children === 'function') {
            return children({
              title,
              children: basicInfo
            });
          }
          return (
            <Page headerFixed={false} header={<PageHeader title={title} />}>
              {basicInfo}
            </Page>
          );
        }}
      />
    );
  })
);

export default Detail;
