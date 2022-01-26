const thisPkg = require("../../package.json")
const fs = require("fs")
const path = require("path")
const net = require("net")

const { findUpSync } = require("corenode/filesystem")
const { EventEmitter } = require("events")
const { compileIndexHtmlTemplate } = require("../lib")
const { ConfigController } = require("../config.js")
const { getDefaultAliases } = require("../aliases.js")
const { getDefaultPlugins } = require("../plugins.js")

class DevelopmentServer {
    constructor(params) {
        this.params = { ...params }

        this.cwd = this.params.cwd ?? process.cwd()
        this.src = this.params.src ?? path.resolve(this.cwd, "src")
        this.entry = this.params.entry ?? findUpSync(["App.jsx", "app.jsx", "App.js", "app.js", "App.ts", "app.ts"], { cwd: this.src })
        this.cache = global.cachePath = path.join(path.dirname(__dirname), ".cache")
        
        this.configFile = findUpSync(this.params.configFile ?? [".config.js", ".eviterc.js",], { cwd: this.cwd })
        this.config = this.overrideWithDefaultConfig()
        this.config = this.overrideWithDefaultPlugins(this.config)
        this.config = this.overrideWithDefaultAliases(this.config)
        this.config = this.overrideWithEviteContextNamespace(this.config)
        this.config = this.overrideWithProjectConfig(this.config)
        this.config = this.parseConfig(this.config)

        this.listenPort = this.config.server.port ?? 8000
        
        this.events = new EventEmitter()

        this.events.on("server_listen", (port) => {
            console.log(`✅ Listening on port ${port ?? this.listenPort}`)
            console.log(`\t🔗 http://localhost:${port ?? this.listenPort}`)
            console.log(`\t🌐 http://0.0.0.0:${port ?? this.listenPort}`)
        })

        return this
    }

    findAllocablePort = (port) => {
        return new Promise((resolve, reject) => {
            const server = net.createServer()
            server.on("error", (err) => {
                if (err.code === "EADDRINUSE") {
                    resolve(this.findAllocablePort(port + 1))
                } else {
                    reject(err)
                }
            })
            server.listen(port, () => {
                server.close()
                resolve(port)
            })
        })
    }

    overrideWithDefaultConfig = (config = {}) => {
        config = {
            ...ConfigController.config,
            ...this.params.config,
        }

        if (Array.isArray(config.server?.fs?.allow)) {
            config.server.fs.allow.push(this.cache)
            config.server.fs.allow.push(this.cwd)
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
            "@client": this.cache,
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
        if (fs.existsSync(this.configFile)) {
            try {
                let configs = require(this.configFile)

                configs = configs.default ?? configs

                if (typeof configs === "function") {
                    const objectProxy = new Proxy(config, {})
                    config = configs(objectProxy) ?? objectProxy
                }

                if (typeof configs === "object") {
                    //TODO
                }
            } catch (error) {
                console.error(error)
            }
        }

        return config
    }

    parseConfig = (config = {}) => {
        // TODO: parse aliasers 
        // if (typeof config.aliases === "object") {            
        //     const aliases = []

        //     if (Array.isArray(config.aliases)) {

        //     }else {
        //         Object.keys(config.aliases).forEach(key => {
        //             aliases.push({
        //                 find: key,
        //                 replacement: config.aliases[key]
        //             })
        //         })
        //     }
        // }

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

    getDynamicRoutes = () => {
        const routes = []
        const routesPath = this.config.dynamicRoutesPath ?? path.resolve(this.src, "pages")

        fs.readdirSync(routesPath).forEach(file => {
           routes.push( path.resolve(routesPath, file))
        })

        return routes.reduce((acc, route) => {
            const pathname = path.basename(route)
            acc[`/${pathname}`] = route

            return acc
        }, {})
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