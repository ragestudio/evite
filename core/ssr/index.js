const express = require("express")
const path = require("path")
const { createPageRender } = require("vite-plugin-ssr")
const ssr = require("vite-plugin-ssr/plugin")

const { createEviteServer } = require("../index.js")

async function startSSRServer() {
    const isProduction = process.env.NODE_ENV === "production"
    const app = express()
    const root = path.resolve(__dirname)

    let viteDevServer = null

    if (isProduction) {
        app.use(express.static(`${__dirname}/dist/client`, { index: false }))
    } else {
        viteDevServer = await createEviteServer({ root, plugins: [ssr()] })

        app.use(viteDevServer.middlewares)
    }

    const renderPage = createPageRender({ viteDevServer, isProduction, root })

    app.get("*", async (req, res, next) => {
        const url = req.originalUrl
        const pageContext = { url }

        const result = await renderPage(pageContext)
        if (result.nothingRendered) {
            return next()
        }

        res.status(result.statusCode).send(result.renderResult)
    })

    const port = 8000
    app.listen(port)
    console.log(`Server running at http://localhost:${port}`)
}

module.exports = {
    startSSRServer,
}