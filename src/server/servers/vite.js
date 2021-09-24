const path = require('path')
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
            root: path.dirname(this.entry),
        }

        console.log(instanceConfig)

        return await (await vite.createServer(instanceConfig)).listen()
    }
}

module.exports = {
    ViteDevelopmentServer
}