const fs = require("fs")
const path = require("path")
const vite = require("vite")
const rimraf = require("rimraf")
const fse = require('fs-extra')

const { DevelopmentServer } = require('./base.js')
const buildReactTemplate = require("../renderers/react")
const { compileIndexHtmlTemplate } = require("../../lib")

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

        const outputPath = path.resolve((this.config.build.outDir ?? path.join(this.cwd, "out")))
        const buildPath = path.resolve(this.cwd, ".tmp")
        const definitions = this.getDefinitions()

        // prepare directories before build
        await this.makeDirectories([outputPath, buildPath])

        // copy entire src folder to build folder
        await fse.copySync(this.src, buildPath)

        // write project main files
        const additionsLines = []

        // set definitions
        additionsLines.push(`function __setDefinitions() { ${definitions} }`)
        additionsLines.push(`__setDefinitions()`)

        // write templates
        // TODO: Handle custom index.html entry
        const template = await buildReactTemplate({ main: this.entry }, additionsLines)
        const htmlTemplate = compileIndexHtmlTemplate({ head: ["./index.jsx"] })

        await fs.writeFileSync(path.join(buildPath, "index.jsx"), template.construct())
        await fs.writeFileSync(path.join(buildPath, "index.html"), htmlTemplate)

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