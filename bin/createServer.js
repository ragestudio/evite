#!/usr/bin/env -S npx corenode
const path = require('path')
const { createEviteServer } = require(path.resolve(__dirname, '../core'))

createEviteServer()
    .then((server) => {
        server.listen()
    })
    .catch((err) => {
        console.error(err)
    })