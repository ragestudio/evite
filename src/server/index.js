const thisPkg = require("../package.json")

const express = require('express')
const vite = require("vite")
const path = require("path")
const fs = require("fs")
const md5 = require("md5")
const { moduleFromString } = require("@corenode/utils")

const { transform } = require("corenode/transcompiler")
const { findUpSync } = require("corenode/filesystem")
const {  classAggregation } = require("../client")
const { getDefaultHtmlTemplate, getProjectConfig, CacheObject, buildHtml } = require("../lib")
// GLOBALS
global.paths = {}
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

const BaseConfiguration = global.BaseConfiguration = require("./config.js").BaseConfiguration

class AppClass {
    constructor(params) {
        this.params = { ...params }

        if (typeof this.render === "function") {
            this.render()
        }
    }

    static getFs() {
        return fs
    }


}

function getEviteClasses() {
    const base = fs.readFileSync(require.resolve("evite"), "utf-8")

    console.log(base)

    return base
}

function buildReactEntry(_instance) {
    class _staticServerClass extends classAggregation(_instance) {
        getStaticBuild = () => {
            return `
            class __main__ extends React.Component {
                render() {
                    return <div>TEST</div>
                }
            }
            
            `
        }
    }

    const _class = new _staticServerClass()
    console.log(_class.super)

    let base = `
        import React from "react"
        import ReactDOM from "react-dom"
        import * as evite from "evite"
       

        ${_class.getStaticBuild()}

        ReactDOM.render(<__main__ />, document.querySelector("#root"))
    `

    return base
}

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
            "process.env": process.env,
            _env: process.env,
        }

        return config
    }

    getConfig = () => {
        const base = this.params.config ?? getProjectConfig(BaseConfiguration)
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

    compile = (filePath, code) => {
        return transform(code, {
            transforms: ['typescript', 'jsx', 'imports'],
            filePath
        }).code
    }

    serveStaticServerClass = async (_instance) => {
        return await new CacheObject("_appFile_tmp.jsx").write(buildReactEntry(_instance))
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

        // try to compile
        const code = await this.compile(this.entry, fs.readFileSync(this.entry, "utf-8"))

        const _app = await this.serveStaticServerClass(moduleFromString(code, this.entry))

        const handler = this.createHandleRequest(_app.output)
        const basePort = this.config.server.port
        process.env.__DEV_MODE_SSR = 'true'

        // TODO: initialize evite extensions
        // TODO: overrideBeforeConfig

        this.externalizeBuiltInModules()
        this.config.server.middlewareMode = 'ssr'

        this.http = express()
        this.server = await vite.createServer(this.config)
        this.http.use(this.server.middlewares)

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