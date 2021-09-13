const thisPkg = require("../package.json")

const vite = require("vite")
const path = require("path")
const fs = require("fs")
const express = require("express")

const { findUpSync } = require("corenode/dist/filesystem")

const { getDefaultHtmlTemplate, getLessBaseVars, getConfig } = require("../lib")

// PATHS
const baseCwd = process.cwd()
const sourcePath = path.resolve(baseCwd, (process.env.sourcePath ?? "src"))
const distPath = path.resolve(baseCwd, (process.env.distPath ?? "dist"))

// GLOBALS
const cachePath = global.cachePath = path.resolve(__dirname, ".cache")
const isProduction = global.isProduction = process.env.NODE_ENV === "production"
const selfSourceGlob = `${path.resolve(__dirname, "..")}/**/**`

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

const BaseConfiguration = global.BaseConfiguration = {
    aliases: [],
    configFile: false,
    plugins: [
        require("@vitejs/plugin-react-refresh"),
        require("@rollup/plugin-node-resolve").default({
            browser: true,
        }),
    ],
    server: {
        port: process.env.port ?? 8000,
        host: process.env.host ?? "0.0.0.0",
        fs: {
            allow: [".."]
        },
    },
    define: {
        global: {
            _versions: process.versions,
            _eviteVersion: thisPkg.version,
            project: global.project,
            aliases: BaseAliases,
        },
        "process.env": _env,
        _env: _env,
    },
    css: {
        preprocessorOptions: {
            less: {
                javascriptEnabled: true,
                modifyVars: { ...getLessBaseVars() },
            },
        },
    }
}
class CacheObject {
    constructor(key) {
        this.root = global.cachePath ?? path.join(process.cwd(), ".cache")
        this.output = path.join(this.root, key)

        if (!fs.existsSync(this.root)) {
            fs.mkdirSync(this.root)
        }

        if (!fs.lstatSync(this.root).isDirectory()) {
            throw new Error(`Cache path is not an valid root directory`)
        }

        return this
    }

    createWriteStream = () => {
        return fs.createWriteStream(this.output)
    }

    createReadStream = () => {
        return fs.createReadStream(this.output)
    }

    write = (content) => {
        fs.writeFileSync(this.output, content, { encoding: "utf-8" })
        return this
    }
}
class EviteServer {
    constructor(params) {
        this.params = { ...params }

        this.config = this.params.config ?? getConfig()
        this.aliases = {
            ...this.params.aliases,
        }

        this.entryAppPath = this.params.entryApp ?? path.resolve(sourcePath, "App.js") // TODO: use findUpSync
        this.httpServer = null
        this.eviteServer = null

        return this
    }

    getHtmlTemplate = () => {
        let template = null

        const customHtmlTemplate = this.params.htmlTemplate ?? process.env.htmlTemplate ?? path.resolve(process.cwd(), "index.html")

        if (fs.existsSync(customHtmlTemplate)) {
            template = fs.readFileSync(customHtmlTemplate, "utf-8")
        } else {
            // create new entry client from default and writes
            const generated = this.createEntryClientTemplate({ entryApp: this.entryAppPath }) // returns the path from generated entry
            template = getDefaultHtmlTemplate(generated)
        }

        return template
    }

    initialize = async () => {
        return this.eviteServer = await vite.createServer(this.config)
    }

    initializeSSR = async () => {
        this.httpServer = express()

        this.config.server.middlewareMode = "ssr"
        this.config.server.watch = {
            ignored: [selfSourceGlob],
            usePolling: true,
            interval: 100,
        }

        if (isProduction) {
            this.httpServer.use(require("compression")())
            app.use(
                require("serve-static")(path.resolve(distPath, "client"), {
                    index: false,
                })
            )
        } else {
            if (!this.entryAppPath) {
                throw new Error(`Entry App not found`)
            }

            this.eviteServer = await vite.createServer(this.config)
            this.httpServer.use(this.eviteServer.middlewares)
        }

        this.httpServer.use("*", async (req, res) => {
            try {
                const serverEntryPath = this.createEntryServerTemplate({ entryApp: this.entryAppPath })
                const url = req.originalUrl

                let htmlTemplate = null
                let renderMethod = null

                if (!isProduction) {
                    htmlTemplate = await this.eviteServer.transformIndexHtml(url, this.getHtmlTemplate()) // get client html template
                    renderMethod = (await this.eviteServer.ssrLoadModule(serverEntryPath)).render // get ssr render function
                } else {
                    htmlTemplate = path.resolve(distPath, "index.html")
                    renderMethod = require(serverEntryPath).render
                }

                const context = {}
                const appHtml = renderMethod(url, context)

                if (context.url) {
                    // Somewhere a `<Redirect>` was rendered
                    return res.redirect(301, context.url)
                }

                res.status(200).set({ "Content-Type": "text/html" }).end(htmlTemplate.replace(`<!--app-html-->`, appHtml))
            } catch (error) {
                !isProduction && this.eviteServer.ssrFixStacktrace(error)
                console.log(error.stack)
                res.status(500).end(error.stack)
            }
        })

        return { httpServer: this.httpServer, eviteServer: this.eviteServer }
    }

    createEntryClientTemplate = ({ entryApp }) => {
        let template = require("./renderers/client.js")(entryApp)

        return new CacheObject("entry_client.jsx").write(template).output
    }

    createEntryServerTemplate = ({ entryApp }) => {
        let template = require("./renderers/server.js")(entryApp)

        return new CacheObject("entry_server.jsx").write(template).output
    }
}

module.exports = {
    BaseAliases,
    BaseConfiguration,
    EviteServer
}