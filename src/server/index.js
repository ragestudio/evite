const thisPkg = require("../package.json")

const express = require('express')
const vite = require("vite")
const path = require("path")
const fs = require("fs")

const { findUpSync } = require("corenode/dist/filesystem")
const { getDefaultHtmlTemplate, getConfig, buildHtml } = require("../lib")

// GLOBALS
const baseCwd = global.paths.base = process.cwd()
const sourcePath = global.paths.source = path.resolve(baseCwd, "src")
const outPath = global.paths.output = path.resolve(baseCwd, "out")
const distPath = global.paths.dist = path.resolve(baseCwd, "dist")
const isProduction = global.isProduction = process.env.NODE_ENV === "production"

const CwdAliases = {
    "$": baseCwd,
    schemas: path.join(baseCwd, 'schemas'),
    interface: path.join(baseCwd, 'interface'),
    config: path.join(baseCwd, 'config'),
}

const SourceAliases = {
    "@app": findUpSync([path.join(sourcePath, "App.js"), path.join(sourcePath, "App.jsx")]),
    "@": sourcePath,
    extensions: path.join(sourcePath, 'extensions'),
    theme: path.join(sourcePath, 'theme'),
    locales: path.join(sourcePath, 'locales'),
    core: path.join(sourcePath, 'core'),
    pages: path.join(sourcePath, 'pages'),
    components: path.join(sourcePath, 'components'),
    models: path.join(sourcePath, 'models'),
}

const BaseAliases = global.BaseAliases = {
    ...CwdAliases,
    ...SourceAliases
}

const BaseConfiguration = global.BaseConfiguration = require("./config.js")

class EviteServer {
    constructor(params) {
        this.params = { ...params }

        this.aliases = {
            ...this.params.aliases,
        }

        this.config = this.getConfig()
        this.entry = this.getEntry()

        this.externals = ["path", "fs"]

        return this
    }

    overrideContextDefinitions = (config) => {
        config.define = {
            global: {
                _versions: process.versions,
                _eviteVersion: thisPkg.version,
                project: global.project,
                aliases: BaseAliases,
            },
            "process.env": _env,
            _env: _env,
        }
        
        return config
    }

    getConfig = () => {
        const base = this.params.config ?? getConfig(BaseConfiguration)
        return this.overrideContextDefinitions(base)
    }

    getEntry = () => {
        let entry = null

        if (typeof this.params.entry !== "undefined") {
            entry = this.params.entry
        } else {
            entry = findUpSync(["App.jsx", "app.jsx", "App.js", "app.js", "App.ts", "app.ts"], { cwd: path.resolve(baseCwd, "src") })
        }

        return entry
    }

    externalizeBuiltInModules = () => {
        this.config.plugins.push(require("vite-plugin-commonjs-externals").default({
            externals: this.externals
        }))
    }

    getIndexHtmlTemplate = () => {
        let template = null

        const customHtmlTemplate = this.params.htmlTemplate ?? process.env.htmlTemplate ?? path.resolve(process.cwd(), "index.html")

        if (fs.existsSync(customHtmlTemplate)) {
            template = fs.readFileSync(customHtmlTemplate, "utf-8")
        } else {
            // create new entry client from default and writes
            template = getDefaultHtmlTemplate(this.entry)
        }

        return template
    }

    writeHead = (response, params = {}) => {
        if (params.status) {
            response.statusCode = params.status
        }

        if (params.statusText) {
            response.statusMessage = params.statusText
        }

        if (params.headers) {
            for (const [key, value] of Object.entries(params.headers)) {
                response.setHeader(key, value)
            }
        }
    }

    handleRequest = async (req, res, next) => {
        if (req.method !== 'GET' || req.originalUrl === '/favicon.ico') {
            return next()
        }

        const isRedirect = ({ status = 0 } = {}) => status >= 300 && status < 400
        let template

        try {
            template = await this.server.transformIndexHtml(req.originalUrl, this.getIndexHtmlTemplate())
        } catch (error) {
            return next(error)
        }

        try {
            const entryPoint = this.params.entryApp

            let resolvedEntryPoint = await this.server.ssrLoadModule(entryPoint)
            resolvedEntryPoint = resolvedEntryPoint.default || resolvedEntryPoint

            const render = resolvedEntryPoint.render || resolvedEntryPoint

            const protocol =
                req.protocol ||
                (req.headers.referer || '').split(':')[0] ||
                'http'

            const url = protocol + '://' + req.headers.host + req.originalUrl

            this.writeHead(res, context)

            if (isRedirect(context)) {
                return res.end()
            }

            const htmlParts = await render(url, { request: req, response: res, ...context })

            this.writeHead(res, htmlParts)

            if (isRedirect(htmlParts)) {
                return res.end()
            }

            res.setHeader('Content-Type', 'text/html')
            res.end(buildHtml(template, htmlParts))
        } catch (error) {
            // Send back template HTML to inject ViteErrorOverlay
            res.setHeader('Content-Type', 'text/html')
            res.end(template)
        }
    }

    initialize = async () => {
        const basePort = this.config.server.port
        const handler = this.handleRequest
        process.env.__DEV_MODE_SSR = 'true'

        // TODO: initialize evite extensions
            // TODO: overrideBeforeConfig
        

        this.externalizeBuiltInModules()
        this.config.server.middlewareMode = 'ssr'

        this.http = express()
        this.server = await vite.createServer(this.config)
        this.http.use(this.server.middlewares)

        this.fixEntryPoint(this.server)

        return new Proxy(this.http, {
            get(target, prop, receiver) {
                if (prop === 'listen') {
                    return async (port = basePort) => {
                        target.use(handler)
                        const server = await target.listen(port)
                        console.log(`Listening on port ${port}`)

                        return server
                    }
                }

                return Reflect.get(target, prop, receiver)
            },
        })
    }
}

module.exports = {
    BaseAliases,
    BaseConfiguration,
    EviteServer
}