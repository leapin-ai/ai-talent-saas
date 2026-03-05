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
        SEARCH_API_URL: { type: 'string' }
      }
    }
  });

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
    })
  );

  fastify.register(require('@kne/fastify-file-manager'), {
    prefix: `${options.prefix}/static`,
    root: path.resolve('./static')
  });

  fastify.register(require('@kne/fastify-account'), {
    isTest: true,
    prefix: `${options.prefix}`
  });

  fastify.register(require('fastify-cron'));

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

  fastify.register(
    require('fastify-plugin')(async fastify => {
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
