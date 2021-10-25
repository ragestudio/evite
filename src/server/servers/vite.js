const vite = require('vite')
const { DevelopmentServer } = require('./base')
const { compileIndexHtmlTemplate } = require("../../lib")
const buildReactTemplate = require("../renderers/react")
const express = require('express')

class ReactViteDevelopmentServer extends DevelopmentServer {
    initialize = async () => {
        const http = express()
        const definitions = this.getDefinitions()

        if (typeof this.config.build.rollupOptions === "undefined") {
            this.config.build.rollupOptions = Object()
        }

        this.config.build.rollupOptions.input = this.entry
        this.config.root = this.cwd
        this.config.server.middlewareMode = "ssr"

        const server = await vite.createServer(this.config)

        http.use(server.middlewares)
        http.use('*', async (req, res) => {
            const isRedirect = ({ status = 0 } = {}) => status >= 300 && status < 400
            const protocol = req.protocol || (req.headers.referer || '').split(':')[0] || 'http'
            const url = protocol + '://' + req.headers.host + req.originalUrl

            try {
                const additionsLines = []

                additionsLines.push(`function __setDefinitions() { ${definitions} }`)
                additionsLines.push(`__setDefinitions()`)

                const template = await buildReactTemplate({ main: this.entry }, additionsLines)
                const htmlTemplate = compileIndexHtmlTemplate({ head: [template.file.output] })

                const indexHtml = await server.transformIndexHtml(url, htmlTemplate)

                // write file
                template.write()

                if (isRedirect(req)) {
                    return res.end()
                }

                // res.setHeader('Content-Type', 'text/html')
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