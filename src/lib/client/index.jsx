import React, { createContext as reactCreateContext, useContext as reactUseContext } from "react"
import ReactDOM from "react-dom"
import { BrowserRouter, useHistory, useLocation, useParams } from "react-router-dom"
import { HelmetProvider } from "react-helmet-async"

export const SSR_CONTEXT = reactCreateContext(null)

const S = '/'

export function withPrefix(string, prefix) {
  return string.startsWith(prefix) ? string : prefix + string
}

export function withoutPrefix(string, prefix) {
  return string.startsWith(prefix) ? string.slice(prefix.length) : string
}

export function withSuffix(string, suffix) {
  return string.endsWith(suffix) ? string : string + suffix
}
export function withoutSuffix(string, suffix) {
  return string.endsWith(suffix)
    ? string.slice(0, -1 * suffix.length)
    : string + suffix
}

export function createUrl(urlLike) {
  if (urlLike instanceof URL) {
    return urlLike
  }

  if (!(urlLike || '').includes('://')) {
    urlLike = 'http://e.g' + withPrefix(urlLike, S)
  }

  return new URL(urlLike)
}

export function joinPaths(...paths) {
  return paths.reduce((acc, path) => acc + path, '').replace(/\/\//g, S)
}

export function getFullPath(url, routeBase) {
  url = typeof url === 'string' ? createUrl(url) : url
  let fullPath = withoutPrefix(url.href, url.origin)

  if (routeBase) {
    const parts = fullPath.split(S)
    if (parts[1] === routeBase.replace(/\//g, '')) {
      parts.splice(1, 1)
    }

    fullPath = parts.join(S)
  }

  return fullPath
}

export const ClientOnly = ({ children }) => {
    const [mounted, setMounted] = React.useState(false)
    React.useEffect(() => setMounted(true))

    return mounted ? React.createElement(React.Fragment, { children }) : null
}

export function provideContext(app, context) {
    return React.createElement(SSR_CONTEXT.Provider, { value: context }, app)
}

export function useContext() {
    return reactUseContext(SSR_CONTEXT)
}

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
                    console.log("first route, PROVIDE INITIALSTATE")
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

export const createClientEntry = async function (
    App,
    {
        routes,
        base,
        suspenseFallback,
        PropsProvider,
        pageProps,
        debug = {},
        styleCollector,
    },
    hook,
) {
    const url = window.location
    const routeBase = base && withoutSuffix(base({ url }), "/")

    const { redirect, writeResponse } = useClientRedirect(location => {
        const { push } = useHistory()
        React.useEffect(() => push(location), [push])
    })

    const context = {
        url,
        isClient: true,
        redirect,
        writeResponse,
        router: createRouter({
            routes,
            base,
            pagePropsOptions: pageProps,
            PropsProvider,
        }),
    }

    if (hook) {
        await hook(context)
    }

    let app = React.createElement(
        HelmetProvider,
        {},
        React.createElement(
            BrowserRouter,
            { basename: routeBase },
            React.createElement(
                React.Suspense,
                { fallback: suspenseFallback || "" },
                provideContext(React.createElement(App, context), context),
            ),
        ),
    )

    const styles = styleCollector && (await styleCollector(context))
    if (styles && styles.provide) {
        app = styles.provide(app)
    }

    if (debug.mount !== false) {
        const el = document.getElementById("root")

        styles && styles.cleanup && styles.cleanup()

        // @ts-ignore
        import.meta.env.DEV ? ReactDOM.render(app, el) : ReactDOM.hydrate(app, el)
    }
}