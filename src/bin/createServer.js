#!/usr/bin/env -S npx corenode
const { EviteServer } = require("evite/server")

//TODO: Support activate SSR with cli arguments
const server = new EviteServer()
server.initialize()