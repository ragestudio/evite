#!/usr/bin/env -S npx corenode
const { EviteServer } = require("../server/index.js")
const { entry, ssr } = runtime.args

const exec = runtime.argv[1]

const cliHandler = {
    dev: async () => {
        let server = await new EviteServer({
            entryApp: entry
        })

        if (ssr) {
            (await server.initialize()).listen()
        } else {
            (await server.initialize()).listen()
        }
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