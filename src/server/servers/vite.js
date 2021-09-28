const vite = require('vite')
const { DevelopmentServer } = require('./base')
const { compileIndexHtmlTemplate } = require("../../lib")
const buildReactTemplate = require("../renderers/react")
const express = require('express')

class ReactViteDevelopmentServer extends DevelopmentServer {
    initialize = async () => {
        const http = express()
        const definitions = await this.compileDefinitions()
        const instanceConfig = {
            ...this.config,
            root: this.cwd,
            server: {
                ...this.config.server,
                middlewareMode: 'ssr'
            },
        }
        const server = await vite.createServer(instanceConfig)

        http.use(server.middlewares)
        http.use('*', async (req, res) => {
            const isRedirect = ({ status = 0 } = {}) => status >= 300 && status < 400
            const protocol = req.protocol || (req.headers.referer || '').split(':')[0] || 'http'
            const url = protocol + '://' + req.headers.host + req.originalUrl

            try {
                const template = await buildReactTemplate({ main: this.entry }, [definitions]).write()
                const indexHtml = await server.transformIndexHtml(url, compileIndexHtmlTemplate(template.file.output))
                
                if (isRedirect(req)) {
                    return res.end()
                }

                res.setHeader('Content-Type', 'text/html')
                return res.status(200).end(indexHtml)
            } catch (error) {
                server.ssrFixStacktrace(error)
                console.error(error)
                res.status(500).end(error.message)
            }
        })

        return {
            http,
            server,
            listen: () => {
                this.events.emit("server_listen")
                return http.listen(this.config.server?.port ?? 8000)
            }
        }
    }
}

module.exports = {
    ReactViteDevelopmentServer
}