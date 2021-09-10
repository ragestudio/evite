const thisPkg = require("../package.json")
const path = require("path")
const fs = require("fs")

const { findUpSync } = require("corenode/dist/filesystem")
const { overrideObjects } = require("@corenode/utils")
const lessToJS = require("less-vars-to-js")

const { createServer } = require("vite")

const overridesFilepath = findUpSync(['evite_override.js'])
const customPluginsFilepath = findUpSync(['evite_plugins.js'])

const baseCwd = process.cwd()
const sourcePath = path.resolve(baseCwd, "./src")

const CwdAliases ={
    "$": baseCwd,
    schemas: path.join(baseCwd, 'schemas'),
    interface: path.join(baseCwd, 'interface'),
    config: path.join(baseCwd, './config'),
}

const SourceAliases = {
    "@": sourcePath,
    extensions: path.join(sourcePath, 'extensions'),
    theme: path.join(sourcePath, 'theme'),
    locales: path.join(sourcePath, 'locales'),
    core: path.join(sourcePath, 'core'),
    pages: path.join(sourcePath, 'pages'),
    components: path.join(sourcePath, 'components'),
    models: path.join(sourcePath, 'models'),
}

const BaseAliases = {
    ...CwdAliases,
    ...SourceAliases
}

const BaseConfiguration = {
    aliases: {...BaseAliases},
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
                modifyVars: getLessBaseVars(),
            },
        },
    },
    resolve: {
        alias: BaseAliases,
    },
}

function getLessBaseVars() {
    const configPath = process.env.lessBaseVariables ?? path.join(BaseAliases.config, "variables.less")

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

            if (typeof overrides !== "function") {
                throw new Error("Override config file must be an function")
            }

            config = overrides(config)
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

    // parse config
    if (typeof config.aliases === "object") {
        if (Object.keys(config.aliases).length > 0) {
            config.resolve.alias ={ ...config.resolve.alias, ...config.aliases}
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