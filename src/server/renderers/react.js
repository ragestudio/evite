module.exports = (main) => {
  return `import React from 'react'
import { BrowserRouter } from "react-router-dom";
import ReactDOM from "react-dom"
import _mainModule from "${main}"

const __main__app = () => {
  return <React.StrictMode>
    <BrowserRouter>
      <_mainModule />
    </BrowserRouter>
  </React.StrictMode>
}

function __createRender() {
   ReactDOM.render(<__main__app/>, document.querySelector("#root"))
}
    
__createRender()`}
