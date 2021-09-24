const vite = require('vite')
const { DevelopmentServer } = require('./base')

class ViteDevelopmentServer extends DevelopmentServer {
    constructor(params) {
        super(params)

        this.config.server.middlewareMode = undefined
        process.env.__DEV_MODE_SSR = 'false'

        return this
    }

    listen = async () => {
        const instanceConfig = {
            ...this.config,
            root: this.cwd,
        }

        return (await vite.createServer(instanceConfig)).listen(instanceConfig.server.port)
    }
}

module.exports = {
    ViteDevelopmentServer
}