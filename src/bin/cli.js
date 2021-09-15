#!/usr/bin/env -S npx corenode
const { EviteServer } = require("../server/index.js")

const exec = runtime.argv[1]
const { entry } = runtime.args

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

if (typeof exec !== "undefined") {
    if (typeof cliHandler[exec] === "function") {
        cliHandler[exec]()
    }
} else {
    throw new Error("No command specified!")
}