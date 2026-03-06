const fastify = require('fastify')({
  logger: true,
  querystringParser: str => require('qs').parse(str)
});

const fastifyEnv = require('@fastify/env');
const packageJson = require('./package.json');
const path = require('node:path');

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
        ENV: { type: 'string', default: 'local' },
        PORT: { type: 'number', default: 8040 },
        RESUME_PARSE_URL: { type: 'string' },
        RESUME_PARSE_KEY: { type: 'string' },
        SEARCH_API_URL: { type: 'string' },

        ORIGIN: { type: 'string', default: '' },
        TASK_CRON: { type: 'string', default: '' },
        OSS_REGION: { type: 'string' },
        OSS_BUCKET: { type: 'string' },
        OSS_ACCESS_KEY_ID: { type: 'string' },
        OSS_ACCESS_KEY_SECRET: { type: 'string' },

        ALISMTP_USER: { type: 'string' },
        ALISMTP_PASSWORD: { type: 'string' },
        ALISMTP_ENDPOINT: { type: 'string' },
        SMS_ACCESS_APP_ID: { type: 'string' },
        SMS_ACCESS_SECRET: { type: 'string' }
      }
    }
  });

  fastify.register(require('fastify-cron'));

  fastify.register(
    require('fastify-plugin')(async fastify => {
      fastify.register(require('@kne/fastify-sequelize'), {
        db: {
          dialect: fastify.config.DB_DIALECT,
          host: fastify.config.DB_HOST,
          port: fastify.config.DB_PORT,
          database: fastify.config.DB_DATABASE,
          username: fastify.config.DB_USERNAME,
          password: fastify.config.DB_PASSWORD
        },
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

      fastify.register(require('@kne/fastify-message'), {
        //isTest: fastify.config.IS_TEST,
        emailConfig: {
          host: fastify.config.ALISMTP_ENDPOINT,
          port: 465,
          secure: true,
          user: fastify.config.ALISMTP_USER,
          pass: fastify.config.ALISMTP_PASSWORD
        },
        templateDir: path.join(__dirname, './messageTemplate'),
        senders: {
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

      fastify.register(require('@kne/fastify-account'), {
        isTest: true,
        prefix: `${options.prefix}`,
        sendMessage: async ({ name, type, messageType, props }) => {
          // messageType: 0:短信验证码，1:邮件验证码 type: 0:注册,2:登录,4:验证租户管理员,5:忘记密码,6:候选人登录验证
          if (messageType === 1 && type === 0) {
            await fastify.message.services.sendMessage({
              name,
              type: 0,
              code: 'REGISTERCODE',
              props,
              options: {
                title: '注册验证码'
              }
            });
          }
          if (messageType === 1 && type === 5) {
            await fastify.message.services.sendMessage({
              name,
              type: 0,
              code: 'RESETPASSWORDCODE',
              props: Object.assign({}, props, {
                url: `${fastify.config.ORIGIN}/account/reset-password/${props.token}${props.options?.referer ? `?referer=${props.options?.referer}` : ''}`
              }),
              options: {
                title: '重置密码'
              }
            });
          }
          if (type === 6) {
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
              code: 'CANDIDATECODE',
              props,
              options: {
                title: '认证验证码'
              }
            });
          }
        }
      });

      fastify.register(require('@kne/fastify-task'), {
        prefix: `${options.prefix}/admin/task`,
        cronTime: options.taskCron,
        maxPollTimes: 40,
        pollInterval: 20 * 1000,
        task: {
          'parse-resume': target => {
            return fastify[options.name].services.resume.parseTaskRecord(target);
          }
        }
      });

      fastify.register(require('@kne/fastify-tenant'), {
        prefix: `${options.prefix}/tenant`,
        getUserModel: options.getUserModel
      });
    })
  );

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
