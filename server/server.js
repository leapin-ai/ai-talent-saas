const fastify = require('fastify')({
  logger: true,
  querystringParser: str => require('qs').parse(str)
});

const fastifyEnv = require('@fastify/env');
const packageJson = require('./package.json');
const path = require('node:path');
const ensureSlash = require('@kne/ensure-slash');
const { prepareMessageProps } = require('./libs/utils/messageProps');

const version = `v${packageJson.version.split('.')[0]}`;

const options = {
  name: 'project',
  prefix: `/api/${version}`,
  taskCron: '*/1 * * * *',
  getUserModel: () => {
    return fastify.account.models.user;
  },
  getTenantModels: () => {
    return {
      tenant: fastify.tenant.models.tenant,
      tenantUser: fastify.tenant.models.tenantUser,
      tenantOrg: fastify.tenant.models.tenantOrg
    };
  }
};

const createServer = () => {
  fastify.register(fastifyEnv, {
    dotenv: true,
    schema: {
      type: 'object',
      properties: {
        DB_DIALECT: { type: 'string', default: 'sqlite' },
        DB_HOST: { type: 'string', default: 'data.db' },
        DB_PORT: { type: 'number' },
        DB_USERNAME: { type: 'string' },
        DB_PASSWORD: { type: 'string' },
        DB_DATABASE: { type: 'string' },
        DB_TABLE_PREFIX: { type: 'string' },
        ENV: { type: 'string', default: 'local' },
        PORT: { type: 'number', default: 8040 },
        RESUME_PARSE_URL: { type: 'string' },
        RESUME_PARSE_KEY: { type: 'string' },
        SEARCH_API_URL: { type: 'string' },

        IS_TEST: { type: 'boolean', default: false },
        READINESS_API_URL: { type: 'string', default: '' },
        READINESS_COMPLETION_THRESHOLD: { type: 'number', default: 80 },
        READINESS_ANSWER_SYNC_CRON: { type: 'string', default: '*/5 * * * *' },
        AI_INTERVIEW_INVITE_ORIGIN: { type: 'string', default: '' },

        ORIGIN: { type: 'string', default: '' },
        OIDC_KEY_SECRET: { type: 'string' },
        TASK_CRON: { type: 'string', default: '' },
        OSS_REGION: { type: 'string' },
        OSS_BUCKET: { type: 'string' },
        OSS_ACCESS_KEY_ID: { type: 'string' },
        OSS_ACCESS_KEY_SECRET: { type: 'string' },

        AWS_SES_ACCESS_KEY_ID: { type: 'string' },
        AWS_SES_SECRET_ACCESS_KEY: { type: 'string' },
        AWS_SES_REGION: { type: 'string' },
        AWS_SES_SOURCE_EMAIL: { type: 'string' },

        AWS_S3_REGION: { type: 'string' },
        AWS_S3_BUCKET: { type: 'string' },
        AWS_S3_ENDPOINT: { type: 'string' },
        AWS_S3_ACCESS_KEY_ID: { type: 'string' },
        AWS_S3_SECRET_ACCESS_KEY: { type: 'string' },

        ALISMTP_USER: { type: 'string' },
        ALISMTP_PASSWORD: { type: 'string' },
        ALISMTP_ENDPOINT: { type: 'string' },
        SMS_ACCESS_APP_ID: { type: 'string' },
        SMS_ACCESS_SECRET: { type: 'string' },

        SYNC_ORG_SECRET: { type: 'string' },
        SYNC_ORG_HOST: { type: 'string' },
        SYNC_ORG_TYPE: { type: 'string' },

        LLM_RUNNER_URL: { type: 'string', default: 'https://llm-runner.staging.leapin-ai.com' },
        LLM_RUNNER_TOKEN: { type: 'string' },
        LLM_POSITION_ANALYSIS_CONFIG_ID: { type: 'string', default: 'talent-saas-position-analysis-fill' },
        LLM_POSITION_ANALYSIS_PROVIDER: { type: 'string', default: 'azure' },
        AZURE_OPENAI_API_KEY: { type: 'string' },
        AZURE_OPENAI_RESOURCE_NAME: { type: 'string' },
        AZURE_OPENAI_API_VERSION: { type: 'string', default: '2024-08-01-preview' },
        AZURE_OPENAI_CHAT_DEPLOYMENT: { type: 'string' },
        AZURE_OPENAI_USE_DEPLOYMENT_URLS: { type: 'string', default: 'true' },

        ALI_ASR_APP_KEY: { type: 'string' },
        ALI_ASR_ACCESS_KEY_ID: { type: 'string' },
        ALI_ASR_ACCESS_KEY_SECRET: { type: 'string' },
        ALI_ASR_REGION: { type: 'string', default: 'cn-shanghai' },
        ALI_ASR_DOMAIN: { type: 'string', default: 'filetrans.cn-shanghai.aliyuncs.com' },
        ALI_ASR_API_VERSION: { type: 'string', default: '2018-08-17' },
        ALI_ASR_ENDPOINT: { type: 'string' },

        APP_MANAGER_ENABLED: { type: 'boolean', default: true },
        APPS_ROOT: { type: 'string', default: '' },
        APPS_DB_DATABASE: { type: 'string', default: '' }
      }
    }
  });

  fastify.register(require('fastify-cron'));

  fastify.register(require('@kne/fastify-intl'), {
    defaultLocale: 'zh-CN'
  });

  fastify.register(
    require('fastify-plugin')(async fastify => {
      const tablePrefix = fastify.config.DB_TABLE_PREFIX || null;

      fastify.register(require('@kne/fastify-sequelize'), {
        db: {
          dialect: fastify.config.DB_DIALECT,
          host: fastify.config.DB_HOST,
          port: fastify.config.DB_PORT,
          database: fastify.config.DB_DATABASE,
          username: fastify.config.DB_USERNAME,
          password: fastify.config.DB_PASSWORD,
          logging: false
        },
        prefix: tablePrefix || 't_',
        connections:
          fastify.config.APP_MANAGER_ENABLED && fastify.config.APPS_DB_DATABASE
            ? {
                appManagerApps: {
                  db: {
                    dialect: fastify.config.DB_DIALECT,
                    host: fastify.config.DB_HOST,
                    port: fastify.config.DB_PORT,
                    database: fastify.config.APPS_DB_DATABASE,
                    username: fastify.config.DB_USERNAME,
                    password: fastify.config.DB_PASSWORD,
                    logging: false
                  },
                  sqlPath: false,
                  modelsPath: null
                }
              }
            : {},
        modelsGlobOptions: {
          syncOptions: {}
        },
        getUserModel: options.getUserModel,
        getTenantModels: options.getTenantModels
      });

      fastify.register(require('@kne/fastify-file-manager'), {
        prefix: `${options.prefix}/static`,
        root: path.resolve('./static'),
        ossAdapter: () => {
          if (fastify.config.AWS_S3_ACCESS_KEY_ID) {
            return fastify.aws.services.oss;
          }
          return fastify.aliyun.services.oss;
        }
      });

      fastify.register(require('@kne/fastify-aliyun'), {
        prefix: `${options.prefix}/aliyun`,
        oss: {
          baseDir: 'on-boarding',
          region: fastify.config.OSS_REGION,
          accessKeyId: fastify.config.OSS_ACCESS_KEY_ID,
          accessKeySecret: fastify.config.OSS_ACCESS_KEY_SECRET,
          bucket: fastify.config.OSS_BUCKET
        }
      });

      fastify.register(require('@kne/fastify-account'), {
        isTest: true,
        prefix: `${options.prefix}`,
        dbTableNamePrefix: tablePrefix ? `${tablePrefix}account_` : 't_account_',
        getUserAuthenticate: () => fastify.oidc.authenticate.user,
        sendMessage: async ({ name, type, messageType, props }) => {
          const language = props.options?.language === 'zh-CN' ? 'zh-CN' : 'en-US';
          // messageType: 0:短信验证码，1:邮件验证码 type: 0:注册,2:登录,4:验证租户管理员,5:忘记密码,6:候选人登录验证
          if (messageType === 1 && type === 0) {
            await fastify.message.services.sendMessage({
              name,
              type: 0,
              code: `REGISTERCODE[${language}]`,
              props,
              options: {
                title: language === 'zh-CN' ? '注册验证码' : 'Registration verification code'
              }
            });
          }
          if (messageType === 1 && type === 5) {
            await fastify.message.services.sendMessage({
              name,
              type: 0,
              code: `RESETPASSWORDCODE[${language}]`,
              props: Object.assign({}, props, {
                url: `${ensureSlash(fastify.config.ORIGIN)}/account/reset-password/${props.token}${props.options?.referer ? `?referer=${props.options?.referer}` : ''}`
              }),
              options: {
                title: language === 'zh-CN' ? '重置密码' : 'Reset Password'
              }
            });
          }
          if (type === 6) {
            const themeColor = props.options?.themeColor || props.themeColor || '#2A5CAA';
            await fastify.message.services.sendMessage({
              name,
              type: (type => {
                if (type === 1) {
                  return 0;
                }
                if (type === 0) {
                  return 1;
                }
                return type;
              })(messageType),
              code: `CANDIDATECODE[${language}]`,
              props: Object.assign({}, props, { themeColor }),
              options: {
                title: language === 'zh-CN' ? '认证验证码' : 'Verification Code'
              }
            });
          }
        }
      });

      fastify.register(require('@kne/fastify-message'), {
        isTest: fastify.config.IS_TEST,
        dbTableNamePrefix: tablePrefix ? `${tablePrefix}message_` : 't_message_',
        emailConfig: {
          host: fastify.config.ALISMTP_ENDPOINT,
          port: 465,
          secure: true,
          user: fastify.config.AWS_SES_SOURCE_EMAIL || fastify.config.ALISMTP_USER,
          pass: fastify.config.ALISMTP_PASSWORD
        },
        templateDir: path.join(__dirname, './messageTemplate'),
        senders: {
          0: fastify.config.AWS_SES_SOURCE_EMAIL && (mailOptions => fastify.aws.services.ses(mailOptions)),
          1: async ({ name, props, content }) => {
            return await fastify.task.services.executor({
              type: 'sms',
              task: {
                input: {
                  name,
                  props,
                  content
                }
              }
            });
          }
        }
      });

      // 兼容 @kne/fastify-tenant 硬编码 code=INVITETENANT：映射为 INVITETENANT[locale]
      // 仅 zh-CN 用中文，其余默认英文（与采集邀请一致）
      // 另外：fastify-message 2.x 的模板不支持 JS 表达式/循环，发送前用 prepareMessageProps 预算派生变量；
      // 2.x 发送失败不再抛错（只写失败记录），这里还原为抛错，业务侧沿用 try/catch 判断失败
      fastify.register(
        require('fastify-plugin')(async fastify => {
          const originalSendMessage = fastify.message.services.sendMessage.bind(fastify.message.services);
          fastify.message.services.sendMessage = async params => {
            let { code, options: targetOptions } = params;
            if (code === 'INVITETENANT') {
              const language = params.props?.language === 'zh-CN' ? 'zh-CN' : 'en-US';
              code = `INVITETENANT[${language}]`;
              targetOptions = Object.assign({}, targetOptions, {
                title: language === 'zh-CN' ? '加入租户邀请' : 'Tenant Invitation'
              });
            }
            const record = await originalSendMessage(Object.assign({}, params, { code, props: prepareMessageProps({ code, props: params.props }), options: targetOptions }));
            if (!record || Number(record.status) === 1) {
              throw new Error(record?.error || '消息发送失败');
            }
            return record;
          };
        })
      );

      fastify.register(require('@kne/fastify-signature'), {
        prefix: `${options.prefix}/signature`
      });

      fastify.register(require('@kne/fastify-task'), {
        prefix: `${options.prefix}/task`,
        cronTime: options.taskCron,
        maxPollTimes: 40,
        pollInterval: 20 * 1000,

        task: {
          'parse-resume': target => {
            return fastify[options.name].services.resume.parseTaskRecord(target);
          },
          'sync-org': ({ task, result }) => {
            return fastify.tenant.services.org.syncOrg(result);
          },
          'sync-org-send-message': ({ task, result }) => {
            return result;
          },
          'assessment-profile-review': ({ result }) => {
            return result;
          },
          'position-ai-analysis': ({ result }) => {
            return result;
          },
          'position-analysis-review': ({ result }) => {
            return result;
          },
          // invite-video-asr 只做转写；结果按发起方（task.targetType）在这里分发处理
          'invite-video-asr': {
            handler: ({ task, result }) => {
              const services = fastify[options.name].services;
              if (task.targetType === 'talentCollectInvite') {
                return services.talentCollectInvite.onVideoAsrSuccess({ task, result });
              }
              if (task.targetType === 'readiness-stage') {
                return services.readinessSend.onVideoAsrSuccess({ task, result });
              }
              return result;
            },
            errorHandler: ({ task, error }) => {
              const services = fastify[options.name].services;
              if (task.targetType === 'talentCollectInvite') {
                return services.talentCollectInvite.onVideoAsrFailed({ task, error });
              }
              if (task.targetType === 'readiness-stage') {
                return services.readinessSend.onVideoAsrFailed({ task, error });
              }
            }
          },
          // Readiness：上游服务调用统一走该类型，input={path,params}；结果与错误由 readiness 服务落到阶段数据
          Readiness: {
            handler: ({ task, result }) => fastify[options.name].services.readiness.onTaskSuccess({ task, result }),
            errorHandler: ({ task, error }) => fastify[options.name].services.readiness.onTaskFailed({ task, error }),
            cancelHandler: ({ task }) => fastify[options.name].services.readiness.onTaskCanceled({ task })
          },
          // ReadinessPublish：问卷确认后写入 AI 面试（建题、转数字人、建项目并开启），结果同样落到阶段数据
          ReadinessPublish: {
            handler: ({ task, result }) => fastify[options.name].services.readiness.onTaskSuccess({ task, result }),
            errorHandler: ({ task, error }) => fastify[options.name].services.readiness.onTaskFailed({ task, error }),
            cancelHandler: ({ task }) => fastify[options.name].services.readiness.onTaskCanceled({ task })
          },
          // ReadinessRoleApply：报告完成后写回岗位任务 / outlook / 策略与个人就绪度
          ReadinessRoleApply: {
            handler: ({ task, result }) => fastify[options.name].services.readiness.onTaskSuccess({ task, result }),
            errorHandler: ({ task, error }) => fastify[options.name].services.readiness.onTaskFailed({ task, error }),
            cancelHandler: ({ task }) => fastify[options.name].services.readiness.onTaskCanceled({ task })
          }
        }
      });

      fastify.register(require('@kne/fastify-tenant'), {
        prefix: `${options.prefix}/tenant`,
        dbTableNamePrefix: tablePrefix || 't_',
        getUserModel: options.getUserModel,
        onPermissionChange: payload => fastify.oidc.onPermissionChange(payload),
        syncOrgType: fastify.config.SYNC_ORG_TYPE,
        syncOrgTask: async input => {
          const { tenantId } = input;
          return fastify.task.services.create({
            type: 'sync-org',
            targetId: tenantId,
            targetType: 'tenant',
            runnerType: 'system',
            input
          });
        },
        sendOrgMessage: async ({ tenantId, syncSource, config, touser, msgtype, content }) => {
          return fastify.task.services.executor({
            type: 'sync-org-send-message',
            task: {
              input: {
                tenantId,
                syncSource,
                config,
                touser,
                msgtype,
                content
              }
            }
          });
        }
      });

      // @fastify/env 7 不再把 .env 写入 process.env，fastify-oidc 的环境变量默认值读不到，需显式传入
      // 显式传入 tenant 开启应用中心宿主租户能力（tenantRole=host），否则无法向子应用同步/获取平台租户
      fastify.register(require('@kne/fastify-oidc'), {
        isMain: true,
        tenant: () => fastify.tenant,
        selfClient: { clientName: 'LeapIn Talent SaaS' },
        dbTableNamePrefix: tablePrefix || 't_',
        origin: fastify.config.ORIGIN,
        keyEncryptionSecret: fastify.config.OIDC_KEY_SECRET
      });

      fastify.register(require('@kne/fastify-aws'), {
        prefix: `${options.prefix}/aws`,
        oss: {
          baseDir: 'ai-talent-saas',
          region: fastify.config.AWS_S3_REGION,
          accessKeyId: fastify.config.AWS_S3_ACCESS_KEY_ID,
          accessKeySecret: fastify.config.AWS_S3_SECRET_ACCESS_KEY,
          bucket: fastify.config.AWS_S3_BUCKET
        },
        ses: {
          region: fastify.config.AWS_SES_REGION,
          accessKeyId: fastify.config.AWS_SES_ACCESS_KEY_ID,
          accessKeySecret: fastify.config.AWS_SES_SECRET_ACCESS_KEY,
          from: fastify.config.AWS_SES_SOURCE_EMAIL
        }
      });

      // 应用中心会连接 PM2 托管子应用进程，默认关闭，仅在作为宿主部署时开启
      if (fastify.config.APP_MANAGER_ENABLED) {
        // 与 fastify-oidc 主 IdP 默认的 mountPath(/oidc)、prefix(/api/oidc) 保持一致
        const oidcOrigin = new URL(fastify.config.ORIGIN).origin;
        const appOidc = require('@kne/fastify-app-manager/oidc')(fastify, {
          origin: oidcOrigin,
          issuer: `${oidcOrigin}/oidc`,
          serviceAudience: `${oidcOrigin}/api/oidc`
        });
        // 租户上下文：同请求内缓存；取不到租户（非租户登录）返回 null
        const tenantContextCache = new WeakMap();
        const resolveTenantContext = async request => {
          if (tenantContextCache.has(request)) {
            return tenantContextCache.get(request);
          }
          let ctx = null;
          try {
            await fastify.tenant.authenticate.tenantUser(request);
            const info = request.tenantUserInfo;
            const read = key => (typeof info?.getDataValue === 'function' ? info.getDataValue(key) : info?.[key]);
            if (info?.tenantId) {
              ctx = {
                tenantId: String(info.tenantId),
                permissions: new Set((read('permissions') || []).map(String)),
                isAdmin: await fastify.tenant.services.user.resolveIsTenantAdmin({
                  tenantId: info.tenantId,
                  roleDetails: read('roleDetails'),
                  roles: read('roles'),
                  currentTenantUserId: info.id
                })
              };
            }
          } catch (e) {
            ctx = null;
          }
          tenantContextCache.set(request, ctx);
          return ctx;
        };
        // 超级管理员判定：与 fastify-account 的 admin 服务一致（request.userInfo.isSuperAdmin）
        const isSuperAdminRequest = async request => {
          try {
            if (!request.userInfo) {
              await fastify.account.authenticate.user(request);
            }
            return !!request.userInfo && (await fastify.account.services.admin.checkIsSuperAdmin(request.userInfo));
          } catch (e) {
            return false;
          }
        };
        // 应用 name 是租户权限树顶层码时，该应用有权限树，需按租户开通与用户权限码判断
        const isPermissionRoot = name => (fastify.tenant?.permissions?.modules || []).some(item => item && String(item.code) === name);
        fastify.register(require('@kne/fastify-app-manager'), {
          prefix: `${options.prefix}/app-manager`,
          dbTableNamePrefix: tablePrefix ? `${tablePrefix}app_manager_` : 't_app_manager_',
          appsRoot: path.resolve(fastify.config.APPS_ROOT || './managed-apps'),
          // 本机与 developer-document 共用 pm2，其应用中心从 4000 分配端口，这里错开
          portMin: 4100,
          migrateBeforeStart: true,
          defaultAppDbConnection: fastify.config.APPS_DB_DATABASE ? 'appManagerApps' : null,
          defaultAppDb: fastify.config.APPS_DB_DATABASE
            ? {
                dialect: fastify.config.DB_DIALECT,
                host: fastify.config.DB_HOST,
                port: fastify.config.DB_PORT,
                database: fastify.config.APPS_DB_DATABASE,
                username: fastify.config.DB_USERNAME,
                password: fastify.config.DB_PASSWORD,
                logging: false
              }
            : null,
          // 外部关联：installKey.platformOrigin 须等于本平台 ORIGIN
          origin: oidcOrigin,
          signPlatformAssertion: appOidc.signPlatformAssertion,
          ensureLinkedRegistration: appOidc.ensureLinkedRegistration,
          getOpsServiceToken: appOidc.getServiceToken,
          systemEnvKeys: appOidc.systemEnvKeys,
          resolveSystemEnv: appOidc.resolveSystemEnv,
          onAppRemoved: appOidc.onAppRemoved,
          getOpenApiToken: appOidc.getOpenApiToken,
          issueUserAccessToken: appOidc.issueUserAccessToken,
          // linked 权限快照并入租户权限树；远程删码由快照 stale 保留，不自动清角色授予
          onPermissionsSynced: async ({ tree, sourceKey }) => {
            if (fastify.tenant?.setPermissionSource) {
              fastify.tenant.setPermissionSource(sourceKey, tree, { defaultDisabled: true });
            }
          },
          onPermissionsRemoved: async ({ sourceKey }) => {
            if (fastify.tenant?.removePermissionSource) {
              fastify.tenant.removePermissionSource(sourceKey);
            }
          },
          // 应用中心只展示当前租户已开通的应用：应用 name 是租户权限树顶层码时，租户权限里没有 name 或 name:* 即视为已关闭；
          // 没有权限树的应用（托管应用）、取不到租户的请求不裁剪
          filterCenterApps: async ({ apps, request }) => {
            const tenant = fastify.tenant;
            const roots = new Set((tenant?.permissions?.modules || []).map(item => item && String(item.code)));
            if (!apps.some(app => roots.has(app.name))) {
              return apps;
            }
            let tenantId;
            try {
              await tenant.authenticate.tenantUser(request);
              tenantId = request.tenantUserInfo?.tenantId;
            } catch (e) {
              return apps;
            }
            if (!tenantId) {
              return apps;
            }
            const { codes } = await tenant.services.permission.tenantLevelList({ tenantId });
            const enabled = new Set(codes.map(code => String(code).split(':')[0]));
            return apps.filter(app => !roots.has(app.name) || enabled.has(app.name));
          },
          // 租户上下文：当前请求所属租户与用户权限码（权限树里没有的应用没有权限码，按租户开通规则单独判断）
          getTenantId: async ({ request }) => {
            const ctx = await resolveTenantContext(request);
            return ctx ? ctx.tenantId : null;
          },
          // 应用展示方式只由超级管理员在「租户详情 → 设置」里配置：须是超级管理员，且 tenantId 必须是存在的租户
          canManageDisplay: async ({ request, tenantId }) => {
            if (!(await isSuperAdminRequest(request))) {
              return false;
            }
            if (tenantId) {
              return !!(await fastify.tenant.models.tenant.count({ where: { id: tenantId } }));
            }
            return true;
          },
          // 签发子应用令牌前把关：应用对当前租户已开通，且用户拥有该应用的任一权限；没有权限树的应用（托管应用）租户成员即可使用
          canUseApp: async ({ app, request }) => {
            const ctx = await resolveTenantContext(request);
            if (!ctx) {
              return false;
            }
            if (!isPermissionRoot(app.name)) {
              return { tenantId: ctx.tenantId };
            }
            const { codes } = await fastify.tenant.services.permission.tenantLevelList({ tenantId: ctx.tenantId });
            if (!codes.some(code => String(code).split(':')[0] === app.name)) {
              return false;
            }
            const owned = ctx.isAdmin || [...ctx.permissions].some(code => String(code).split(':')[0] === app.name);
            return owned ? { tenantId: ctx.tenantId } : false;
          },
          // 菜单的用户级裁剪：带 permission 的菜单需要用户拥有完整权限码；没有 permission 的菜单开通应用即可见，父菜单没有可见子菜单时一并隐藏
          filterCenterMenus: async ({ menus, app, request }) => {
            const ctx = await resolveTenantContext(request);
            if (!ctx) {
              return [];
            }
            const checkPermission = isPermissionRoot(app.name);
            const visible = node => !node.permissionCode || !checkPermission || ctx.isAdmin || ctx.permissions.has(node.permissionCode);
            const filter = list =>
              list
                .filter(visible)
                .map(node => (node.children ? Object.assign({}, node, { children: filter(node.children) }) : node))
                .filter(node => !node.children || node.children.length);
            return filter(menus);
          },
          getPermissionRootCodes: async () => {
            const modules = fastify.tenant?.permissions?.modules || [];
            return modules
              .map(item => item && item.code)
              .filter(Boolean)
              .map(String);
          },
          resolveVersionFile: async ({ fileId }) => {
            const { buffer } = await fastify.fileManager.services.fileRecord.getFileBlob({ id: fileId });
            return buffer;
          },
          // 关联外部应用时从远程站点抓到的图标，存入本机文件系统，返回文件 id 作为应用 icon
          saveIconFile: async ({ buffer, filename, mimetype }) => {
            const record = await fastify.fileManager.services.fileRecord.uploadToFileSystem({
              file: { filename, encoding: '7bit', mimetype, buffer }
            });
            return record.id;
          }
        });
      }
    })
  );

  fastify.register(require('@kne/fastify-shorten'));

  fastify.register(
    require('fastify-plugin')(async fastify => {
      fastify.register(require('@kne/fastify-namespace'), {
        options,
        name: options.name,
        modules: [
          ['controllers', path.resolve(__dirname, './libs/controllers')],
          ['models', await fastify.sequelize.addModels(path.resolve(__dirname, './libs/models'))],
          ['services', path.resolve(__dirname, './libs/services')]
        ]
      });
    })
  );

  fastify.register(
    require('fastify-plugin')(async fastify => {
      await fastify.sequelize.sync();
    })
  );

  // Readiness 问卷答卷周期同步（AI 面试未就绪时仅记 debug 日志）
  fastify.register(
    require('fastify-plugin')(async fastify => {
      if (!fastify.config.READINESS_ANSWER_SYNC_CRON) {
        return;
      }
      fastify.cron.createJob({
        cronTime: fastify.config.READINESS_ANSWER_SYNC_CRON,
        onTick: async () => {
          try {
            await fastify[options.name].services.readinessSend.syncAllAnswers();
          } catch (e) {
            fastify.log.warn(`readiness answer sync failed: ${e.message}`);
          }
        },
        start: true
      });
    })
  );

  fastify.register(
    require('fastify-plugin')(async fastify => {
      const getEntry = () => {
        const env = fastify.config.ENV;
        if (env === 'staging') {
          return 'entry.html';
        }

        if (env === 'prod') {
          return 'entry-prod.html';
        }

        return 'index.html';
      };
      fastify.register(require('@fastify/static'), {
        root: path.join(__dirname, './build'), // 静态文件目录
        prefix: '/',
        decorateReply: false,
        index: getEntry()
      });
      fastify.setNotFoundHandler((req, reply) => {
        if (req.method === 'GET') {
          reply.sendFile(getEntry(), { root: path.join(__dirname, './build') });
        }
      });
    })
  );

  fastify.register(require('@kne/fastify-response-data-format'));
};

module.exports = {
  fastify,
  createServer,
  start: () => {
    createServer();
    return fastify.then(() => {
      fastify.listen({ port: fastify.config.PORT, host: '0.0.0.0' }, (err, address) => {
        if (err) throw err;
        console.log(`Server is now listening on ${address}`);
      });
    });
  }
};
