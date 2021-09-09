#!/usr/bin/env -S npx corenode
const path = require("path")
const { createEviteServer } = require("evite")

createEviteServer()
    .then((server) => {
        server.listen()
    })
    .catch((err) => {
        console.error(err)
    })