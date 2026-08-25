import React from 'react';
import { preset as fetchPreset } from '@kne/react-fetch';
import { Spin, Empty, message } from 'antd';
import { preset as remoteLoaderPreset, loadModule } from '@kne/remote-loader';
import createAjax from '@kne/axios-fetch';
import { getToken } from '@kne/token-storage';
import transform from 'lodash/transform';
import loadable from '@loadable/component';
import { getApis } from '@components/Apis';
import { enums as talentEnums } from '@components/EnumLoader';
import ensureSlash from '@kne/ensure-slash';
import TenantUserPlugin, { personalCard, getUserListColumns, enhanceUserData, getUserListActions } from '@components/TenantUserPlugin';

window.PUBLIC_URL = window.runtimePublicUrl || process.env.PUBLIC_URL;

const baseApiUrl = window.runtimeApiUrl || '';

export const globalInit = async () => {
  const ajax = createAjax({
    baseURL: baseApiUrl,
    errorHandler: error => message.error(error),
    getDefaultHeaders: () => {
      return {
        'X-User-Token': getToken('X-User-Token')
      };
    },
    registerInterceptors: interceptors => {
      interceptors.response.use(response => {
        if (response.config.ignoreState !== true && (response.status === 401 || response.data.code === 401)) {
          const searchParams = new URLSearchParams(window.location.search);
          const referer = encodeURIComponent(window.location.pathname + window.location.search);
          searchParams.append('referer', referer);
          window.location.href = '/account/login?' + searchParams.toString();
          response.showError = false;
        }
        return response;
      });
    }
  });

  fetchPreset({
    ajax,
    loading: (
      <Spin
        delay={500}
        style={{
          position: 'absolute',
          left: '50%',
          padding: '10px',
          transform: 'translateX(-50%)'
        }}
      />
    ),
    error: null,
    empty: <Empty />,
    transformResponse: response => {
      const { data } = response;
      response.data = {
        code: data.code === 0 ? 200 : data.code,
        msg: data.msg,
        results: data.data
      };
      return response;
    }
  });
  const registry = {
    url: 'https://cdn.leapin-ai.com',
    tpl: '{{url}}/components/@kne-components/{{remote}}/{{version}}/build'
  };

  const componentsCoreRemote = {
    ...registry,
    //url: 'http://localhost:3001',
    //tpl: '{{url}}',
    remote: 'components-core',
    defaultVersion: '0.5.45'
  };
  remoteLoaderPreset({
    remotes: {
      default: componentsCoreRemote,
      'components-core': componentsCoreRemote,
      'components-iconfont': {
        ...registry,
        remote: 'components-iconfont',
        defaultVersion: '0.2.1'
      },
      'components-file-manager': {
        ...registry,
        remote: 'components-file-manager',
        defaultVersion: '0.1.9'
      },
      'components-admin': {
        ...registry,
        //url: 'http://localhost:3016',
        //tpl: '{{url}}',
        remote: 'components-admin',
        defaultVersion: '1.1.87'
      },
      'components-thirdparty': {
        ...registry,
        //url: 'http://localhost:3010',
        //tpl: '{{url}}',
        remote: 'components-thirdparty',
        defaultVersion: '0.1.35'
      },
      // AI 面试远程组件：url/version 由租户设置在运行时 applyAiInterviewRemote 写入
      'ai-interview-flowup': {
        remote: 'ai-interview-flowup',
        url: '',
        tpl: '{{url}}',
        defaultVersion: ''
      },
      'fastify-app':
        process.env.NODE_ENV === 'development'
          ? {
              remote: 'fastify-app',
              url: '/',
              tpl: '{{url}}'
            }
          : {
              ...registry,
              remote: 'fastify-app',
              defaultVersion: process.env.DEFAULT_VERSION
            }
    }
  });

  const safeLoadApis = async name => {
    try {
      return await loadModule(name).then(({ default: defaultModule }) => defaultModule);
    } catch (e) {
      console.error(e, name);
      return () => {
        return {};
      };
    }
  };
  const remoteApis = await (async () => {
    const input = {
      fileManager: 'components-file-manager:Apis@getApis'
    };

    const remoteApiKeys = Object.keys(input);
    return transform(
      await Promise.all(remoteApiKeys.map(name => safeLoadApis(Array.isArray(input[name]) ? input[name][0] : input[name]))),
      (result, value, index) => {
        const name = remoteApiKeys[index];
        result[name] = value(input[name][1]);
      },
      {}
    );
  })();
  const getAccountApis = await safeLoadApis('components-admin:Apis@getApis');
  const talentApis = getApis();

  const enums = Object.assign({}, await safeLoadApis('components-admin:Task@enums'), talentEnums);

  return {
    ajax,
    staticUrl: baseApiUrl,
    enums: Object.assign({}, enums),
    plugins: {
      admin: {
        tenant: {
          appendSettingMenus: [
            {
              key: 'ai-interview',
              label: 'AI面试设置',
              component: loadable(() => import('@components/AIInterviewSetting'))
            }
          ]
        }
      },
      tenant: {
        getUserListActions
      },
      tenantAdmin: {
        UserFormInner: TenantUserPlugin,
        getUserListColumns,
        personalCard,
        enhanceUserData,
        getUserApis: ({ tenantId, apis }) => {
          const positionList = apis.talentSaas?.tenantAdmin?.position?.list;
          const positionCreate = apis.talentSaas?.tenantAdmin?.position?.create;
          const userList = apis.talentSaas?.tenantAdmin?.userList;
          const result = {};
          if (userList) {
            result.list = Object.assign({}, userList, {
              params: Object.assign({ tenantId }, userList.params || {})
            });
          }
          if (positionList) {
            result.positionList = Object.assign({}, positionList, {
              params: Object.assign({ tenantId, perPage: 500, currentPage: 1 }, positionList.params || {})
            });
          }
          if (positionCreate) {
            result.positionCreate = Object.assign({}, positionCreate, {
              data: Object.assign({ tenantId }, positionCreate.data || {})
            });
          }
          return result;
        }
      }
    },
    apis: Object.assign({}, getAccountApis(), remoteApis, talentApis, {
      tenant: Object.assign({}, getAccountApis().tenant, talentApis.tenant, {
        parseJoinToken: {
          url: '/api/v1/tenant-extra/parse-join-token',
          method: 'POST'
        }
      }),
      file: {
        contentWindowUrl: 'https://cdn.leapin-ai.com/components/@kne/iframe-resizer/0.1.3/dist/contentWindow.js',
        pdfjsUrl: 'https://cdn.leapin-ai.com/components/pdfjs-dist/5.4.296',
        getUrl: {
          url: `/api/v1/static/file-url/{id}`,
          paramsType: 'urlParams',
          ignoreSuccessState: true
        },
        uploadForEditor: ({ file, path }) => {
          return ajax
            .postForm({
              url: `/api/v1/static/upload`,
              params: path ? { path } : undefined,
              data: { file }
            })
            .then(response => {
              if (response.data.code === 0) {
                response.data.data = `${ensureSlash(baseApiUrl)}/api/v1/static/file-id/${response.data.data.id}`;
              }
              return response;
            });
        },
        upload: ({ file, path }) => {
          return ajax.postForm({
            url: `/api/v1/static/upload`,
            params: path ? { path } : undefined,
            data: { file }
          });
        }
      }
    }),
    themeToken: {
      colorPrimary: '#4183F0'
    }
  };
};

/** 按租户 AI 面试设置写入 remote-loader remotes，供 ai-interview-flowup:* 正常加载 */
export const applyAiInterviewRemote = ({ cdnUrl, version } = {}) => {
  const url = String(cdnUrl || '')
    .trim()
    .replace(/\/+$/, '')
    .replace(/\/remoteEntry\.js$/i, '');
  const defaultVersion = String(version || '').trim();
  if (!url || !defaultVersion) {
    return false;
  }
  remoteLoaderPreset({
    remotes: {
      'ai-interview-flowup': {
        remote: 'ai-interview-flowup',
        url,
        tpl: '{{url}}',
        defaultVersion
      }
    }
  });
  return true;
};
