export default (mainScript) => {
    return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="src/assets/favicon.ico" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  </head>
  <body>
    <div id="root">
    <!--app-html-->
    </div>
    <script type="module" src="${mainScript}"></script>
  </body>
</html>`
}