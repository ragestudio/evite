#!/usr/bin/env corenode

const express = require("express")
const path = require("path")
const fs = require("fs")
const { createServer } = require("vite")
const { createPageRender } = require("vite-plugin-ssr")

const reactRefresh = require("@vitejs/plugin-react-refresh")
const lessToJS = require("less-vars-to-js")

const nodeResolve = require("@rollup/plugin-node-resolve").default
const ssr = require("vite-plugin-ssr/plugin")

const isProduction = process.env.NODE_ENV === "production"


function getLessBaseVars() {
    const configPath = process.env.lessBaseVariables ?? path.resolve(__dirname, "./config/variables.less")

    if (!fs.existsSync(configPath)) {
        return false
    }

    return lessToJS(fs.readFileSync(configPath, "utf8"))
}

function getEviteServerConfig(overrides = {}) {
    // TODO: Support config override (ej. Plugins, Aliases... etc)
    const defaultAliases = {
        evite: path.resolve(__dirname, "./evite/src"),
        schemas: path.resolve(__dirname, './schemas'),
        extensions: path.resolve(__dirname, './src/extensions'),
        interface: path.resolve(__dirname, './interface'),
        theme: path.resolve(__dirname, './src/theme'),
        locales: path.resolve(__dirname, './src/locales'),
        core: path.resolve(__dirname, './src/core'),
        config: path.resolve(__dirname, './config'),
        "@": path.resolve(__dirname, './src'),
        pages: path.resolve(__dirname, './src/pages'),
        components: path.resolve(__dirname, './src/components'),
        models: path.resolve(__dirname, './src/models'),
    }

    let config = {
        configFile: false,
        plugins: [
            reactRefresh(),
            nodeResolve({
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
        css: {
            preprocessorOptions: {
                less: {
                    javascriptEnabled: true,
                    modifyVars: getLessBaseVars(),
                },
            },
        },
        resolve: {
            alias: defaultAliases,
        },
    }

    config.define = {
        global: {
            project,
            aliases: config.resolve.alias,
        },
        "process.env": _env,
        _env: _env,
    },

        Object.keys(overrides).forEach((key) => {
            if (typeof config[key] !== "undefined") {
                if (typeof config[key] === "object") {
                    if (Array.isArray(config[key]) && Array.isArray(overrides[key])) {
                        config[key] = [...config[key], ...overrides[key]]
                    } else {
                        config[key] = { ...config[key], ...overrides[key] }
                    }
                }
            }
        })

    return config
}

async function startSSRServer() {
    // TODO
    const app = express()
    const root = path.resolve(__dirname)

    let viteDevServer = null

    if (isProduction) {
        app.use(express.static(`${__dirname}/dist/client`, { index: false }))
    } else {
        viteDevServer = await createEviteServer({ root, plugins: [ssr()] })

        app.use(viteDevServer.middlewares)
    }

    const renderPage = createPageRender({ viteDevServer, isProduction, root })

    app.get("*", async (req, res, next) => {
        const url = req.originalUrl
        const pageContext = { url }

        const result = await renderPage(pageContext)
        if (result.nothingRendered) {
            return next()
        }

        res.status(result.statusCode).send(result.renderResult)
    })

    const port = 8000
    app.listen(port)
    console.log(`Server running at http://localhost:${port}`)
}

async function createEviteServer(overrides) {
    return await createServer(getEviteServerConfig(overrides))
}

if (_env.ssr) {
    startSSRServer()
} else {
    createEviteServer()
        .then((server) => {
            server.listen()
        })
        .catch((err) => {
            console.error(err)
        })
}
