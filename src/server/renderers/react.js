const { TemplateGenerator } = require("../../lib")

module.exports = (params = {}) => {
  if (!params.main) {
    throw new Error(`Missing MainModule`)
  }

  const template = new TemplateGenerator()

  // append basics of react
  template.appendImport("React", "react")
  template.appendImport("ReactDOM", "react-dom")
  template.appendImport("{ BrowserRouter }", "react-router-dom")

  // import main 
  template.appendImport("__MainModule", params.main)

  template.appendConstable("__Main", `() => { return <BrowserRouter> <__MainModule /> </BrowserRouter> }`)
  template.appendFunction("__createRender", undefined, `return ReactDOM.render(<__Main />, document.getElementById("root"))`)
  template.appendCall("__createRender")

  return template.construct()
}