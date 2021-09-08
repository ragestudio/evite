#!/usr/bin/env corenode
const { createEviteServer } = require('../core')

createEviteServer()
    .then((server) => {
        server.listen()
    })
    .catch((err) => {
        console.error(err)
    })
