import { createWithRemoteLoader } from '@kne/remote-loader';
import withLocale from '../withLocale';
import { useIntl } from '@kne/react-intl';
import Fetch from '@kne/react-fetch';
import { Row, Col, Flex, Button, Segmented } from 'antd';
import { useParams, useSearchParams } from 'react-router-dom';
import { useState } from 'react';
import BaseFormInner from '../PositionForm/BaseFormInner';

const Detail = createWithRemoteLoader({
  modules: [
    'components-core:Global@usePreset',
    'components-core:InfoPage',
    'components-core:InfoPage@CentralContent',
    'components-core:Icon',
    'components-core:FormInfo',
    'components-core:ButtonGroup@ButtonFooter',
    'components-core:Layout@Page',
    'components-core:Layout@PageHeader',
    'components-thirdparty:CKEditor.Content'
  ]
})(
  withLocale(({ remoteModules, baseUrl, apis, children }) => {
    const [usePreset, InfoPage, CentralContent, Icon, FormInfo, ButtonFooter, Page, PageHeader, EditorContent] = remoteModules;
    const { ajax } = usePreset();
    const { Form, SubmitButton, CancelButton } = FormInfo;
    const { formatMessage } = useIntl();
    const { id } = useParams();
    const [searchParams, setSearchParams] = useSearchParams();
    const [isEdit, setIsEdit] = useState(false);
    const current = searchParams.get('tab') || 'basic';

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
