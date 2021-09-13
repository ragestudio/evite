#!/usr/bin/env -S npx corenode
const { EviteServer } = require("evite/server")
const { entry } = runtime.args

const exec = runtime.argv[1]

const cliHandler = {
    dev: () => {
        const server = new EviteServer({
            entryApp: entry
        })
        server.initialize()
    },
    build: () => {
        const server = new EviteServer({
            entryApp: entry
        })
        server.build()
    }
}

if (typeof exec !== "undefined") {
    if (typeof cliHandler[exec] === "function") {
        cliHandler[exec]()
    }
} else {
    throw new Error("No command specified!")
}




