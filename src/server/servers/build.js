const fs = require("fs")
const path = require("path")
const vite = require("vite")
const rimraf = require("rimraf")
const fse = require('fs-extra')

const { DevelopmentServer } = require('./base.js')
const buildReactTemplate = require("../renderers/react")

class BuildServer extends DevelopmentServer {
    constructor(params) {
        super(params)
    }

    makeDirectories = async (inputs) => {
        let paths = []

        if (Array.isArray(inputs)) {
            paths = inputs
        } else {
            paths.push(inputs)
        }

        paths.forEach(async (input) => {
            if (fs.existsSync(input)) {
                await rimraf.sync(input)
            }

            await fs.mkdirSync(input, { recursive: true })
        })
    }

    build = async () => {
        if (typeof this.entry === "undefined") {
            throw new Error("Entry is not defined")
        }

        const outputPath = path.resolve((this.config.build.outDir ?? "out"))
        const buildPath = path.resolve(this.cwd, ".tmp")

        // prepare directories before build
        await this.makeDirectories([outputPath, buildPath])

        // copy entire src folder to build folder
        await fse.copySync(this.src, buildPath)

        // write index.html
        // TODO: Handle custom index.html entry
        const indexHtml = this.getIndexHtmlTemplate("./index.jsx")
        await fs.writeFileSync(path.join(buildPath, "index.html"), indexHtml)

        // write project main files
        if (typeof this.config.entryScript !== "undefined") {
            const template = await fs.readFileSync(this.config.entryScript, "utf8")
            await fs.writeFileSync(path.join(buildPath, "index.jsx"), template)
        } else {
            const definitions = await this.compileDefinitions(buildPath)
            await buildReactTemplate({ main: `./${path.basename(this.entry)}`, file: "index.jsx", root: buildPath }, [definitions]).write()
        }

        // override config
        this.config.root = buildPath
        this.config.build.outDir = outputPath

        // dispatch to vite.build
        await vite.build(this.config)

        // clean up
        await rimraf.sync(buildPath)
    }
}

module.exports = {
    BuildServer
}