const fs = require("fs")
const path = require("path")
const vite = require("vite")
const rimraf = require("rimraf")
const fse = require('fs-extra')

const { CacheObject } = require("../lib")
const buildReactTemplate = require("./renderers/react")
const SSRServer = require("./ssr.js")

class ReactEviteServer extends SSRServer {
    build = async () => {
        const outputPath = typeof this.config.build.outDir !== "undefined" ? path.resolve(process.cwd(), this.config.build.outDir) : path.resolve(this.src, "..", "out")
        const buildPath = path.resolve(process.cwd(), ".tmp")

        if (fs.existsSync(outputPath)) {
            await rimraf.sync(outputPath)
        }
        if (fs.existsSync(buildPath)) {
            await rimraf.sync(buildPath)
        }

        // write build files
        let template = null

        if (typeof this.config.entryScript !== "undefined") {
            template = fs.readFileSync(this.config.entryScript, "utf8")
        } else {
            template = buildReactTemplate({ main: `./${path.basename(this.entry)}` })
        }

        const indexHtml = this.getIndexHtmlTemplate("./main.jsx")

        fs.mkdirSync(buildPath, { recursive: true })
        fs.mkdirSync(outputPath, { recursive: true })

        // copy entire src folder to build folder
        fse.copySync(this.src, buildPath)

        // write project main files
        fs.writeFileSync(path.resolve(buildPath, "main.jsx"), template)
        fs.writeFileSync(path.resolve(buildPath, "index.html"), indexHtml)

        // dispatch to vite.build
        let builderConfig = {
            root: buildPath,
            build: {
                ...this.config.build,
                emptyOutDir: true,
                outDir: outputPath
            }
        }

        await vite.build(builderConfig)

        // clean up
        await rimraf.sync(buildPath)
    }

    initialize = async () => {
        if (!this.entry) {
            throw new Error(`No entry provided`)
        }

        const entryExists = fs.existsSync(this.entry)
        const entryIsFile = entryExists && fs.statSync(this.entry).isFile() ? true : false

        if (!entryExists && !entryIsFile) {
            throw new Error(`Entry not valid`)
        }

        let template = null

        if (typeof this.config.entryScript !== "undefined") {
            template = fs.readFileSync(this.config.entryScript, "utf8")
        } else {
            template = buildReactTemplate({ main: this.entry })
        }

        const _mainEntry = await new CacheObject("__template.jsx").write(template)
        const _mainHandler = await this.createHandleRequest(_mainEntry.output)

        await this.externalizeBuiltInModules()
        return await this.initializeProxyServer(_mainHandler)
    }
}

async function createReactEviteServer(...context) {
    const server = await new ReactEviteServer(...context)
    return await server.initialize()
}

module.exports = {
    ReactEviteServer,
    createReactEviteServer,
}