const fs = require("fs")
const vite = require("vite")
const chalk = require("chalk")

const { DevelopmentServer } = require('./base.js')
const { buildHtml, compileTemplate } = require("../lib")

function ansiRegex({ onlyFirst = false } = {}) {
    const pattern = [
        '[\\u001B\\u009B][[\\]()#;?]*(?:(?:(?:(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]+)*|[a-zA-Z\\d]+(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]*)*)?\\u0007)',
        '(?:(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PR-TZcf-ntqry=><~]))'
    ].join('|');

    return new RegExp(pattern, onlyFirst ? undefined : 'g');
}

function strip(string) {
    if (typeof string !== 'string') {
        throw new TypeError(`Expected a \`string\`, got \`${typeof string}\``);
    }

    return string.replace(ansiRegex(), '');
}


const splitRE = /\r?\n/

function pad(source, n = 2) {
    const lines = source.split(splitRE)
    return lines.map((l) => ` `.repeat(n) + l).join(`\n`)
}

class SSRServer extends DevelopmentServer {
    constructor(params) {
        super(params)

        //this.config.server.middlewareMode = 'ssr'
        process.env.__DEV_MODE_SSR = 'true'

        return this
    }

    logServerError = (error, server = this.server) => {
        server.ssrFixStacktrace(error)

        const msg = this.buildErrorMessage(error, [
            chalk.red(`Internal server error: ${error.message}`),
        ])

        server.config.logger.error(msg, {
            clear: true,
            timestamp: true,
            error,
        })

        const sendError = () => server.ws.send({ type: 'error', err: this.prepareError(error) })

        // Wait until browser injects ViteErrorOverlay custom element
        setTimeout(sendError, 100)
        setTimeout(sendError, 250)
    }

    prepareError = (err) => {
        return {
            message: strip(err.message),
            stack: strip(this.cleanStack(err.stack || '')),
            id: (err).id,
            frame: strip((err).frame || ''),
            plugin: (err).plugin,
            pluginCode: (err).pluginCode,
            loc: (err).loc,
        }
    }

    buildErrorMessage = (err, args = [], includeStack = true) => {
        if (err.plugin) args.push(`  Plugin: ${chalk.magenta(err.plugin)}`)
        if (err.id) args.push(`  File: ${chalk.cyan(err.id)}`)
        if (err.frame) args.push(chalk.yellow(pad(err.frame)))
        if (includeStack && err.stack) args.push(pad(this.cleanStack(err.stack)))

        return args.join('\n')
    }

    cleanStack = (stack) => {
        return stack
            .split(/\n/g)
            .filter((l) => /^\s*at/.test(l))
            .join('\n')
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

    createHandleRequest = (entries = {}, context) => {
        return async (req, res, next) => {
            if (req.method !== 'GET' || req.originalUrl === '/favicon.ico') {
                return next()
            }

            const isRedirect = ({ status = 0 } = {}) => status >= 300 && status < 400
            const protocol = req.protocol || (req.headers.referer || '').split(':')[0] || 'http'
            const url = protocol + '://' + req.headers.host + req.originalUrl

            let template = null

            try {
                template = this.getIndexHtmlTemplate(entries.client)
                template = await this.server.transformIndexHtml(req.originalUrl, template)
            } catch (error) {
                this.logServerError(error)
                return next(error)
            }

            try {
                // load server entry
                let server = await this.server.ssrLoadModule(entries.server)
                server = server.default ?? server

                let render = server.render ?? server

                const htmlParts = await render && await render(url, { request: req, response: res, ...context })

                this.writeHead(res, htmlParts)

                if (isRedirect(req)) {
                    return res.end()
                }

                res.setHeader('Content-Type', 'text/html')
                res.end(buildHtml(template, htmlParts))
            } catch (error) {
                // Send back template HTML to inject ViteErrorOverlay
                res.setHeader('Content-Type', 'text/html')
                res.end(template)
                this.logServerError(error)
            }
        }
    }
}

class SSRReactServer extends SSRServer {
    compile = async () => {
        if (!this.entry) {
            throw new Error(`No entry provided`)
        }

        const entryExists = fs.existsSync(this.entry)
        const entryIsFile = entryExists && fs.statSync(this.entry).isFile() ? true : false

        if (!entryExists && !entryIsFile) {
            throw new Error(`Entry not valid`)
        }

        // fix definitions
        const definitions = await this.getDefinitions()

        // create and build templates
        this.serverTemplate = new compileTemplate({ locate: "__server.jsx" })
        this.clientTemplate = new compileTemplate({ locate: "__client.jsx" })

        //* client
        // set definitions
        this.clientTemplate.line(`function __setDefinitions() { ${definitions} }`)
        this.clientTemplate.line(`__setDefinitions()`)

        this.clientTemplate.import("React", "react")
        this.clientTemplate.import("ReactDOM", "react-dom")
        this.clientTemplate.import("{ BrowserRouter }", "react-router-dom")
        this.clientTemplate.import("__MainModule", this.entry)

        this.clientTemplate.line(`console.log("LOADED CLIENT")`)

        this.clientTemplate.constable("__ssrRender", `ReactDOM.hydrate(<BrowserRouter><__MainModule /></BrowserRouter>, document.getElementById('root'))`)

        this.clientTemplate.call("__ssrRender")

        this.clientTemplate.write()

        //* server
        // load definitions context (fix window definitions context)

        //this.serverTemplate.line(`function __setDefinitions() { ${definitions} }`)
        //this.serverTemplate.line(`__setDefinitions()`)

        this.serverTemplate.import("React", "react")
        this.serverTemplate.import("{ createClientEntry }", "evite/client/ssr")
        this.serverTemplate.import("__MainModule", this.entry)

        //load routes
        //TODO: watch routes
        this.loadRoutes()

        // watch and handle load routes
        this.serverTemplate.line("export default createClientEntry(__MainModule, { routes }, ({ url, isClient, request }) => { console.log(url, isClient, request)})")
        this.serverTemplate.write()

        // set development watcher events
        this.events.on("load_routes", this.loadRoutes)

        return { client: this.clientTemplate.file.output, server: this.serverTemplate.file.output }
    }

    initialize = async (initialContext = {}) => {
        const entries = this.compile()
        const handler = await this.createHandleRequest(entries, initialContext)

        this.config.plugins.push({
            async configureServer(server) {
                return () => server.middlewares.use(handler)
            }
        })

        const events = this.events

        if (typeof this.config.build.rollupOptions === "undefined") {
            this.config.build.rollupOptions = Object()
        }

        this.config.build.rollupOptions.input = this.entry
        this.config.root = this.cwd

        this.server = await vite.createServer(this.config)

        return new Proxy(this.server, {
            get(target, prop, receiver) {
                if (prop === 'listen') {
                    return async (port) => {
                        const server = await target.listen(port)
                        events.emit("server_listen")
                        target.config.logger.info('\n -- SSR mode\n')
                        return server
                    }
                }

                return Reflect.get(target, prop, receiver)
            },
        })
    }

    loadRoutes = () => {
        const routerPointer = this.serverTemplate.getPointer("routes")
        const routes = this.getRoutes()

        if (typeof routerPointer !== "undefined") {
            routerPointer.update = routes
        } else {
            this.serverTemplate.constable("routes", routes, { objected: true })
        }

        this.serverTemplate.write()
    }

    getRoutes = () => {
        //TODO: read routes from file
        let routes = Array()

        return routes
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