import React from "react"
import { EviteRuntime } from "../../src"
import { BrowserRouter } from "react-router-dom"

import * as Router from "./router"

import "styles/index.less"

console.log(React.version)

const AppHeader = () => {
    const onClickItem = (key) => {
        app.setLocation(`/${key}`)
    }

    return <div className="app_header_wrapper">
        <div className="app_header">
            <h1>App header</h1>

            <ul>
                <li onClick={() => onClickItem("")}>Index</li>
                <li onClick={() => onClickItem("test")}>Test Page</li>
            </ul>
        </div>
    </div>
}

class App extends React.Component {
    render() {
        return <React.Fragment>
            <BrowserRouter>
                <AppHeader />

                <div className="page_content">
                    <Router.PageRender />
                </div>
            </BrowserRouter>
        </React.Fragment>
    }
}

export default new EviteRuntime(App)