#!/usr/bin/env -S npx corenode
const { EviteServer } = require("../server/index.js")
const { Command, program } = require("commander")


const cliHandler = {
    dev: async () => {
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

program.addCommand(devCMD)
program.parse()
