module.exports = (renderPath) => {
  return `
import React from 'react'
import { renderToString } from "react-dom/server"
import { StaticRouter } from "react-router-dom"
import App from "${renderPath}"

export function render(url, context) {
  return renderToString(
    <StaticRouter location={url} context={context}>
      <App />
    </StaticRouter>
  )
}`
}
