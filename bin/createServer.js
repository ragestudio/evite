#!/usr/bin/env -S npx corenode
const { createEviteServer } = require("evite/dist/core/index.js")

createEviteServer()
    .then((server) => {
        server.listen()
    })
    .catch((err) => {
        console.error(err)
    })