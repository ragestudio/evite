const thisPkg = require("../../package.json")

const fs = require("fs")
const path = require("path")

const { findUpSync } = require("corenode/filesystem")
const { EventEmitter } = require("events")
const { getProjectConfig, compileIndexHtmlTemplate, CacheObject } = require("../../lib")
const { ConfigController } = require("../config.js")
const { getDefaultAliases } = require("../aliases.js")
const { getDefaultPlugins } = require("../plugins.js")

class DevelopmentServer {
    constructor(params) {
        this.params = { ...params }

        this.cwd = this.params.cwd ?? process.cwd()
        this.src = this.params.src ?? path.join(this.cwd, "src")
        this.entry = this.params.entry ?? findUpSync(["App.jsx", "app.jsx", "App.js", "app.js", "App.ts", "app.ts"], { cwd: this.src })
        global.cachePath = path.join(path.dirname(this.entry), ".evite")

        this.config = this.overrideWithDefaultConfig()
        this.config = this.overrideWithDefaultPlugins(this.config)
        this.config = this.overrideWithDefaultAliases(this.config)
        this.config = this.overrideWithEviteContextNamespace(this.config)
        this.config = this.overrideWithProjectConfig(this.config)

        this.listenPort = this.config.server.port ?? 8000

        this.events = new EventEmitter()
        this.events.on("server_listen", () => {
            console.log(`🌐 Listening on port ${this.listenPort}`)
        })

        this.externals = ["path", "fs"]
        this.templateContext = Array()

        return this
    }

    overrideWithDefaultConfig = (config = {}) => {
        config = {
            ...ConfigController.config,
            ...this.params.config
        }

        return config
    }

    overrideWithDefaultPlugins = (config = {}) => {
        if (typeof config.plugins === "undefined") {
            config.plugins = Array()
        }

        const defaultPlugins = getDefaultPlugins()

        if (Array.isArray(defaultPlugins)) {
            defaultPlugins.forEach(plugin => {
                config.plugins.push(plugin)
            })
        }

        return config
    }

    overrideWithDefaultAliases = (config = {}) => {
        if (typeof config.resolve === "undefined") {
            config.resolve = Object()
        }

        config.resolve.alias = {
            ...getDefaultAliases(this.cwd),
            ...this.params.aliases,
            ...config.resolve?.alias,
            "@app": this.entry,
        }

        return config
    }

    overrideWithEviteContextNamespace = (config = {}) => {
        if (typeof config.windowContext === "undefined") {
            config.windowContext = Object()
        }

        config.windowContext.__evite = {
            versions: process.versions,
            eviteVersion: thisPkg.version,
            projectVersion: process.runtime.helpers.getVersion(),
            corenodeVersion: process.runtime.helpers.getVersion({ engine: true }),
            env: process.env,
            aliases: config.resolve?.alias
        }
        
        config.windowContext.process = config.windowContext.__evite

        return config
    }

    overrideWithProjectConfig = (config = {}) => {
        config = {
            ...getProjectConfig(config),
            ...config
        }

        return config
    }

    externalizeBuiltInModules = () => {
        const externalsPlugin = require("vite-plugin-externals").viteExternalsPlugin({
            "fast-glob": "fast-glob",
            "glob-parent": "glob-parent",
            "node": "node",
            "os": "os",
            corenode: "corenode",
        })

        this.config.plugins.push(externalsPlugin)
    }

    getDefinitions = () => {
        if (typeof this.config.windowContext === "object") {
            let defs = []

            Object.keys(this.config.windowContext).forEach(key => {
                const value = JSON.stringify(this.config.windowContext[key])

                defs.push(`window["${key}"] = ${value};`)
            })

            return defs.join("")
        }
    }

    getIndexHtmlTemplate = (mainScript) => {
        let template = null

        const customHtmlTemplate = this.params.htmlTemplate ?? process.env.htmlTemplate ?? path.resolve(process.cwd(), "index.html")

        if (fs.existsSync(customHtmlTemplate)) {
            template = fs.readFileSync(customHtmlTemplate, "utf-8")
        } else {
            // create new entry client from default and writes
            template = compileIndexHtmlTemplate(mainScript)
        }

        return template
    }
}

module.exports = {
    DevelopmentServer
}