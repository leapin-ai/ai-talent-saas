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
            // 优化构建内存使用
            webpackConfig.optimization = {
                ...webpackConfig.optimization,
                splitChunks: {
                    ...webpackConfig.optimization?.splitChunks,
                    chunks: 'all',
                    maxSize: 244 * 1024, // 244KB
                }
            };
            return webpackConfig;
        }
    }, plugins: [{
        plugin: CracoRemoteComponentsPlugin
    }]
};
