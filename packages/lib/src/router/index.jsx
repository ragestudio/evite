import React, { Fragment, lazy, Suspense } from "react"
import { withRouter, Switch, Route, BrowserRouter } from "react-router-dom/modules/index.js"

import NotFoundRender from "../internals/staticRenders/NotFound"

const JSXRoutes = import.meta.glob("/src/pages/**/[a-z[]*.jsx")
const TSXRoutes = import.meta.glob("/src/pages/**/[a-z[]*.tsx")

const scriptRoutes = {
    ...JSXRoutes,
    ...TSXRoutes,
}

const routes = Object.keys(scriptRoutes).map((route) => {
    const path = route
        .replace(/\/src\/pages|index|\.jsx$/g, "")
        .replace(/\[\.{3}.+\]/, "*")
        .replace(/\[(.+)\]/, ":$1")

    return { path, component: lazy(scriptRoutes[route]) }
})

const InternalRouter = withRouter((props) => {
    const defaultTransitionDelay = 150

    React.useEffect(() => {
        props.history.listen((event) => {
            if (typeof props.onTransitionFinish === "function") {
                props.onTransitionFinish(event)
            }

            window.app.eventBus.emit("transitionDone", event)
        })

        props.history.setLocation = (to, state, delay) => {
            const lastLocation = props.history.lastLocation

            if (typeof lastLocation !== "undefined" && lastLocation?.pathname === to && lastLocation?.state === state) {
                return false
            }

            if (typeof props.onTransitionStart === "function") {
                props.onTransitionStart(delay)
            }

            window.app.eventBus.emit("transitionStart", delay)

            setTimeout(() => {
                props.history.push({
                    pathname: to,
                }, state)

                props.history.lastLocation = window.location
            }, delay ?? defaultTransitionDelay)
        }

        window.app.setLocation = props.history.setLocation
    }, [])

    return <Suspense fallback={"Loading..."}>
        <Switch>
            {routes.map(({ path, component: Component = Fragment }) => (
                <Route
                    key={path}
                    path={path}
                    component={(_props) => React.createElement(BindContexts(Component), {
                        ...props,
                        ..._props
                    })}
                    exact={true}
                />
            ))}
            <Route path="*" component={props.staticRenders?.NotFound ?? NotFoundRender} />
        </Switch>
    </Suspense>
})

export function BindContexts(component) {
    let contexts = {
        main: {},
        app: {},
    }

    if (typeof component.bindApp === "string") {
        if (component.bindApp === "all") {
            Object.keys(app).forEach((key) => {
                contexts.app[key] = app[key]
            })
        }
    } else {
        if (Array.isArray(component.bindApp)) {
            component.bindApp.forEach((key) => {
                contexts.app[key] = app[key]
            })
        }
    }

    if (typeof component.bindMain === "string") {
        if (component.bindMain === "all") {
            Object.keys(main).forEach((key) => {
                contexts.main[key] = main[key]
            })
        }
    } else {
        if (Array.isArray(component.bindMain)) {
            component.bindMain.forEach((key) => {
                contexts.main[key] = main[key]
            })
        }
    }

    return (props) => React.createElement(component, { ...props, contexts })
}

export const Router = (props) => {
    return <BrowserRouter>
        <InternalRouter
            {...props}
        />
    </BrowserRouter>
}

export default Router