import React from "react"
import { Route, Routes, useLocation, useNavigate, useParams } from "react-router-dom"
import loadable from "@loadable/component"
import config from "config"

import routesDeclaration from "constants/routes"

const DefaultNotFoundRender = () => {
    return <div>Not found</div>
}

const DefaultLoadingRender = () => {
    return <div>
        <h3>Loading page...</h3>
    </div>
}

const paths = {
    ...import.meta.glob("/src/pages/**/[a-z[]*.jsx"),
    ...import.meta.glob("/src/pages/**/[a-z[]*.tsx"),
}

const routes = Object.keys(paths).map((route) => {
    const path = route
        .replace(/\/src\/pages|index|\.jsx$/g, "")
        .replace(/\/src\/pages|index|\.tsx$/g, "")
        .replace(/\[\.{3}.+\]/, "*")
        .replace(/\[(.+)\]/, ":$1")

    return {
        path,
        element: paths[route]
    }
})

function generatePageElementWrapper(route, element, bindProps) {
    return React.createElement((props) => {
        const params = useParams()
        const url = new URL(window.location)
        const query = new Proxy(url, {
            get: (target, prop) => target.searchParams.get(prop),
        })

        const routeDeclaration = routesDeclaration.find((layout) => {
            const routePath = layout.path.replace(/\*/g, ".*").replace(/!/g, "^")

            return new RegExp(routePath).test(route)
        }) ?? {
            path: route
        }

        route = route.replace(/\?.+$/, "").replace(/\/{2,}/g, "/")
        route = route.replace(/\/$/, "")

        if (routeDeclaration) {
            // Add here your custom logic to handle routes

            if (typeof routeDeclaration.useTitle !== "undefined") {
                if (typeof routeDeclaration.useTitle === "function") {
                    routeDeclaration.useTitle = routeDeclaration.useTitle(route, params)
                }

                document.title = `${routeDeclaration.useTitle} - ${config.app.siteName}`
            } else {
                document.title = config.app.siteName
            }
        }

        return React.createElement(
            loadable(element, {
                fallback: React.createElement(bindProps.staticRenders?.PageLoad || DefaultLoadingRender),
            }),
            {
                ...props,
                ...bindProps,
                url: url,
                params: params,
                query: query,
            })
    })
}

export const PageRender = React.memo((props) => {
    const navigate = useNavigate()

    app.location = useLocation()

    React.useEffect(() => {
        // Expose navigate function to global scope
        app.setLocation = async (to, state = {}) => {
            // clean double slashes
            to = to.replace(/\/{2,}/g, "/")

            // Emit event to global scope
            app.eventBus.emit("router.navigate", to, {
                state,
            })

            return navigate(to, {
                state
            })
        }
    }, [])

    return <Routes>
        {
            routes.map((route, index) => {
                return <Route
                    key={index}
                    path={route.path}
                    element={generatePageElementWrapper(route.path, route.element, props)}
                    exact
                />
            })
        }
        <Route
            path="*"
            element={React.createElement(props.staticRenders?.NotFound || DefaultNotFoundRender)}
        />
    </Routes>
})