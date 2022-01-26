import React from "react"
import { useLocation, useParams } from "react-router-dom"
import { createUrl, getFullPath } from "../url"

export function useClientRedirect(spaRedirect) {
    return {
        writeResponse: () => console.warn("[SSR] Do not call writeResponse in browser"),
        redirect: (location, status) => {
            if (location.startsWith("/")) {
                return spaRedirect(location)
            } else {
                window.location.href = location
            }
        },
    }
}

export function createRouter({ base, routes, PropsProvider, pagePropsOptions = { passToPage: true } }) {
    let currentRoute = undefined

    function augmentRoute(originalRoute) {
        const meta = {
            ...(originalRoute.meta || {}),
            state: null,
        }

        const augmentedRoute = {
            ...originalRoute,
            meta,
            component: props => {
                const { pathname, hash, search } = useLocation()
                const url = createUrl(pathname + search + hash)
                const routeBase = base && base({ url })

                const from = currentRoute
                const to = {
                    ...augmentedRoute,
                    path: pathname,
                    hash,
                    search,
                    params: useParams(),
                    // @ts-ignore -- This should be in ES2019 ??
                    query: Object.fromEntries(url.searchParams),
                    fullPath: getFullPath(url, routeBase),
                }

                if (!currentRoute) {
                    // First route, use provided initialState
                    console.log("initialState")
                }

                currentRoute = to

                if (PropsProvider) {
                    return React.createElement(
                        PropsProvider,
                        { ...props, from, to, pagePropsOptions },
                        originalRoute.component,
                    )
                }

                const { passToPage } = pagePropsOptions || {}
                return React.createElement(originalRoute.component, {
                    ...props,
                    ...((passToPage && meta.state) || {}),
                })
            },
        }

        if (Array.isArray(originalRoute.routes)) {
            augmentedRoute.routes = originalRoute.routes.map(augmentRoute)
        }

        return augmentedRoute
    }

    return {
        getCurrentRoute: () => currentRoute,
        isFirstRoute: () => !currentRoute,
        routes: routes.map(augmentRoute),
    }
}