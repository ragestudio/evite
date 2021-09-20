#!/usr/bin/env corenode-node

const { Command, program } = require("commander")
const { EviteServer } = require("../server/index.js")

const cliHandler = {
    dev: async (entry) => {
        let server = await new EviteServer({
            entry
        }).initialize()

        await server.listen()
    },
    build: () => {
        console.error("Build isn`t already available")
    }
}

const devCMD = new Command("dev", "Runs the development server").arguments("[entry]").action(cliHandler.dev)
const buildCMD = new Command("build", "Build with vite").arguments("[entry]").action(cliHandler.build)

program.addCommand(devCMD)
program.addCommand(buildCMD)
program.parse()