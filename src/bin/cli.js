#!/usr/bin/env corenode-node
const { Command, program } = require("commander")
const { SSRReactServer, ViteDevelopmentServer } = require("../server/index.js")

const eviteServers = {
    "ssr-react": async (...context) => {
        return await (new SSRReactServer(...context)).initialize()
    },
    "react": async (...context) => {
        return await new ViteDevelopmentServer(...context)
    }
}

const cliHandler = {
    dev: async (entry, options) => {
        const mode = options.mode ?? "react"

        if (typeof eviteServers[mode] === "undefined") {
            throw new Error(`Invalid mode: ${mode}`)
        }

        const server = await eviteServers[mode]({
            src: options.src,
            cwd: options.cwd,
            entry: entry
        })
        
        await server.listen()
    },
    build: async (entry, options) => {
        const server = await eviteServers["ssr-react"]({
            src: options.src,
            cwd: options.cwd,
            entry: entry
        })

        server.build()
    }
}

const devCMD = new Command("dev", "Runs the development server")
    .argument("[entry]")
    .option("--mode <mode>", "Use provided as render framework")
    .option("--cwd <cwd>")
    .option("--src <src>")
    .action(cliHandler.dev)

const buildCMD = new Command("build", "Build with vite")
    .argument("[entry]")
    .argument("[mode]", "Use provided as render framework", "react")
    .option("--cwd <cwd>")
    .option("--src <src>")
    .action(cliHandler.build)

program.addCommand(devCMD)
program.addCommand(buildCMD)
program.parse()