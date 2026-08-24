const {CracoRemoteComponentsPlugin} = require("@kne/modules-dev");
const aliasConfig = require("./webstorm.webpack.config");

process.env.CI = false;

module.exports = {
    webpack: {
        alias: aliasConfig.resolve.alias,
        configure: (webpackConfig) => {
            const definePlugin = webpackConfig.plugins.find((plugin) => plugin.constructor.name === "DefinePlugin");
            Object.assign(definePlugin.definitions["process.env"], {
                DEFAULT_VERSION: `"${process.env.npm_package_version}"`
            });
            return webpackConfig;
        }
    }, plugins: [{
        plugin: CracoRemoteComponentsPlugin,
        options: {
            // 与 ai-interview-flowup 对齐：react eager，否则动态加载其 remote 时 MF consumes 会报 loaded undefined
            middleware: (config) => {
                config.shared = {
                    ...config.shared,
                    react: {
                        singleton: true,
                        requiredVersion: false,
                        eager: true
                    },
                    'react-dom': {
                        singleton: true,
                        requiredVersion: false,
                        eager: true
                    }
                };
                return config;
            }
        }
    }]
};
