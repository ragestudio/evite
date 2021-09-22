#!/usr/bin/env corenode-node
const { Command, program } = require("commander")
const { ReactEviteServer } = require("../server/index.js")

const eviteServers = {
    react: async (...context) => {
        return await new ReactEviteServer(...context)
    }
}

const cliHandler = {
    dev: async (entry, mode = "react", options) => {
        const server = await eviteServers[mode]({
            src: options.cwd,
            entry: entry
        })
        const proxy = await server.initialize()
        await proxy.listen()

        console.log(`🌐  Listening on port ${server.config.server.port}`)

    },
    build: async (entry, mode = "react", options) => {
        const server = await eviteServers[mode]({
            src: options.cwd,
            entry: entry
        })

        server.build()
    }
}

const devCMD = new Command("dev", "Runs the development server")
    .argument("[entry]")
    .argument("[mode]", "Use provided as render framework", "react")
    .option("--cwd <cwd>")
    .action(cliHandler.dev)

const buildCMD = new Command("build", "Build with vite")
    .argument("[entry]")
    .argument("[mode]", "Use provided as render framework", "react")
    .option("--cwd <cwd>")
    .action(cliHandler.build)

program.addCommand(devCMD)
program.addCommand(buildCMD)
program.parse()