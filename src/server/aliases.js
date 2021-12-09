const path = require("path")

function getDefaultAliases(cwd) {
    const rootPath = cwd ?? process.cwd()
    const sourcePath = path.resolve((cwd ?? rootPath), "src")

    return {
        "$": rootPath,
        "@": sourcePath,
    }
}

module.exports = {
    getDefaultAliases
}