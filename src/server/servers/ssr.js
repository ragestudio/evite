const fs = require("fs")
const path = require("path")
const vite = require("vite")
const rimraf = require("rimraf")
const fse = require('fs-extra')
const express = require("express")

const { DevelopmentServer } = require('./base.js')
const { findUpSync } = require("corenode/filesystem")

const { CacheObject } = require("../../lib")
const buildReactTemplate = require("../renderers/react")

const { getDefaultHtmlTemplate, buildHtml } = require("../../lib")

class SSRServer extends DevelopmentServer {
    constructor(params) {
        super(params)

        this.config.server.middlewareMode = 'ssr'
        process.env.__DEV_MODE_SSR = 'true'

        return this
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
        const events = this.events

        return new Proxy(this.http, {
            get(target, prop, receiver) {
                if (prop === 'listen') {
                    return async (port = basePort) => {
                        target.use(handler)
                        const server = await target.listen(port)
                        events.emit("server_listen")
                        
                        return server
                    }
                }

                return Reflect.get(target, prop, receiver)
            },
        })
    }
}

class SSRReactServer extends SSRServer {
    build = async () => {
        const outputPath = typeof this.config.build.outDir !== "undefined" ? path.resolve(process.cwd(), this.config.build.outDir) : path.resolve(this.src, "..", "out")
        const buildPath = path.resolve(process.cwd(), ".tmp")

        if (fs.existsSync(outputPath)) {
            await rimraf.sync(outputPath)
        }
        if (fs.existsSync(buildPath)) {
            await rimraf.sync(buildPath)
        }

        // write build files
        let template = null

        if (typeof this.config.entryScript !== "undefined") {
            template = await fs.readFileSync(this.config.entryScript, "utf8")
        } else {
            template = buildReactTemplate({ main: `./${path.basename(this.entry)}` })
        }

        const indexHtml = this.getIndexHtmlTemplate("./main.jsx")

        fs.mkdirSync(buildPath, { recursive: true })
        fs.mkdirSync(outputPath, { recursive: true })

        // copy entire src folder to build folder
        await fse.copySync(this.src, buildPath)

        // write project main files
        fs.writeFileSync(path.resolve(buildPath, "main.jsx"), template)
        fs.writeFileSync(path.resolve(buildPath, "index.html"), indexHtml)

        // dispatch to vite.build
        let builderConfig = {
            ...this.config,
            root: buildPath,
            build: {
                ...this.config.build,
                emptyOutDir: true,
                outDir: outputPath
            },
        }
        console.log(builderConfig)

        await vite.build(builderConfig)

        // clean up
        await rimraf.sync(buildPath)
    }

    initialize = async () => {
        if (!this.entry) {
            throw new Error(`No entry provided`)
        }

        const entryExists = fs.existsSync(this.entry)
        const entryIsFile = entryExists && fs.statSync(this.entry).isFile() ? true : false

        if (!entryExists && !entryIsFile) {
            throw new Error(`Entry not valid`)
        }

        let template = null

        if (typeof this.config.entryScript !== "undefined") {
            template = fs.readFileSync(this.config.entryScript, "utf8")
        } else {
            template = await buildReactTemplate({ main: this.entry })
        }

        const _mainEntry = await new CacheObject("__template.jsx").write(template)
        const _mainHandler = await this.createHandleRequest(_mainEntry.output)

        await this.externalizeBuiltInModules()

        await new Promise((resolve, reject) => {
            setTimeout(() => {
                resolve()
            }, 200)
        })

        return await this.initializeProxyServer(_mainHandler)
    }
}

async function createSSRReactServer(...context) {
    const server = await new SSRReactServer(...context)
    return await server.initialize()
}

module.exports = {
    SSRServer,
    SSRReactServer,
    createSSRReactServer,
}