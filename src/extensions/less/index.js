const fs = require("fs")

module.exports = {
    id: "less",
    dependencies: ["less-vars-to-js"],
    self: {
        getLessBaseVars: (from) => {
            const configPath = from ?? process.env.lessBaseVariables ?? null

            if (!configPath) {
                return {}
            }

            if (!fs.existsSync(configPath)) {
                return false
            }

            return require("less-vars-to-js")(fs.readFileSync(configPath, "utf8"))
        }
    },
    overrideBeforeConfig: (config = {}, self) => {
        if (typeof config.css === "undefined") {
            config.css = {}
        }
        if (typeof config.css.preprocessorOptions === "undefined") {
            config.css.preprocessorOptions = {}
        }

        config.css.preprocessorOptions.less = {
            javascriptEnabled: true,
            modifyVars: { ...self.getLessBaseVars() },
        }

        return config
    }
}