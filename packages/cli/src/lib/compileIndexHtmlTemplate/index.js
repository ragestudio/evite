export default (payload = {}) => {
  const { head, mainScript } = payload
  let headScripts = []
  
  if (Array.isArray(head)) {
    head.forEach(script => {
      headScripts.push(script)
    })
  }

  function getHeadScripts() {
    return headScripts.map(script => `<script type="module" src="${script}"></script>`).join('\n')
  }

  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    ${getHeadScripts()}
    <link rel="icon" type="image/svg+xml" href="src/assets/favicon.ico" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  </head>
  <body>
    <div id="root">
    <!--app-html-->
    </div>
  </body>
</html>`
}