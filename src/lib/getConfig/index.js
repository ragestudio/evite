const path = require("path")
const fs = require("fs")

const { findUpSync } = require("corenode/dist/filesystem")
const { overrideObjects } = require("@corenode/utils")

export default (override) => {
    const overridesFilepath = findUpSync(global.configFile ?? ".config.js")
    let config = {...global.BaseConfiguration}

    // handle augmented overrides
    if (typeof override !== "undefined") {
        config = overrideObjects(config, override)
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

    // parse config
    if (typeof config.aliases === "object") {
        let aliases = []

        // parse base aliases
        Object.keys(BaseAliases).forEach(key => {
            aliases.push({
                find: key,
                replacement: global.BaseAliases[key]
            })
        })

        // parse overrides
        if (Array.isArray(config.aliases)) {
            aliases = [...aliases, ...config.aliases]
        } else {
            Object.keys(config.aliases).forEach(key => {
                aliases.push({
                    find: key,
                    replacement: config.aliases[key]
                })
            })
        }

        if (typeof config.resolve === "undefined") {
            config.resolve = Object()
        }

        config.resolve.alias = aliases
    }

    return config
}