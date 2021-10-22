const { compileTemplate } = require("../../lib")

module.exports = (params = {}, additions) => {
  if (!params.main) {
    throw new Error(`Missing MainModule`)
  }

  const template = new compileTemplate({ file: (params.file ?? "__clientReact.jsx"), root: params.root })

  if (Array.isArray(additions)) {
    additions.forEach(line => {
      template.line(line)
    })
  }

  // append basics of react
  template.import("React", "react")
  template.import("ReactDOM", "react-dom")
  template.import("{ BrowserRouter }", "react-router-dom")

  // import main 
  template.import("__MainModule", params.main)

  template.constable("__Main", `() => { return <BrowserRouter> <__MainModule /> </BrowserRouter> }`)
  template.function("__createRender", undefined, `return ReactDOM.render(<__Main />, document.getElementById("root"))`)
  template.call("__createRender")

  return template
}