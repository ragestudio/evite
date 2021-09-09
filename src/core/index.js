const path = require("path")
const fs = require("fs")

const { findUpSync } = require("corenode/dist/filesystem")
const { overrideObjects } = require("@corenode/utils")
const lessToJS = require("less-vars-to-js")

const { createServer } = require("vite")

const overridesFilepath = findUpSync(['evite_override.js'])
const customPluginsFilepath = findUpSync(['evite_plugins.js'])

const BaseAliases = {
    extensions: path.resolve(__dirname, './src/extensions'),
    "@": path.resolve(__dirname, './src'),
    schemas: path.resolve(__dirname, './schemas'),
    interface: path.resolve(__dirname, './interface'),
    theme: path.resolve(__dirname, './src/theme'),
    locales: path.resolve(__dirname, './src/locales'),
    core: path.resolve(__dirname, './src/core'),
    config: path.resolve(__dirname, './config'),
    pages: path.resolve(__dirname, './src/pages'),
    components: path.resolve(__dirname, './src/components'),
    models: path.resolve(__dirname, './src/models'),
}

const BaseConfiguration = {
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
            project,
            aliases: BaseAliases,
        },
        "process.env": _env,
        _env: _env,
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
        alias: BaseAliases,
    },
}

function getLessBaseVars() {
    const configPath = process.env.lessBaseVariables ?? path.resolve(__dirname, "./config/variables.less")

    if (!fs.existsSync(configPath)) {
        return false
    }

    return lessToJS(fs.readFileSync(configPath, "utf8"))
}

function getConfig(_overrides) {
    let config = BaseConfiguration

    // handle augmented overrides
    if (typeof _overrides !== "undefined") {
        config = overrideObjects(config, _overrides)
    }

    // handle overrides
    if (fs.existsSync(overridesFilepath)) {
        try {
            const overrides = require(overridesFilepath)

            if (typeof overrides !== "object") {
                throw new Error("Override config file must be an object")
            }

            config = overrideObjects(config, overrides)
        } catch (e) {
            console.error(e)
        }
    }

    // handle plugins
    if (fs.existsSync(customPluginsFilepath)) {
        try {
            const plugins = require(customPluginsFilepath)

            if (typeof plugins === "object") {
                if (Array.isArray(plugins)) {
                    config.plugins = [...(Array.isArray(config.plugins) ? config.plugins : []), ...plugins]
                }
            }
        } catch (e) {
            console.error(e)
        }
    }

    return config
}

async function createEviteServer(overrides) {
    return await createServer(getConfig(overrides))
}

module.exports = {
    overridesFilepath,
    customPluginsFilepath,
    BaseAliases,
    BaseConfiguration,
    getLessBaseVars,
    getConfig,
    createEviteServer,
}