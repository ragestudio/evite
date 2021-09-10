const fs = require("fs")
const lessToJS = require("less-vars-to-js")

export default (from) => {
    const configPath = from ?? process.env.lessBaseVariables ?? null 

    if (!configPath) {
        return {}
    }

    if (!fs.existsSync(configPath)) {
        return false
    }

    return lessToJS(fs.readFileSync(configPath, "utf8"))
}