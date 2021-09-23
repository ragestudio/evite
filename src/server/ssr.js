const thisPkg = require("../package.json")

const path = require("path")
const fs = require("fs")

const express = require("express")
const vite = require("vite")

const { findUpSync } = require("corenode/filesystem")
const { getDefaultHtmlTemplate, getProjectConfig, buildHtml } = require("../lib")

if (typeof global.paths === "undefined") {
    global.paths = Object()
}

const baseCwd = global.paths.base = process.cwd()
const sourcePath = global.paths.source = path.resolve(baseCwd, "src")

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

const { ConfigController } = require("./config.js")

module.exports = class SSRServer {
    constructor(params) {
        this.params = { ...params }

        this.aliases = {
            ...this.params.aliases,
        }

        this.src = this.params.src ?? path.resolve(baseCwd, "src")

        this.config = this.overrideWithDefaultContext(this.getConfig())

        this.entry = this.params.entry ?? findUpSync(["App.jsx", "app.jsx", "App.js", "app.js", "App.ts", "app.ts"], { cwd: this.src })
        this.externals = ["path", "fs"]

        this.config.server.middlewareMode = 'ssr'
        process.env.__DEV_MODE_SSR = 'true'

        return this
    }

    overrideWithDefaultContext = (config) => {
        config.define = {
            evite: {
                versions: process.versions,
                eviteVersion: thisPkg.version,
                projectVersion: process.runtime.helpers.getVersion(),
                corenodeVersion: process.runtime.helpers.getVersion({ engine: true }),
                aliases: BaseAliases,
                env: process.env,
            },
            _env: process.env,
        }

        config = {
            ...getProjectConfig(config),
            ...config
        }

        return config
    }

    getAliases = () => {
        return BaseAliases
    }

    getConfig = () => {
        return {
            ...ConfigController.config,
            ...this.params.config
        }
    }

    externalizeBuiltInModules = () => {
        const commonjsExternalsPlugin = require("vite-plugin-commonjs-externals").default({
            externals: this.externals
        })
        const externalsPlugin = require("vite-plugin-externals").viteExternalsPlugin({
            "fast-glob": "fast-glob",
            "glob-parent": "glob-parent",
            "node": "node",
            corenode: "corenode",
        })

        this.config.plugins.push(commonjsExternalsPlugin, externalsPlugin)
    }

    getIndexHtmlTemplate = (mainScript) => {
        let template = null

        const customHtmlTemplate = this.params.htmlTemplate ?? process.env.htmlTemplate ?? path.resolve(process.cwd(), "index.html")

        if (fs.existsSync(customHtmlTemplate)) {
            template = fs.readFileSync(customHtmlTemplate, "utf-8")
        } else {
            // create new entry client from default and writes
            template = getDefaultHtmlTemplate(mainScript)
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

    createHandleRequest = (entryPoint) => {
        if (typeof entryPoint === "undefined") {
            throw new Error("entryPoint is not provided")
        }

        return async (req, res, next) => {
            if (req.method !== 'GET' || req.originalUrl === '/favicon.ico') {
                return next()
            }

            const isRedirect = ({ status = 0 } = {}) => status >= 300 && status < 400
            let template

            try {
                template = await this.server.transformIndexHtml(req.originalUrl, this.getIndexHtmlTemplate(entryPoint))
            } catch (error) {
                return next(error)
            }

            try {
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
    }

    initializeProxyServer = async (handler) => {
        this.http = express()
        this.server = await vite.createServer(this.config)
        this.http.use(this.server.middlewares)

        const basePort = this.config.server.port

        return new Proxy(this.http, {
            get(target, prop, receiver) {
                if (prop === 'listen') {
                    return async (port = basePort) => {
                        target.use(handler)
                        const server = await target.listen(port)

                        return server
                    }
                }

                return Reflect.get(target, prop, receiver)
            },
        })
    }
}