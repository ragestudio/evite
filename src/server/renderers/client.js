module.exports = (renderPath) => {
  return `
import { render } from "react-dom";
import { BrowserRouter } from "react-router-dom";
import App from "${renderPath}"

render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
  document.getElementById("root")
);`
}
