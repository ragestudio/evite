const path = require("path")
const selfSourceGlob = `${path.resolve(__dirname, "..")}/**/**`

const BaseConfig = {
    configFile: false,
    plugins: Array(),
    build: {
        sourcemap: false,
        minify: "terser",
        manifest: true,
        emptyOutDir: true,
    },
    server: {
        watch: {
            ignored: [selfSourceGlob, "/**/**/.cache", `${process.cwd()}/**/**/.cache`,  `${process.cwd()}/**/**/.evite`,  `/**/**/.cache`],
            usePolling: true,
            interval: 100,
        },
        port: 8000,
        host: "0.0.0.0",
        fs: {
            allow: [".."]
        },
    },
    optimizeDeps: {
        auto: true,
    },
    windowContext: Object(),
    resolve: Object(),
}

class ConfigController {
    constructor(override) {
        this.config = BaseConfig ?? Object()

        if (typeof override !== "undefined") {
            this.mutate(override)
        }

        return this
    }

    static get config() {
        return BaseConfig
    }

    mutate = (mutation, ...context) => {
        if (typeof mutation === "function") {
            const result = mutation(this.config, ...context)
            this.config = { ...result }
        }
    }
}

module.exports = {
    ConfigController,
    BaseConfig,
}