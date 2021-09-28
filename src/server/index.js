const { DevelopmentServer } = require('./servers/base.js')
const { SSRServer, SSRReactServer, createSSRReactServer } = require('./servers/ssr.js')
const { ReactViteDevelopmentServer } = require('./servers/vite.js')
const { BuildServer } = require('./servers/build.js')

module.exports = {
    DevelopmentServer,
    SSRServer,
    SSRReactServer,
    createSSRReactServer,
    ReactViteDevelopmentServer,
    BuildServer,
}