const path = require("path")
const selfSourceGlob = `${path.resolve(__dirname, "..")}/**/**`
const { overrideObjects } = require("@corenode/utils")

const BaseOverride = {
    plugins: [
        require("@vitejs/plugin-react-refresh"),
        require("@rollup/plugin-node-resolve").default({
            browser: true,
        }),
    ],
    build: {
        outDir: global?.paths?.dist ?? "./dist",
        emptyOutDir: true,
        rollupOptions: {},
    },
    optimizeDeps: {
        auto: true,
    },
    server: {
        watch: {
            ignored: [selfSourceGlob],
            usePolling: true,
            interval: 100,
        },
        port: 8000,
        host: "0.0.0.0",
        fs: {
            allow: [".."]
        },
    },
}

const Schema = {
    configFile: { value: false }, // TODO: lock value
    aliases: { default: Array() },
    plugins: { default: Array() },
    build: { default: Object() },
    optimizeDeps: { default: Object() },
    server: { default: Object() },
}

class BaseConfigurationController {
    constructor(override) {
        this.schemaKeys = Object.keys(Schema)
        this.base = this.construct()

        if (typeof override !== "undefined") {
            this.base = overrideObjects(this.base, override)
        }

        return this.base
    }

    construct = () => {
        const obj = Object()

        this.schemaKeys.forEach((key) => {
            const item = Schema[key]

            if (typeof item.value !== "undefined") {
                return obj[key] = item.value
            }

            if (typeof item.default !== "undefined") {
                return obj[key] = item.default
            }
        })

        return obj
    }

    mutate = (mutation, ...context) => {
        if (typeof mutation === "function") {
            const result = mutation(this.base, ...context)
            this.base = { ...result }
        }
    }
}

module.exports = {
    BaseConfiguration: new BaseConfigurationController(BaseOverride),
    BaseConfigurationController,
    BaseOverride,
    Schema
}