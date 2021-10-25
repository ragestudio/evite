const path = require("path")

function getDefaultAliases(cwd) {
    const rootPath = cwd ?? process.cwd()
    const sourcePath = path.resolve((cwd ?? rootPath), "src")

    let rootAliases = {
        "$": rootPath,
        config: path.join(rootPath, 'config'),
    }

    let appAliases = {
        "@": sourcePath,
        extensions: path.join(sourcePath, 'extensions'),
        theme: path.join(sourcePath, 'theme'),
        locales: path.join(sourcePath, 'locales'),
        core: path.join(sourcePath, 'core'),
        pages: path.join(sourcePath, 'pages'),
        components: path.join(sourcePath, 'components'),
        models: path.join(sourcePath, 'models'),
    }

    return {
        ...appAliases,
        ...rootAliases
    }
}

module.exports = {
    getDefaultAliases
}